// 연말 이벤트 당첨기의 DB 처리. 접근 권한은 호출하는 라우트에서 확인한다.
import { createAdminClient } from "@/lib/supabase-server";
import type { PromotionEvent } from "@/app/admin/promotions/entries/events";
import { saveQuota } from "./events-server";
import { buildRounds, MAX_QUOTA, blockedPhones, parseExcludedRows, parsePhones, pickWinners, summarizeEntries, type DrawRound } from "./draw";

const ENTRIES = "goldenbell_entries";
const WINNERS = "goldenbell_winners";
const EXCLUDED = "goldenbell_excluded_phones";
const CHUNK = 1000; // Supabase 한 번에 가져오는 행 수 한도
const MAX_EXCLUDE_INPUT = 5000;
const KOREA_DAY = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" });
const MISSING_SCHEMA = new Set(["42703", "42P01", "PGRST202", "PGRST204", "PGRST205"]);

type Entry = { id: string; phone: string; name: string; store: string; status: string; created_at: string };
export type Winner = { id: string; prize: string; round: number; phone: string; name: string; store: string; drawn_at: string; canceled_at: string | null };
type Excluded = { phone: string; memo: string; created_at: string };

/** 화면에 그대로 보여줄 수 있는 오류 */
export class DrawError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

function check(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (MISSING_SCHEMA.has(error.code ?? "")) throw new DrawError("DB 설정이 아직 없어요. 당첨기·이벤트 SQL을 먼저 실행해 주세요.");
  if (error.message.includes("goldenbell_quota_exceeded") || error.code === "23505") {
    throw new DrawError("다른 곳에서 먼저 추첨했어요. 새로고침 후 확인해 주세요.");
  }
  throw error;
}

type Page<T> = PromiseLike<{ data: T[] | null; error: { code?: string; message: string } | null }>;
async function fetchAll<T>(build: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await build(from, from + CHUNK - 1);
    check(error);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < CHUNK) return rows;
  }
}

async function loadState(eventId: string) {
  const sb = createAdminClient();
  // 당첨기 테이블을 먼저 읽어, SQL 실행 전이면 바로 안내한다.
  const winners = await fetchAll<Winner>((a, b) => sb.from(WINNERS)
    .select("id,prize,round,phone,name,store,drawn_at,canceled_at").eq("event_id", eventId).order("drawn_at").order("id").range(a, b));
  const excluded = await fetchAll<Excluded>((a, b) => sb.from(EXCLUDED)
    .select("phone,memo,created_at").eq("event_id", eventId).order("created_at", { ascending: false }).order("phone").range(a, b));
  const entries = await fetchAll<Entry>((a, b) => sb.from(ENTRIES)
    .select("id,phone,name,store,status,created_at").eq("event_id", eventId).neq("status", "rejected").order("id").range(a, b));
  return { winners, excluded, entries };
}
type State = Awaited<ReturnType<typeof loadState>>;
export const eventRounds = (event: PromotionEvent) => buildRounds(event.start, event.end, event.quotas);

// test: 직원 테스트 영역은 날짜와 관계없이 모든 테스트 응모로 바로 추첨해 볼 수 있다.
function roundStatus(round: DrawRound, { winners, excluded, entries }: State, now: Date, test = false) {
  const inRound = test ? entries : entries.filter((entry) => {
    const day = KOREA_DAY.format(new Date(entry.created_at));
    return day >= round.from && day <= round.to;
  });
  const approved = inRound.filter((entry) => entry.status === "approved");
  const blocked = blockedPhones(round.prize, winners, excluded);
  const drawn = winners.filter((row) => row.prize === round.prize && row.round === round.round && !row.canceled_at).length;
  return {
    approved, blocked, drawn,
    remaining: Math.max(0, round.quota - drawn),
    candidates: new Set(approved.filter((entry) => !blocked.has(entry.phone)).map((entry) => entry.phone)).size,
    pending: inRound.filter((entry) => entry.status === "pending").length,
    open: test || KOREA_DAY.format(now) > round.to, // 응모 기간이 끝난 다음 날부터 추첨
  };
}

export async function drawOverview(event: PromotionEvent, now = new Date()) {
  const state = await loadState(event.id);
  const excluded = new Set(state.excluded.map((row) => row.phone));
  return {
    rounds: eventRounds(event).map((round) => {
      const { drawn, remaining, candidates, pending, open } = roundStatus(round, state, now, event.test);
      return { ...round, drawn, remaining, candidates, pending, open };
    }),
    winners: state.winners.map((row) => ({ ...row, excluded: !row.canceled_at && excluded.has(row.phone) })),
    excluded: state.excluded,
  };
}

/** 추첨 인원 변경. 어느 회차든 이미 당첨된 인원보다 적게는 줄일 수 없다. */
export async function setQuota(event: PromotionEvent, prize: DrawRound["prize"], quota: number) {
  if (!Number.isInteger(quota) || quota < 1 || quota > MAX_QUOTA) throw new DrawError(`추첨 인원은 1~${MAX_QUOTA.toLocaleString("ko-KR")}명으로 입력해 주세요.`, 400);
  const { winners } = await loadState(event.id);
  const perRound = new Map<number, number>();
  for (const row of winners) {
    if (row.prize === prize && !row.canceled_at) perRound.set(row.round, (perRound.get(row.round) ?? 0) + 1);
  }
  const drawn = Math.max(0, ...perRound.values());
  if (quota < drawn) throw new DrawError(`이미 ${drawn}명이 당첨된 회차가 있어 더 적게 설정할 수 없어요. 먼저 당첨을 확인해 주세요.`);
  await saveQuota(event.id, prize, quota);
}

