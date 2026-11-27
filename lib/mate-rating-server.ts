import { createAdminClient } from "./supabase-server";
import { localMatePreview } from "./mate-server";
import { readMatePreview, writeMatePreview } from "./mate-preview-store";
import { mateResultExpiry, seoulDate } from "./mate";
import type { MateComment, MateRating, MateResultRecord } from "./mate-ratings";

const RATINGS = "mate_activity_ratings";
const COMMENTS = "mate_activity_comments";
const batchSize = 1000;

export async function listMateRatings(round: number): Promise<{ data: MateRating[]; error: unknown }> {
  if (localMatePreview) {
    return { data: (readMatePreview().ratings ?? []).filter((item) => item.round === round), error: null };
  }
  const ratings: MateRating[] = [];
  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await createAdminClient().from(RATINGS).select("activity_no,application_id,score")
      .eq("round", round).order("activity_no").order("application_id").range(offset, offset + batchSize - 1);
    if (error) return { data: [], error };
    ratings.push(...(data as MateRating[]));
    if (data.length < batchSize) return { data: ratings, error: null };
  }
}

export async function listMateComments(round: number): Promise<{ data: MateComment[]; error: unknown }> {
  if (localMatePreview) {
    return { data: (readMatePreview().comments ?? []).filter((item) => item.round === round), error: null };
  }
  const comments: MateComment[] = [];
  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await createAdminClient().from(COMMENTS).select("activity_no,application_id,comment")
      .eq("round", round).order("activity_no").order("application_id").range(offset, offset + batchSize - 1);
    if (error) return { data: [], error };
    comments.push(...(data as MateComment[]));
    if (data.length < batchSize) return { data: comments, error: null };
  }
}

/** 제출된 결과물에만 코멘트를 남긴다. 빈 문자열이면 삭제한다. */
export async function saveMateComment(round: number, activity: number, applicationId: string, comment: string) {
  if (localMatePreview) {
    const preview = readMatePreview();
    const matches = (item: { round: number; activity_no: number; application_id: string }) =>
      item.round === round && item.activity_no === activity && item.application_id === applicationId;
    if (comment && !preview.responses.some((item) => matches(item) && item.result_instagram_url)) return false;
    preview.comments = (preview.comments ?? []).filter((item) => !matches(item));
    if (comment) preview.comments.push({ round, activity_no: activity, application_id: applicationId, comment });
    writeMatePreview(preview);
    return true;
  }
  const db = createAdminClient();
  if (!comment) {
    const { error } = await db.from(COMMENTS).delete().eq("round", round).eq("activity_no", activity).eq("application_id", applicationId);
    return !error;
  }
  const submitted = await db.from("mate_activity_responses").select("application_id").eq("round", round)
    .eq("activity_no", activity).eq("application_id", applicationId).not("result_instagram_url", "is", null).maybeSingle();
  if (submitted.error || !submitted.data) return false;
  const { error } = await db.from(COMMENTS).upsert(
    { round, activity_no: activity, application_id: applicationId, comment, updated_at: new Date().toISOString() },
    { onConflict: "round,activity_no,application_id" });
  return !error;
}

/** 활동 종료 후 1년간 보관하는 선정 메이트(보관 동의자)의 평가결과 */
export async function listMateResultRecords(round: number): Promise<{ data: MateResultRecord[]; error: unknown }> {
  const today = seoulDate();
  if (localMatePreview) {
    const preview = readMatePreview();
    const data = preview.applications
      .filter((app) => app.round === round && app.status === "selected" && app.result_consent_at
        && mateResultExpiry(app.retain_through) >= today)
      .map((app) => ({
        id: app.id, name: app.name, sns_id: app.sns_id, expires_on: mateResultExpiry(app.retain_through),
        scores: Object.fromEntries((preview.ratings ?? [])
          .filter((item) => item.round === round && item.application_id === app.id)
          .map((item) => [item.activity_no, item.score])),
      }));
    return { data, error: null };
  }
  const records: MateResultRecord[] = [];
  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await createAdminClient().from("mate_result_archive")
      .select("id,name,sns_id,scores,expires_on").eq("round", round).gte("expires_on", today)
      .order("id").range(offset, offset + batchSize - 1);
    if (error) return { data: [], error };
    records.push(...(data as MateResultRecord[]));
    if (data.length < batchSize) return { data: records, error: null };
  }
}

/** 제출된 결과물에만 평가결과를 남긴다. score가 null이면 취소한다. */
export async function saveMateRating(round: number, activity: number, applicationId: string, score: number | null) {
  if (localMatePreview) {
    const preview = readMatePreview();
    const matches = (item: { round: number; activity_no: number; application_id: string }) =>
      item.round === round && item.activity_no === activity && item.application_id === applicationId;
    if (score !== null && !preview.responses.some((item) => matches(item) && item.result_instagram_url)) return false;
    preview.ratings = (preview.ratings ?? []).filter((item) => !matches(item));
    if (score !== null) preview.ratings.push({ round, activity_no: activity, application_id: applicationId, score });
    writeMatePreview(preview);
    return true;
  }
  const db = createAdminClient();
  if (score === null) {
    const { error } = await db.from(RATINGS).delete().eq("round", round).eq("activity_no", activity).eq("application_id", applicationId);
    return !error;
  }
  const submitted = await db.from("mate_activity_responses").select("application_id").eq("round", round)
    .eq("activity_no", activity).eq("application_id", applicationId).not("result_instagram_url", "is", null).maybeSingle();
  if (submitted.error || !submitted.data) return false;
  const { error } = await db.from(RATINGS).upsert(
    { round, activity_no: activity, application_id: applicationId, score, rated_at: new Date().toISOString() },
    { onConflict: "round,activity_no,application_id" });
  return !error;
}
