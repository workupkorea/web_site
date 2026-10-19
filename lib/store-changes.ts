// 지점 오픈 예약 · 수정 내역 공용 로직 (서버 전용).
import type { SupabaseClient } from "@supabase/supabase-js";

export type StoreChange = { field: string; label: string; from: string; to: string };
export type StoreHistoryEntry = { at: string; by: string; changes: StoreChange[] };

const HISTORY_LIMIT = 20;
const VALUE_MAX_LEN = 40;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 비교 대상 필드. long=true 는 값이 길어 "변경됨"만 기록한다.
const TRACKED_FIELDS: { key: string; label: string; long?: boolean; bool?: boolean }[] = [
  { key: "name", label: "매장명" },
  { key: "store_code", label: "지점코드" },
  { key: "ship_name", label: "W지점명" },
  { key: "region", label: "지역" },
  { key: "address", label: "주소" },
  { key: "phone", label: "전화번호" },
  { key: "hours", label: "운영시간" },
  { key: "store_type", label: "매장유형" },
  { key: "brands", label: "취급브랜드" },
  { key: "parking", label: "주차" },
  { key: "is_active", label: "활성" },
  { key: "page_active", label: "스토어 페이지 노출" },
  { key: "open_date", label: "오픈 예정일" },
  { key: "closed_at", label: "폐업", bool: true },
  { key: "sort_order", label: "정렬순서" },
  { key: "kakao_channel_url", label: "카카오채널URL" },
  { key: "store_url", label: "스토어URL" },
  { key: "description", label: "매장소개", long: true },
  { key: "image_urls", label: "매장사진", long: true },
  { key: "product_ids", label: "판매제품", long: true },
];

// 한국 시간 기준 오늘 날짜 (YYYY-MM-DD)
export function todayKST(): string {
  return new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

// 오픈 예정일이 오늘 이후면 아직 오픈 전(비공개 대기)이다. 오픈일 당일부터 공개한다.
export function isOpenPending(openDate: string | null | undefined): boolean {
  return !!openDate && openDate > todayKST();
}

function norm(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "예" : "아니오";
  if (Array.isArray(v)) return v.join(", ");
  return String(v).trim();
}

function short(s: string): string {
  if (!s) return "(없음)";
  return s.length > VALUE_MAX_LEN ? s.slice(0, VALUE_MAX_LEN) + "…" : s;
}

// 저장 전/후 값을 비교해 변경된 항목 목록을 만든다.
export function diffStore(prev: Record<string, unknown>, next: Record<string, unknown>): StoreChange[] {
  const changes: StoreChange[] = [];
  for (const f of TRACKED_FIELDS) {
    // bool: 값 유무만 상태(예/아니오)로 비교·표기 (예: 폐업일 → 폐업 여부)
    const a = f.bool ? (prev[f.key] ? "예" : "아니오") : norm(prev[f.key]);
    const b = f.bool ? (next[f.key] ? "예" : "아니오") : norm(next[f.key]);
    if (a === b) continue;
    changes.push(
      f.long
        ? { field: f.key, label: f.label, from: "", to: "변경됨" }
        : { field: f.key, label: f.label, from: short(a), to: short(b) }
    );
  }
  return changes;
}

export function appendHistory(
  history: unknown,
  entry: StoreHistoryEntry
): StoreHistoryEntry[] {
  const list = Array.isArray(history) ? (history as StoreHistoryEntry[]) : [];
  return [entry, ...list].slice(0, HISTORY_LIMIT);
}

// 오픈일이 된(지난 경우 포함) 비공개 지점을 활성화한다.
// - 별도 크론 없이 공개/관리자 목록 조회 시 호출된다. 실패해도 조회를 막지 않는다.
// - 활성화 후 open_date 를 비워, 이후 수동으로 비활성화해도 다시 켜지지 않게 한다.
export async function activateDueStores(supabase: SupabaseClient): Promise<void> {
  try {
    const { data: due } = await supabase
      .from("stores")
      .select("id, change_history")
      .eq("is_active", false)
      .is("closed_at", null)
      .not("open_date", "is", null)
      .lte("open_date", todayKST());
    if (!due || due.length === 0) return;
    const now = new Date().toISOString();
    await Promise.all(
      due.map((s: { id: number; change_history: unknown }) =>
        supabase
          .from("stores")
          .update({
            is_active: true,
            activated_at: now,
            open_date: null,
            change_history: appendHistory(s.change_history, {
              at: now,
              by: "시스템",
              changes: [{ field: "is_active", label: "활성", from: "아니오", to: "예 (오픈일 자동 오픈)" }],
            }),
          })
          .eq("id", s.id)
      )
    );
  } catch {
    // 새 컬럼 미적용 등 — 조용히 무시
  }
}