/** 회차의 빈자리 중 최대 count 명을 뽑아 저장한다. 후보가 없으면 빈 배열. */
async function drawInto(event: PromotionEvent, round: DrawRound, status: ReturnType<typeof roundStatus>, count: number) {
  const picked = pickWinners(status.approved, { count, blocked: status.blocked, weighted: round.prize === "gold" });
  if (!picked.length) return picked;
  const { error } = await createAdminClient().rpc("goldenbell_save_winners", {
    p_event: event.id, p_prize: round.prize, p_round: round.round, p_quota: round.quota,
    p_winners: picked.map(({ id, phone, name, store }) => ({ entry_id: id, phone, name, store })),
  });
  check(error);
  return picked;
}

export async function runDraw(event: PromotionEvent, round: DrawRound, now = new Date()) {
  const status = roundStatus(round, await loadState(event.id), now, event.test);
  if (!status.open) throw new DrawError("응모 기간이 끝난 다음 날부터 추첨할 수 있어요.");
  if (!status.remaining) throw new DrawError("이미 정원을 모두 추첨했어요.");
  const picked = await drawInto(event, round, status, status.remaining);
  if (!picked.length) throw new DrawError("추첨할 수 있는 승인 응모가 없어요.");
  return { drawn: picked.length, shortage: status.remaining - picked.length };
}

/** 당첨을 취소하고 같은 회차에서 한 명을 바로 다시 뽑는다. 후보가 없으면 replacement 는 null. */
export async function cancelWinner(event: PromotionEvent, id: string, now = new Date()) {
  const { data, error } = await createAdminClient().from(WINNERS)
    .update({ canceled_at: now.toISOString() }).eq("id", id).eq("event_id", event.id).is("canceled_at", null).select("prize,round");
  check(error);
  if (!data?.length) throw new DrawError("취소할 당첨 내역을 찾지 못했어요.", 404);
  const round = eventRounds(event).find((item) => item.prize === data[0].prize && item.round === data[0].round);
  if (!round) return { replacement: null };
  // 취소는 이미 반영됐으므로, 대체 추첨이 실패하면 빈자리로 남겨 [추가 추첨]으로 채울 수 있게 알린다.
  try {
    const status = roundStatus(round, await loadState(event.id), now, event.test);
    const [picked] = status.open && status.remaining ? await drawInto(event, round, status, 1) : [];
    return { replacement: picked ? { name: picked.name, phone: picked.phone } : null };
  } catch (drawError) {
    console.error("[goldenbell] failed to draw a replacement", drawError);
    return { replacement: null };
  }
}

async function saveExcluded(eventId: string, entries: { phone: string; memo: string }[]) {
  if (!entries.length) throw new DrawError("등록할 010 휴대폰 번호를 확인해 주세요.", 400);
  if (entries.length > MAX_EXCLUDE_INPUT) throw new DrawError(`한 번에 ${MAX_EXCLUDE_INPUT}개까지 등록할 수 있어요.`, 400);
  const { error } = await createAdminClient().from(EXCLUDED).upsert(entries.map((entry) => ({ ...entry, event_id: eventId })), { onConflict: "event_id,phone" });
  check(error);
  return entries.length;
}

export async function addExcluded(eventId: string, text: string, memo: string) {
  const { phones, invalid } = parsePhones(text);
  const added = await saveExcluded(eventId, phones.map((phone) => ({ phone, memo: memo.trim().slice(0, 100) })));
  return { added, invalid };
}

export async function addExcludedRows(eventId: string, rows: unknown[][], memo: string) {
  const { entries, invalid } = parseExcludedRows(rows, memo);
  return { added: await saveExcluded(eventId, entries), invalid };
}

export async function removeExcluded(eventId: string, phone: string) {
  const { error } = await createAdminClient().from(EXCLUDED).delete().eq("event_id", eventId).eq("phone", phone);
  check(error);
}

/** 엑셀용: 취소하지 않은 당첨자 */
export async function winnerSheetRows(event: PromotionEvent, round: DrawRound) {
  const { winners } = await drawOverview(event);
  return [
    ["이름", "휴대폰번호", "방문 매장", "추첨일시", "제외번호 여부"],
    ...winners.filter((row) => row.prize === round.prize && row.round === round.round && !row.canceled_at).map((row) => [
      row.name, row.phone, row.store,
      new Date(row.drawn_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false }),
      row.excluded ? "제외번호 등록됨" : "",
    ]),
  ];
}

/** 결과 보기: 응모 통계(반려 포함)와 당첨자 */
export async function eventResults(event: PromotionEvent) {
  const sb = createAdminClient();
  const winners = await fetchAll<Winner>((a, b) => sb.from(WINNERS)
    .select("id,prize,round,phone,name,store,drawn_at,canceled_at").eq("event_id", event.id).is("canceled_at", null)
    .order("prize").order("round").order("id").range(a, b));
  const entries = await fetchAll<Entry>((a, b) => sb.from(ENTRIES)
    .select("id,phone,name,store,status,created_at").eq("event_id", event.id).order("id").range(a, b));
  return { name: event.name, test: Boolean(event.test), start: event.start, end: event.end, ...summarizeEntries(entries), winners };
}
