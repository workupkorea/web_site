// 오류 수정 내역(fix_logs) 공용 타입·상수·입력 정리 — API와 관리자 화면이 함께 쓴다.
export const FIX_LOG_TARGETS = ["출고패스", "입고스케쥴", "기타"] as const;
export const FIX_LOG_STATUSES = ["조치완료", "재발방지 진행중"] as const;

export type FixLog = {
  id: number;
  target: string;
  title: string;
  occurred_on: string | null;
  resolved_on: string | null;
  symptom: string | null;
  cause: string | null;
  action_taken: string | null;
  impact: string | null;
  prevention: string | null;
  status: string;
  author_name: string;
  created_at: string;
  updated_at: string;
};

export const FIX_LOG_FIELDS = "id, target, title, occurred_on, resolved_on, symptom, cause, action_taken, impact, prevention, status, author_name, created_at, updated_at";

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

// 요청 본문에서 허용된 필드만 뽑는다(임의 컬럼 주입 방지).
export function pickFixLogBody(b: Record<string, unknown>) {
  const target = FIX_LOG_TARGETS.find((t) => t === b.target) ?? "기타";
  const status = FIX_LOG_STATUSES.find((s) => s === b.status) ?? "조치완료";
  return {
    target,
    status,
    title: str(b.title),
    occurred_on: str(b.occurred_on),
    resolved_on: str(b.resolved_on),
    symptom: str(b.symptom),
    cause: str(b.cause),
    action_taken: str(b.action_taken),
    impact: str(b.impact),
    prevention: str(b.prevention),
  };
}
