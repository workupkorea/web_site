import { createHash } from "node:crypto";
import { createAdminClient } from "./supabase-server";
import { seoulDate, type MateApplication } from "./mate";
import { MATE_RESULT_METRIC_KEYS, type MateActivity, type MateActivityProgress, type MatePortal, type MatePortalResponse,
  type MateProductSelection, type MateProductSelectionInput, type MateProfile, type MateResponse,
  type MateResultMetrics, type MateResultMetricsSummary } from "./mate-activities";
import { localMatePreview } from "./mate-server";
import { readMatePreview, writeMatePreview } from "./mate-preview-store";
import { verifyMateParticipant } from "./mate-participant-token";

const ACTIVITIES = "mate_activities";
const RESPONSES = "mate_activity_responses";
const APPLICATIONS = "mate_applications";
const PROFILE_COLUMNS = "id,round,name,sns_id,phone,address,gender,height_cm,feed_styles,link_version";
type Participant = MateProfile & Pick<MateApplication, "id" | "round"> & { link_version: number };

export async function listMateActivities(round: number, publishedOnly = false) {
  if (localMatePreview) {
    const data = readMatePreview().activities.filter((activity) => activity.round === round && (!publishedOnly || activity.published))
      .sort((a, b) => b.activity_no - a.activity_no);
    return { data: data.map(({ round, activity_no, product_name, product_info, product_url, published, product_image_version, size_options, color_options, additional_products, unit_cost, source_code }) =>
      ({ round, activity_no, product_name, product_info, product_url, published, product_image_version, size_options, color_options, additional_products, unit_cost, source_code })), error: null };
  }
  let query = createAdminClient().from(ACTIVITIES)
    .select("round,activity_no,product_name,product_info,product_url,product_image_version,size_options,color_options,additional_products,unit_cost,source_code,published").eq("round", round).order("activity_no", { ascending: false });
  if (publishedOnly) query = query.eq("published", true);
  const { data, error } = await query;
  return { data: data as MateActivity[] | null, error };
}

export async function listMateActivityProgress(round: number) {
  if (localMatePreview) {
    const preview = readMatePreview();
    const roster = new Set(preview.applications.filter((app) => app.round === round && app.status === "selected").map((app) => app.id));
    const progress = new Map(preview.activities.filter((activity) => activity.round === round)
      .map(({ activity_no }) => [activity_no, { activity_no, eligible: roster.size, joined: 0, declined: 0, submitted: 0 }]));
    for (const response of preview.responses) {
      if (response.round !== round || !roster.has(response.application_id)) continue;
      const row = progress.get(response.activity_no);
      if (!row) continue;
      row[response.choice === "yes" ? "joined" : "declined"]++;
      if (response.choice === "yes" && response.result_instagram_url) row.submitted++;
    }
    return { data: [...progress.values()], error: null };
  }
  const { data, error } = await createAdminClient().rpc("mate_activity_progress", { p_round: round });
  return { data: data as MateActivityProgress[] | null, error };
}

export async function storeMateActivity(activity: MateActivity, create: boolean, image?: MateActivityImageChange,
  keep?: { link: boolean; info: boolean }) {
  const { product_url, product_info, ...details } = activity;
  const record = create ? { ...activity, ...image } : {
    ...details,
    ...(!keep?.link ? { product_url } : {}),
    ...(!keep?.info ? { product_info } : {}),
    ...image,
  };
  if (localMatePreview) {
    const preview = readMatePreview();
    if (!preview.rounds.some((round) => round.round === activity.round)) return "failed";
    const index = preview.activities.findIndex((item) => item.round === activity.round && item.activity_no === activity.activity_no);
    if (create && index >= 0) return "duplicate";
    if (!create && index < 0) return "failed";
    if (create) preview.activities.push({ ...activity, ...image });
    else preview.activities[index] = { ...preview.activities[index], ...record };
    writeMatePreview(preview);
    return "saved";
  }
  const table = createAdminClient().from(ACTIVITIES);
  const query = create ? table.insert(record) : table.update(record).eq("round", activity.round).eq("activity_no", activity.activity_no);
  const { data, error } = await query.select("activity_no").maybeSingle();
  if (error?.code === "23505") return "duplicate";
  return error || !data ? "failed" : "saved";
}

export type MateActivityImageChange = { product_image_webp: string | null; product_image_version: string | null };

