import { randomUUID } from "node:crypto";
import { createAdminClient } from "./supabase-server";
import { MATE_REGION_PREFIXES, mateAddressRegion, mateRoundStatus, seoulDate, type MateApplication, type MateApplicationFilters, type MateRound } from "./mate";
import { readMatePreview, writeMatePreview } from "./mate-preview-store";

const ROUND_TABLE = "mate_rounds";
const APPLICATION_TABLE = "mate_applications";
const APPLICATION_COLUMNS = "id,round,sns_id,feed_styles,name,gender,phone,address,height_cm,message,status,submitted_at,retain_through,link_version,link_first_issued_at,link_issued_at";

export const localMatePreview = process.env.NODE_ENV === "development";

export async function listMateRounds(requested: number | null, publishedOnly: boolean) {
  if (localMatePreview) {
    const rounds = readMatePreview().rounds
      .filter((round) => (!requested || round.round === requested) && (!publishedOnly || round.published))
      .sort((a, b) => b.round - a.round);
    return { data: rounds, error: null };
  }
  let query = createAdminClient().from(ROUND_TABLE).select("*").order("round", { ascending: false });
  if (requested) query = query.eq("round", requested);
  if (publishedOnly) query = query.eq("published", true);
  const { data, error } = await query;
  return { data: data as MateRound[] | null, error };
}

export async function listMateApplications(round: number, status: string, offset: number, limit: number, filters: MateApplicationFilters = {}) {
  if (localMatePreview) {
    const applications = readMatePreview().applications
      .filter((application) => application.round === round && (!status || application.status === status)
        && (!filters.feed || application.feed_styles.includes(filters.feed))
        && (!filters.gender || application.gender === filters.gender)
        && (!filters.region || mateAddressRegion(application.address) === filters.region))
      .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at) || b.id.localeCompare(a.id));
    return { data: applications.slice(offset, offset + limit), count: applications.length, error: null };
  }
  let query = createAdminClient().from(APPLICATION_TABLE)
    .select(APPLICATION_COLUMNS, { count: "exact" }).eq("round", round);
  if (status) query = query.eq("status", status);
  if (filters.feed) query = query.contains("feed_styles", [filters.feed]);
  if (filters.gender) query = query.eq("gender", filters.gender);
  if (filters.region) {
    const prefixes = MATE_REGION_PREFIXES[filters.region];
    query = query.or(prefixes.flatMap((prefix) => [
      `address.eq.${prefix}`, `address.ilike.${prefix} %`, `address.ilike._____ ${prefix} %`, `address.ilike."(_____) ${prefix} %"`,
    ]).join(","));
  }
  const { data, error, count } = await query.order("submitted_at", { ascending: false }).order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  return { data: data as MateApplication[] | null, error, count };
}

export async function storeMateRound(round: MateRound, create: boolean) {
  if (localMatePreview) {
    const preview = readMatePreview();
    const existing = preview.rounds.findIndex((item) => item.round === round.round);
    if (create && existing >= 0) return "duplicate";
    if (!create && existing < 0) return "failed";
    if (create) preview.rounds.push(round);
    else {
      if (round.retain_through && round.retain_through !== preview.rounds[existing].retain_through) {
        for (const application of preview.applications) {
          if (application.round === round.round && application.status === "selected") application.retain_through = round.retain_through;
        }
      }
      preview.rounds[existing] = round;
    }
    writeMatePreview(preview);
    return "saved";
  }
  const sb = createAdminClient();
  const query = create ? sb.from(ROUND_TABLE).insert(round) : sb.from(ROUND_TABLE).update(round).eq("round", round.round);
  const { data, error } = await query.select("round").maybeSingle();
  if (error?.code === "23505") return "duplicate";
  return error || !data ? "failed" : "saved";
}

type NewApplication = Omit<MateApplication, "id" | "status" | "submitted_at" | "result_consent_at">;

