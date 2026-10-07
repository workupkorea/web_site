// 일괄출고금지점 판별 공통 유틸 (서버·클라이언트 공용 — node 전용 모듈 import 금지).
// wjumun 가맹점 목록의 "오픈일" 칸에 날짜 대신 이 문구가 들어있는 지점을 일괄출고금지점으로 본다.
// 지점 현황(site_settings.store_status)의 openedAt 값이 단일 기준이다.
export const BULK_SHIP_LABEL = "일괄출고금지";

// 띄어쓰기 차이("일괄 출고금지")는 같은 값으로 취급한다.
export function isBulkShip(openedAt: string | null | undefined): boolean {
  return (openedAt ?? "").replace(/\s+/g, "") === BULK_SHIP_LABEL;
}