export async function getMateActivityImage(round: number, activity: number, publishedOnly: boolean) {
  if (localMatePreview) {
    const item = readMatePreview().activities.find((entry) => entry.round === round && entry.activity_no === activity
      && (!publishedOnly || entry.published));
    return item?.product_image_webp ?? null;
  }
  let query = createAdminClient().from(ACTIVITIES).select("product_image_webp").eq("round", round).eq("activity_no", activity);
  if (publishedOnly) query = query.eq("published", true);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data?.product_image_webp ?? null;
}

export async function mateParticipantForRequest(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^ ]+)$/)?.[1];
  const parsed = token && verifyMateParticipant(token);
  return parsed ? loadMateParticipant(parsed.id, parsed.version) : null;
}

export async function listMateActivityResponses(round: number, activity: number, ids: string[]) {
  if (!ids.length) return { data: [] as MateResponse[], error: null };
  if (localMatePreview) {
    return { data: readMatePreview().responses.filter((item) => item.round === round && item.activity_no === activity && ids.includes(item.application_id)), error: null };
  }
  const { data, error } = await createAdminClient().from(RESPONSES).select("*")
    .eq("round", round).eq("activity_no", activity).in("application_id", ids);
  return { data: data as MateResponse[] | null, error };
}

export async function listMateSubmittedResults(round: number, activity: number | null, offset: number, limit: number) {
  if (localMatePreview) {
    const preview = readMatePreview();
    const creators = new Map(preview.applications.filter((app) => app.round === round).map((app) => [app.id, app]));
    const submissions = preview.responses.flatMap((response) => {
      if (response.round !== round || (activity !== null && activity !== response.activity_no)
        || !response.result_instagram_url || !response.result_submitted_at) return [];
      const creator = creators.get(response.application_id);
      if (!creator) return [];
      return [{
        activity_no: response.activity_no,
        application_id: response.application_id,
        response_updated_at: response.updated_at,
        result_instagram_url: response.result_instagram_url,
        result_submitted_at: response.result_submitted_at,
        result_metrics: response.result_metrics ?? null,
        result_metrics_updated_at: response.result_metrics_updated_at ?? null,
        creator: { name: creator.name, sns_id: creator.sns_id },
      }];
    }).sort((a, b) => a.activity_no - b.activity_no || b.result_submitted_at.localeCompare(a.result_submitted_at)
      || a.application_id.localeCompare(b.application_id));
    return { data: submissions.slice(offset, offset + limit), count: submissions.length, error: null };
  }

  let query = createAdminClient().from(RESPONSES)
    .select("activity_no,application_id,response_updated_at:updated_at,result_instagram_url,result_submitted_at,result_metrics,result_metrics_updated_at,creator:mate_applications!inner(name,sns_id)", { count: "exact" })
    .eq("round", round)
    .not("result_instagram_url", "is", null)
    .not("result_submitted_at", "is", null);
  if (activity !== null) query = query.eq("activity_no", activity);
  return await query
    .order("activity_no")
    .order("result_submitted_at", { ascending: false })
    .order("application_id")
    .range(offset, offset + limit - 1)
    .overrideTypes<Array<{
      activity_no: number;
      application_id: string;
      response_updated_at: string;
      result_instagram_url: string;
      result_submitted_at: string;
      result_metrics: MateResultMetrics | null;
      result_metrics_updated_at: string | null;
      creator: { name: string; sns_id: string };
    }>, { merge: false }>();
}

export async function summarizeMateResultMetrics(round: number, activity: number | null) {
  if (localMatePreview) {
    const preview = readMatePreview();
    const data: MateResultMetricsSummary = {
      views_sum: null, views_count: 0, likes_sum: null, likes_count: 0, comments_sum: null, comments_count: 0,
    };
    for (const response of preview.responses) {
      if (response.round !== round || (activity !== null && response.activity_no !== activity)
        || !response.result_instagram_url || !response.result_submitted_at || !response.result_metrics) continue;
      for (const key of MATE_RESULT_METRIC_KEYS) {
        const value = response.result_metrics[key];
        if (value == null) continue;
        data[`${key}_count`]++;
        data[`${key}_sum`] = (data[`${key}_sum`] ?? 0) + value;
      }
    }
    return { data, error: null };
  }
  return await createAdminClient().rpc("mate_result_metrics_summary", { p_round: round, p_activity: activity })
    .single().overrideTypes<MateResultMetricsSummary, { merge: false }>();
}