export async function storeMateApplication(application: NewApplication, resultConsent: boolean) {
  if (localMatePreview) {
    const preview = readMatePreview();
    const round = preview.rounds.find((item) => item.round === application.round);
    if (!round || mateRoundStatus(round) !== "모집 중") return "closed";
    if (round.retain_through !== application.retain_through) return "changed";
    if (preview.applications.some((item) => item.round === application.round && item.sns_id === application.sns_id)) return "duplicate";
    preview.applications.push({
      ...application, id: randomUUID(), submitted_at: new Date().toISOString(), status: "received",
      result_consent_at: resultConsent ? new Date().toISOString() : null,
    });
    writeMatePreview(preview);
    return "accepted";
  }
  const db = createAdminClient();
  const { data, error } = await db.rpc("submit_mate_application", {
    p_round: application.round,
    p_retain_through: application.retain_through,
    p_sns_id: application.sns_id,
    p_feed_styles: application.feed_styles,
    p_name: application.name,
    p_gender: application.gender,
    p_phone: application.phone,
    p_address: application.address,
    p_height_cm: application.height_cm,
    p_message: application.message,
  });
  if (error) return "failed";
  if (data === "accepted" && resultConsent) {
    // 기록에 실패해도 접수는 유지한다. 동의 기록이 없는 지원자의 평가결과는 보관되지 않는다.
    const consent = await db.from(APPLICATION_TABLE).update({ result_consent_at: new Date().toISOString() })
      .eq("round", application.round).eq("sns_id", application.sns_id);
    if (consent.error) console.error("mate result consent not recorded", consent.error);
  }
  return data;
}

export async function changeMateApplication(round: number, id: string, status: MateApplication["status"]) {
  if (localMatePreview) {
    const preview = readMatePreview();
    const index = preview.applications.findIndex((item) => item.round === round && item.id === id);
    if (index < 0) return false;
    const application = preview.applications[index];
    if (status === "selected" && application.status !== "selected") {
      application.retain_through = preview.rounds.find((cohort) => cohort.round === round)?.retain_through ?? application.retain_through;
    }
    application.status = status;
    writeMatePreview(preview);
    return true;
  }
  const { data, error } = await createAdminClient().from(APPLICATION_TABLE).update({ status })
    .eq("round", round).eq("id", id).select("id").maybeSingle();
  return !error && Boolean(data);
}

export async function recordMateLinkIssuance(round: number, id: string, expectedVersion: number, reissue: boolean) {
  if (localMatePreview) {
    const preview = readMatePreview();
    const application = preview.applications.find((item) => item.round === round && item.id === id);
    if (!application || application.status !== "selected" || application.retain_through < seoulDate()
      || (application.link_version ?? 0) !== expectedVersion || Boolean(application.link_issued_at) !== reissue) return false;
    const now = new Date().toISOString();
    application.link_version = reissue ? expectedVersion + 1 : expectedVersion;
    application.link_first_issued_at ??= now;
    application.link_issued_at = now;
    writeMatePreview(preview);
    return true;
  }
  const { data, error } = await createAdminClient().rpc("issue_mate_participant_link", {
    p_round: round, p_application_id: id, p_expected_version: expectedVersion, p_reissue: reissue,
  });
  return !error && data === true;
}

export async function deleteMateApplications(round: number, ids: string[]) {
  if (localMatePreview) {
    const preview = readMatePreview();
    const selected = new Set(ids);
    const countBefore = preview.applications.length;
    preview.applications = preview.applications.filter((item) => item.round !== round || !selected.has(item.id));
    const count = countBefore - preview.applications.length;
    if (count) {
      preview.responses = preview.responses.filter((item) => item.round !== round || !selected.has(item.application_id));
      preview.ratings = preview.ratings?.filter((item) => item.round !== round || !selected.has(item.application_id));
      preview.comments = preview.comments?.filter((item) => item.round !== round || !selected.has(item.application_id));
      writeMatePreview(preview);
    }
    return { count, error: null };
  }
  return createAdminClient().from(APPLICATION_TABLE).delete({ count: "exact" }).eq("round", round).in("id", ids);
}
