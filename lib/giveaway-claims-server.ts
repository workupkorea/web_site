import "server-only";
import { createAdminClient } from "@/lib/supabase-server";
import { CLAIM_RETENTION_DAYS, claimSection, subSection, type ClaimDoc, type ClaimSubmission } from "@/lib/giveaway-claims";

// 당첨자 배송 정보 문서 읽기/쓰기 (서버 전용)
//  - 링크·설정 문서(ClaimDoc)는 이벤트당 1행, 제출 내용(ClaimSubmission)은 당첨자당 1행으로 따로 저장한다.
//    여러 당첨자가 동시에 제출해도 서로 덮어쓰지 않도록(문서 전체를 읽고 쓰는 경합 방지) 분리한 것이다.

const sb = () => createAdminClient();

async function deleteSections(sections: string[]) {
  if (!sections.length) return;
  const { error } = await sb().from("site_settings").delete().in("section", sections);
  if (error) throw new Error(error.message);
}

/** 문서 조회. 마감 후 보관 기간이 지났으면 링크와 제출 내용을 모두 삭제하고 null 을 돌려준다. */
export async function getClaimDoc(eventId: string): Promise<ClaimDoc | null> {
  const { data, error } = await sb().from("site_settings").select("config").eq("section", claimSection(eventId)).maybeSingle();
  if (error) throw new Error(error.message);
  const doc = (data?.config as ClaimDoc | undefined) ?? null;
  if (!doc) return null;
  const expireAt = Date.parse(doc.deadline) + CLAIM_RETENTION_DAYS * 86400000;
  if (!Number.isNaN(expireAt) && Date.now() > expireAt) {
    await deleteClaimDoc(eventId, doc);
    return null;
  }
  return doc;
}

/** 관리자용: 문서 + 모든 당첨자의 제출 내용을 합쳐서 돌려준다. */
export async function getClaimDocWithSubmissions(eventId: string): Promise<ClaimDoc | null> {
  const doc = await getClaimDoc(eventId);
  if (!doc) return null;
  const { data, error } = await sb()
    .from("site_settings")
    .select("section, config")
    .in("section", doc.entries.map((e) => subSection(e.token)));
  if (error) throw new Error(error.message);
  const subs = new Map((data ?? []).map((r) => [r.section as string, r.config as ClaimSubmission]));
  return { ...doc, entries: doc.entries.map((e) => ({ ...e, submitted: subs.get(subSection(e.token)) })) };
}

export async function saveClaimDoc(doc: ClaimDoc): Promise<void> {
  // 제출 내용은 별도 행에 있으므로 문서에는 넣지 않는다.
  const clean: ClaimDoc = { ...doc, entries: doc.entries.map((e) => ({ token: e.token, user: e.user, prize: e.prize, label: e.label })) };
  const { error } = await sb()
    .from("site_settings")
    .upsert({ section: claimSection(doc.eventId), config: clean, updated_at: new Date().toISOString() }, { onConflict: "section" });
  if (error) throw new Error(error.message);
}

export async function getSubmission(token: string): Promise<ClaimSubmission | null> {
  const { data, error } = await sb().from("site_settings").select("config").eq("section", subSection(token)).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.config as ClaimSubmission | undefined) ?? null;
}

export async function saveSubmission(token: string, sub: ClaimSubmission): Promise<void> {
  const { error } = await sb()
    .from("site_settings")
    .upsert({ section: subSection(token), config: sub, updated_at: new Date().toISOString() }, { onConflict: "section" });
  if (error) throw new Error(error.message);
}

/** 링크에서 빠진 당첨자의 제출 내용 삭제 */
export async function deleteSubmissions(tokens: string[]): Promise<void> {
  await deleteSections(tokens.map(subSection));
}

/** 개인정보 파기: 이벤트 문서와 모든 제출 내용을 삭제 */
export async function deleteClaimDoc(eventId: string, known?: ClaimDoc | null): Promise<void> {
  const doc = known ?? (await sb().from("site_settings").select("config").eq("section", claimSection(eventId)).maybeSingle()).data?.config;
  const entries = ((doc as ClaimDoc | undefined)?.entries ?? []) as { token: string }[];
  await deleteSections([claimSection(eventId), ...entries.map((e) => subSection(e.token))]);
}