export async function storeMateResultMetrics(round: number, activity: number, id: string, url: string, values: MateResultMetrics) {
  const hasMetrics = MATE_RESULT_METRIC_KEYS.some((key) => values[key] !== null);
  const patch = {
    result_metrics: hasMetrics ? values : null,
    result_metrics_updated_at: hasMetrics ? new Date().toISOString() : null,
  };
  if (localMatePreview) {
    const preview = readMatePreview();
    const response = preview.responses.find((item) => item.round === round && item.activity_no === activity
      && item.application_id === id && item.result_instagram_url === url && item.result_submitted_at);
    if (!response) return false;
    Object.assign(response, patch);
    writeMatePreview(preview);
    return true;
  }
  const { data, error } = await createAdminClient().from(RESPONSES).update(patch)
    .eq("round", round).eq("activity_no", activity).eq("application_id", id).eq("result_instagram_url", url)
    .not("result_submitted_at", "is", null).select("application_id").maybeSingle();
  return !error && Boolean(data);
}

function activeParticipant(application: MateApplication, id: string, version: number) {
  return application.id === id && (application.link_version ?? 0) === version
    && application.status === "selected" && application.retain_through >= seoulDate();
}

function profileFrom({ name, sns_id, phone, address, gender, height_cm, feed_styles }: MateProfile): MateProfile {
  return { name, sns_id, phone, address, gender, height_cm, feed_styles };
}

export async function loadMateParticipant(id: string, version: number): Promise<Participant | null> {
  if (localMatePreview) {
    const app = readMatePreview().applications.find((item) => activeParticipant(item, id, version));
    return app ? { id, round: app.round, link_version: version, ...profileFrom(app) } : null;
  }
  const { data, error } = await createAdminClient().from(APPLICATIONS).select(PROFILE_COLUMNS)
    .eq("id", id).eq("link_version", version).eq("status", "selected").gte("retain_through", seoulDate()).maybeSingle();
  if (error) throw error;
  return data as Participant | null;
}

export async function loadMatePortal(participant: Participant): Promise<MatePortal> {
  const { round, id } = participant;
  const answers = localMatePreview
    ? { data: readMatePreview().responses.filter((item) => item.round === round && item.application_id === id), error: null }
    : await createAdminClient().from(RESPONSES).select("activity_no,choice,size,color,result_instagram_url,result_submitted_at,additional_selections,updated_at").eq("round", round).eq("application_id", id);
  const activities = await listMateActivities(round);
  if (activities.error || answers.error) throw activities.error || answers.error;
  const byNumber = new Map<number, MatePortalResponse>((answers.data ?? []).map((item) => [item.activity_no, {
    choice: item.choice, size: item.size, color: item.color ?? null,
    result_instagram_url: item.result_instagram_url ?? null, result_submitted_at: item.result_submitted_at ?? null,
    additional_selections: item.additional_selections ?? [], updated_at: item.updated_at,
  }]));
  const available = activities.data ?? [];
  const stamp = createHash("sha256").update("workup-mate-number:" + id).digest("hex").slice(0, 12);
  const number = (Number.parseInt(stamp, 16) % 10_000_000_000).toString().padStart(10, "0");
  return {
    round,
    mate_no: number.slice(0, 5) + "-" + number.slice(5),
    profile: profileFrom(participant),
    history: available.flatMap(({ activity_no, product_name }) => {
      const response = byNumber.get(activity_no);
      return response ? [{ activity_no, product_name, response }] : [];
    }),
    activities: available.filter((activity) => activity.published).map(({ activity_no, product_name, product_info, product_url, product_image_version, size_options, color_options, additional_products }) => ({
      activity_no, product_name, product_info, product_url, product_image_version, size_options, color_options,
      additional_products: additional_products?.map(({ id, name, size_options, color_options, product_url }) =>
        ({ id, name, size_options, color_options, product_url })),
      response: byNumber.get(activity_no) ?? null,
    })),
  };
}

