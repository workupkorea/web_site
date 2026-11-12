"use client";

// 익명 방문자 식별용 랜덤 id (localStorage). 개인정보 아님.
const VID_KEY = "wu_vid";
function getVisitorId(): string {
  try {
    let v = localStorage.getItem(VID_KEY);
    if (!v) {
      v = crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(VID_KEY, v);
    }
    return v;
  } catch {
    return "";
  }
}

export type TrackStore = { id?: number | null; name?: string | null };
export type StoreEventType =
  | "view"
  | "list_click"
  | "directions_kakao"
  | "directions_naver"
  | "call"
  | "kakao_chat";

declare global {
  interface Window { dataLayer?: Record<string, unknown>[] }
}

// GTM에서 커스텀 이벤트 트리거로 잡을 수 있도록 dataLayer에도 함께 기록.
// (오프라인 전환 이벤트 — 전화문의/카톡상담/길찾기/제품문의 — GA4 전환 설정용)
export function pushConversionEvent(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

// 매장 이벤트 종류 → GTM에 넘길 전환 이벤트명 매핑 (view/list_click은 조회일 뿐이라 전환 이벤트 제외)
const GTM_CONVERSION_EVENT: Partial<Record<StoreEventType, string>> = {
  call: "call_click",
  kakao_chat: "kakao_chat_click",
  directions_kakao: "directions_click",
  directions_naver: "directions_click",
};

// ── 상단 메뉴 클릭 · 이동 페이지 체류시간 ─────────────────────────
const NAV_PENDING_KEY = "wu_nav_pending";
export type NavPending = { label: string; href: string; path: string };

function sendNav(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify({ ...payload, visitor_id: getVisitorId() });
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon && navigator.sendBeacon("/api/track/nav", blob)) return;
    fetch("/api/track/nav", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* 트래킹 실패는 무시 */
  }
}

// 메뉴 클릭 기록. 같은 탭에서 사이트 내부로 이동하는 경우에만 '이동 페이지 체류시간' 측정 대기를 걸어둔다.
export function trackNavClick(label: string, href: string, newTab = false) {
  if (typeof window === "undefined" || !label) return;
  sendNav({ event_type: "nav_click", nav_label: label, href, path: window.location.pathname });
  try {
    if (!newTab && href.startsWith("/")) {
      const pending: NavPending = { label, href, path: href.split(/[?#]/)[0] };
      sessionStorage.setItem(NAV_PENDING_KEY, JSON.stringify(pending));
    } else {
      sessionStorage.removeItem(NAV_PENDING_KEY);
    }
  } catch {
    /* sessionStorage 불가 시 클릭만 기록 */
  }
}

// 메인 페이지 본문 클릭 기록 (섹션 · 요소명). 체류시간 측정은 하지 않는다.
export function trackHomeClick(label: string, href: string) {
  if (typeof window === "undefined" || !label) return;
  sendNav({ event_type: "home_click", nav_label: label, href, path: "/" });
}

export function takeNavPending(pathname: string): NavPending | null {
  try {
    const raw = sessionStorage.getItem(NAV_PENDING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(NAV_PENDING_KEY);
    const p = JSON.parse(raw) as NavPending;
    return p.path === pathname ? p : null;
  } catch {
    return null;
  }
}

export function trackNavDwell(p: NavPending, durationSec: number) {
  if (typeof window === "undefined" || durationSec < 1) return;
  sendNav({ event_type: "dwell", nav_label: p.label, href: p.href, path: p.path, duration_sec: durationSec });
}

// 매장 이벤트 기록. 화면 이동을 막지 않도록 sendBeacon 우선 사용.
export function trackStoreEvent(eventType: StoreEventType, store?: TrackStore) {
  if (typeof window === "undefined") return;

  const gtmEvent = GTM_CONVERSION_EVENT[eventType];
  if (gtmEvent) {
    pushConversionEvent(gtmEvent, {
      method: eventType.startsWith("directions_") ? eventType.replace("directions_", "") : undefined,
      store_id: store?.id ?? null,
      store_name: store?.name ?? "",
    });
  }

  try {
    const payload = JSON.stringify({
      event_type: eventType,
      store_id: store?.id ?? null,
      store_name: store?.name ?? "",
      path: window.location.pathname,
      visitor_id: getVisitorId(),
    });
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon && navigator.sendBeacon("/api/track", blob)) return;
    fetch("/api/track", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* 트래킹 실패는 무시 */
  }
}
