// 연말 이벤트 당첨 추첨 규칙 (DB 와 분리한 순수 로직).
import { randomInt } from "node:crypto";

export type Prize = "coffee" | "gold";
export type DrawRound = { prize: Prize; round: number; label: string; from: string; to: string; quota: number };

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_QUOTAS: Readonly<Record<Prize, number>> = { coffee: 200, gold: 10 };
export const MAX_QUOTA = 10000;
const addDays = (day: string, count: number) => new Date(Date.parse(day) + count * DAY_MS).toISOString().slice(0, 10);

/**
 * 이벤트 기간으로 회차를 만든다. 커피는 7일 단위(남는 날은 마지막 주차에 포함), 금은 전체 기간.
 */
export function buildRounds(start: string, end: string, quotas: Partial<Record<Prize, number>> = {}): DrawRound[] {
  if (!start || !end || end < start) return [];
  const weeks = Math.max(1, Math.floor(((Date.parse(end) - Date.parse(start)) / DAY_MS + 1) / 7));
  return [
    ...Array.from({ length: weeks }, (_, index): DrawRound => ({
      prize: "coffee", round: index + 1, label: `${index + 1}주차`, quota: quotas.coffee ?? DEFAULT_QUOTAS.coffee,
      from: addDays(start, index * 7), to: index === weeks - 1 ? end : addDays(start, index * 7 + 6),
    })),
    { prize: "gold", round: 0, label: "전체 기간", from: start, to: end, quota: quotas.gold ?? DEFAULT_QUOTAS.gold },
  ];
}

export const findRound = (rounds: readonly DrawRound[], prize: unknown, round: unknown) =>
  rounds.find((item) => item.prize === prize && item.round === Number(round));

export function normalizePhone(input: unknown): string | null {
  let value = String(input ?? "").trim().replace(/[\s()-]/g, "");
  if (value.startsWith("+82")) value = "0" + value.slice(3);
  return /^010\d{8}$/.test(value) ? value : null;
}

/** 줄바꿈·쉼표로 구분해 붙여 넣은 번호 목록. 엑셀에서 앞자리 0 이 빠진 번호도 받는다. */
export function parsePhones(text: string) {
  const phones = new Set<string>();
  const invalid: string[] = [];
  for (const chunk of text.split(/[\n,;\t]+/).map((value) => value.trim()).filter(Boolean)) {
    const phone = normalizePhone(/^10[\d\s-]+$/.test(chunk) ? "0" + chunk : chunk);
    if (phone) phones.add(phone);
    else invalid.push(chunk);
  }
  return { phones: [...phones], invalid };
}

/**
 * 제외번호 엑셀의 행들. 행마다 처음 나오는 010 번호를 쓰고, '메모' 열이 있으면 함께 읽는다.
 * invalid 는 번호를 찾지 못한 행 번호(1부터). 제목 행과 빈 행은 세지 않는다.
 */
export function parseExcludedRows(rows: readonly (readonly unknown[])[], defaultMemo = "") {
  const found = new Map<string, string>(); // 번호 → 메모
  const invalid: number[] = [];
  let memoColumn = -1;
  rows.forEach((row, index) => {
    const cells = Array.from(row, (cell) => String(cell ?? "").trim());
    if (!cells.some(Boolean)) return;
    const phone = cells.flatMap((cell, column) => column === memoColumn ? [] : parsePhones(cell).phones)[0];
    if (phone) {
      found.set(phone, (cells[memoColumn] || defaultMemo).trim().slice(0, 100));
    } else if (index === 0) {
      memoColumn = cells.findIndex((cell) => cell.includes("메모"));
    } else {
      invalid.push(index + 1);
    }
  });
  return { entries: [...found].map(([phone, memo]) => ({ phone, memo })), invalid };
}

/**
 * 추첨에서 빼는 번호: 제외번호 + 같은 경품에 당첨된 적이 있는 번호(회차 무관, 취소 포함).
 * 커피는 이전 주 당첨자가 다음 주에도 빠지고, 다른 경품 당첨은 영향이 없다.
 */
export function blockedPhones(prize: Prize, winners: readonly { prize: string; phone: string }[], excluded: readonly { phone: string }[]) {
  return new Set([...excluded, ...winners.filter((row) => row.prize === prize)].map((row) => row.phone));
}

/** 이벤트 결과 통계: 전체·참여 인원·상태별·지점별·일별(한국시간) 응모 수 */
export function summarizeEntries(entries: readonly { phone: string; store: string; status: string; created_at: string }[]) {
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" });
  const tally = (key: (entry: (typeof entries)[number]) => string) => {
    const counts = new Map<string, number>();
    for (const entry of entries) counts.set(key(entry), (counts.get(key(entry)) ?? 0) + 1);
    return [...counts];
  };
  return {
    total: entries.length,
    people: new Set(entries.map((entry) => entry.phone)).size,
    statuses: Object.fromEntries(tally((entry) => entry.status)),
    stores: tally((entry) => entry.store).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko")),
    days: tally((entry) => day.format(new Date(entry.created_at))).sort((a, b) => a[0].localeCompare(b[0])),
  };
}

/**
 * 무작위로 섞은 뒤 번호가 겹치지 않게 count 명을 고른다.
 * weighted: 응모 건마다 한 표(많이 응모할수록 유리). 아니면 번호마다 한 표.
 */
export function pickWinners<T extends { phone: string }>(
  entries: readonly T[],
  { count, blocked, weighted, random = randomInt }: { count: number; blocked: ReadonlySet<string>; weighted: boolean; random?: (max: number) => number },
): T[] {
  const eligible = entries.filter((entry) => !blocked.has(entry.phone));
  const tickets = weighted ? eligible : [...new Map(eligible.map((entry) => [entry.phone, entry])).values()];
  for (let i = tickets.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [tickets[i], tickets[j]] = [tickets[j], tickets[i]];
  }
  const winners = new Map<string, T>();
  for (const ticket of tickets) {
    if (winners.size >= count) break;
    if (!winners.has(ticket.phone)) winners.set(ticket.phone, ticket);
  }
  return [...winners.values()];
}
