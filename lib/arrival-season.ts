// 입고일 → 시즌 코드. SS: 2~7월 / FW: 8~12월·익년 1월(1월은 전년도 FW).
// 시즌 경계 조정이 필요하면 이 함수만 고치면 됨. (관리자 목록·판매 아카이브가 함께 사용)
export function seasonOf(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return "";
  const y = +m[1], mo = +m[2];
  if (mo === 1)           return `${String(y - 1).slice(2)}FW`;
  if (mo >= 2 && mo <= 7) return `${String(y).slice(2)}SS`;
  return `${String(y).slice(2)}FW`;
}
