// 휴면 회원 판정 기준 — 크론(/api/cron/member-dormant)과 관리자 휴면 탭이 공유한다.
export const DORMANT_YEARS = 1;
const EXEMPT_GRADES = ["관리자", "S관리자"]; // 운영 계정은 자동 휴면 제외

export function dormantCutoff(now = new Date()): Date {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - DORMANT_YEARS);
  return d;
}

// 활성 회원 중 마지막 접속일(없으면 가입일)이 기준일보다 오래된 경우 휴면 대상.
export function isDormantCandidate(
  m: { status: string; grade?: string; last_login_at?: string | null; created_at: string },
  cutoff = dormantCutoff(),
): boolean {
  if (m.status !== "active") return false;
  if (m.grade && EXEMPT_GRADES.includes(m.grade)) return false;
  return new Date(m.last_login_at ?? m.created_at) < cutoff;
}
