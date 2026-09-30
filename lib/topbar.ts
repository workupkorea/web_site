// 상단 탑바(공지바) 설정 — 타입 / 기본값 / 정규화.
// ⚠️ 이 파일은 클라이언트(관리자 페이지)와 서버(배너) 양쪽에서 import 되므로 서버 전용 코드를 넣지 않는다.
//    서버 전용 조회 로직은 lib/topbar-server.ts 에 둔다.

// 관리자 탑바 ON/OFF 변경 시 발생시키는 브라우저 이벤트(detail: boolean) — 사이드바 상태 배지가 즉시 갱신된다.
export const TOPBAR_ENABLED_EVENT = "wu:topbar-enabled";

export type TopbarIconName =
  | "none"
  | "phone"
  | "chat"
  | "map"
  | "navigation"
  | "catalog"
  | "clock"
  | "star"
  | "tag"
  | "cart"
  | "link"
  | "heart"
  | "sparkle"
  | "truck"
  | "instagram";

export type TopbarItem = {
  id: string;
  label: string;
  href: string;
  icon: TopbarIconName;
  newTab?: boolean;
};

export type TopbarConfig = {
  enabled: boolean;
  // PC 설정
  height: number;           // px (40~80)
  font_size: number;        // px (9~24)
  // 모바일 설정
  mobile_height: number;    // px (28~56)
  mobile_font_size: number; // px (8~14)
  // 공통
  bg_color: string;
  text_color: string;
  font_weight: number;
  letter_spacing: number;
  left_text: string;
  left_icon: TopbarIconName;
  left_link: string;
  items: TopbarItem[];
};

export const DEFAULT_TOPBAR: TopbarConfig = {
  enabled: true,
  height: 56,
  mobile_height: 40,
  bg_color: "#E5541B",
  text_color: "#ffffff",
  font_size: 11,
  mobile_font_size: 10,
  font_weight: 600,
  letter_spacing: 0.14,
  left_text: "EVERY WORKER EVERY WEAR",
  left_icon: "none",
  left_link: "",
  items: [
    { id: "default-catalog", label: "카탈로그", href: "/catalog", icon: "catalog", newTab: false },
    { id: "default-partnership", label: "가맹/제휴문의", href: "/partnership", icon: "chat", newTab: false },
  ],
};

// 관리자 아이콘 선택용 목록(라벨은 한국어).
export const ICON_OPTIONS: { name: TopbarIconName; label: string }[] = [
  { name: "none", label: "없음" },
  { name: "phone", label: "전화" },
  { name: "chat", label: "상담" },
  { name: "map", label: "위치" },
  { name: "navigation", label: "길찾기" },
  { name: "catalog", label: "카탈로그" },
  { name: "clock", label: "시간" },
  { name: "star", label: "별" },
  { name: "tag", label: "태그" },
  { name: "cart", label: "장바구니" },
  { name: "link", label: "링크" },
  { name: "heart", label: "하트" },
  { name: "sparkle", label: "이벤트" },
  { name: "truck", label: "배송" },
  { name: "instagram", label: "인스타" },
];

const ICON_SET = new Set<string>(ICON_OPTIONS.map((o) => o.name));

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function clampFloat(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function safeIcon(v: unknown): TopbarIconName {
  return typeof v === "string" && ICON_SET.has(v) ? (v as TopbarIconName) : "none";
}

const SAFE_SCHEME_RE = /^(https?:|tel:|mailto:)/i;
export function safeHref(v: unknown): string {
  if (typeof v !== "string") return "";
  const h = v.trim();
  if (!h) return "";
  if (h.startsWith("/") || h.startsWith("#")) return h;
  return SAFE_SCHEME_RE.test(h) ? h : "";
}

export function normalizeTopbar(raw: Partial<TopbarConfig> | null | undefined): TopbarConfig {
  const c = raw ?? {};
  const items = Array.isArray(c.items)
    ? c.items
        .filter((it): it is TopbarItem => !!it && typeof it === "object")
        .map((it, i) => ({
          id: typeof it.id === "string" && it.id ? it.id : `item-${i}`,
          label: typeof it.label === "string" ? it.label : "",
          href: safeHref(it.href),
          icon: safeIcon(it.icon),
          newTab: !!it.newTab,
        }))
        .filter((it) => it.label.trim() !== "" || it.href !== "")
    : DEFAULT_TOPBAR.items;

  return {
    enabled: typeof c.enabled === "boolean" ? c.enabled : DEFAULT_TOPBAR.enabled,
    height: clampNum(c.height, 40, 80, DEFAULT_TOPBAR.height),
    mobile_height: clampNum(c.mobile_height, 28, 56, DEFAULT_TOPBAR.mobile_height),
    bg_color: typeof c.bg_color === "string" && c.bg_color ? c.bg_color : DEFAULT_TOPBAR.bg_color,
    text_color: typeof c.text_color === "string" && c.text_color ? c.text_color : DEFAULT_TOPBAR.text_color,
    font_size: clampNum(c.font_size, 9, 24, DEFAULT_TOPBAR.font_size),
    mobile_font_size: clampNum(c.mobile_font_size, 8, 14, DEFAULT_TOPBAR.mobile_font_size),
    font_weight: clampNum(c.font_weight, 100, 900, DEFAULT_TOPBAR.font_weight),
    letter_spacing: clampFloat(c.letter_spacing, 0, 0.5, DEFAULT_TOPBAR.letter_spacing),
    left_text: typeof c.left_text === "string" ? c.left_text : DEFAULT_TOPBAR.left_text,
    left_icon: safeIcon(c.left_icon),
    left_link: safeHref(c.left_link),
    items,
  };
}