export async function updateMateProfile(participant: Participant, patch: Partial<MateProfile>) {
  if (!Object.keys(patch).length) return "saved";
  if (localMatePreview) {
    const preview = readMatePreview();
    const app = preview.applications.find((item) => activeParticipant(item, participant.id, participant.link_version));
    if (!app) return "failed";
    if (patch.sns_id && preview.applications.some((item) => item.round === app.round && item.id !== app.id && item.sns_id === patch.sns_id)) return "duplicate";
    Object.assign(app, patch);
    writeMatePreview(preview);
    return "saved";
  }
  const { data, error } = await createAdminClient().from(APPLICATIONS).update(patch)
    .eq("id", participant.id).eq("link_version", participant.link_version).eq("status", "selected").gte("retain_through", seoulDate()).select("id").maybeSingle();
  if (error?.code === "23505") return "duplicate";
  return error || !data ? "failed" : "saved";
}

export async function saveMateResponse(participant: Participant, activity: number, choice: MateResponse["choice"],
  size: string | null, color: string | null, additional: MateProductSelectionInput[]): Promise<MatePortalResponse | null> {
  if (localMatePreview) {
    const preview = readMatePreview();
    if (!preview.applications.some((item) => activeParticipant(item, participant.id, participant.link_version))) return null;
    const available = preview.activities.find((item) => item.round === participant.round && item.activity_no === activity && item.published);
    if (!available) return null;
    const normalized: MateProductSelection[] = [];
    if (choice === "yes") {
      if (!size || (available.size_options?.length && !available.size_options.includes(size))
        || (available.color_options?.length && (!color || !available.color_options.includes(color)))) return null;
      const products = available.additional_products ?? [];
      if (additional.length !== products.length) return null;
      for (const product of products) {
        const selection = additional.find((item) => item.product_id === product.id);
        if (!selection || (product.size_options.length && !product.size_options.includes(selection.size))
          || (product.color_options.length && (!selection.color || !product.color_options.includes(selection.color)))) return null;
        normalized.push({ ...selection, product_name: product.name });
      }
    }
    const response = { round: participant.round, application_id: participant.id, activity_no: activity,
      choice, size, color, additional_selections: normalized, updated_at: new Date().toISOString() };
    const index = preview.responses.findIndex((item) => item.round === response.round && item.activity_no === activity && item.application_id === participant.id);
    if (index < 0) preview.responses.push(response);
    else preview.responses[index] = { ...preview.responses[index], ...response };
    writeMatePreview(preview);
    return { choice, size, color, additional_selections: normalized, updated_at: response.updated_at };
  }
  const db = createAdminClient();
  const { data, error } = await db.rpc("save_mate_activity_response", {
    p_round: participant.round, p_activity_no: activity, p_application_id: participant.id, p_choice: choice,
    p_size: size, p_color: color, p_link_version: participant.link_version, p_additional_selections: additional,
  });
  if (error) throw error;
  if (!Array.isArray(data)) return null;

  const { data: saved } = await db.from(RESPONSES).select("choice,size,color,additional_selections,updated_at")
    .eq("round", participant.round).eq("activity_no", activity).eq("application_id", participant.id).maybeSingle();
  return saved as MatePortalResponse | null
    ?? { choice, size, color, additional_selections: data as MateProductSelection[], updated_at: null };
}
export async function submitMateActivityResult(participant: Participant, activity: number, instagramUrl: string) {
  if (localMatePreview) {
    const preview = readMatePreview();
    if (!preview.applications.some((item) => activeParticipant(item, participant.id, participant.link_version))
      || !preview.activities.some((item) => item.round === participant.round && item.activity_no === activity && item.published)) return null;
    const answer = preview.responses.find((item) => item.round === participant.round && item.activity_no === activity
      && item.application_id === participant.id && item.choice === "yes");
    if (!answer) return null;
    if (answer.result_instagram_url?.split(/[?#]/, 1)[0] !== instagramUrl.split(/[?#]/, 1)[0]) {
      answer.result_metrics = null;
      answer.result_metrics_updated_at = null;
    }
    answer.result_instagram_url = instagramUrl;
    answer.result_submitted_at = new Date().toISOString();
    writeMatePreview(preview);
    return answer.result_submitted_at;
  }
  const { data, error } = await createAdminClient().rpc("submit_mate_activity_result", {
    p_round: participant.round, p_activity_no: activity, p_application_id: participant.id,
    p_link_version: participant.link_version, p_instagram_url: instagramUrl,
  });
  if (error) throw error;
  return typeof data === "string" ? data : null;
}
