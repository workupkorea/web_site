// PR룸(뉴스·홍보 소식) 게시판 — 타입 · 기본값 · 정규화.
// ⚠️ 클라이언트(관리자)와 서버(공개 페이지) 양쪽에서 import 되므로 서버 전용 코드 금지.
//    서버 캐시 조회는 lib/pr-room-server.ts.
//
// 데이터는 기존 패턴(site_settings 테이블, section="pr_room")에 JSON 으로 저장한다.
// 별도 테이블·마이그레이션 없이 footer/editorial 등과 동일하게 동작한다.

// 게시글 분류 — 공개 페이지(/pr)의 탭(공지사항 · 보도자료)으로 구분된다.
export type PrCategory = "notice" | "press";

export const PR_CATEGORIES: { value: PrCategory; label: string }[] = [
  { value: "press", label: "보도자료" },
  { value: "notice", label: "공지사항" },
];
export const DEFAULT_PR_CATEGORY: PrCategory = "notice";

export function prCategoryLabel(c: PrCategory): string {
  return PR_CATEGORIES.find((x) => x.value === c)?.label ?? "공지사항";
}

export type PrPost = {
  id: string;
  category: PrCategory; // 분류(없던 기존 글은 공지사항으로 간주)
  title: string;
  date: string;         // 표시용 날짜 문자열 (예: "2026.06.26")
  image_url: string;    // 대표 이미지 (이미지 안에는 텍스트를 넣지 않음 — 프로젝트 규칙)
  summary: string;      // 카드/목록용 짧은 설명
  body: string;         // 상세 본문 (줄바꿈 유지)
  link: string;         // 외부 링크 — 있으면 카드 클릭 시 외부로 이동(하이브리드), 없으면 상세 페이지
  is_visible: boolean;  // 공개 노출 여부
  sort_order: number;   // 정렬 순서(오름차순)
};

// 정렬 방식 — "date": 날짜 최신순 자동 정렬(기본), "manual": 관리자가 ↑↓로 직접 정한 순서(sort_order) 유지.
export type PrOrderMode = "date" | "manual";

export type PrRoomConfig = {
  title: string;        // 공개 페이지 헤더 제목
  subtitle: string;     // 공개 페이지 헤더 부제
  order_mode: PrOrderMode;
  posts: PrPost[];
};

export const DEFAULT_PR_ROOM: PrRoomConfig = {
  title: "공지사항",
  subtitle: "워크업의 새로운 소식과 이야기를 전해드립니다.",
  order_mode: "date",
  posts: [],
};

// "2026.10.23" · "2026. 09.04" 등 표시용 날짜 문자열 → 비교용 숫자(20261023). 해석 불가면 0(맨 뒤).
export function dateRank(date: string): number {
  const m = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(date);
  return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : 0;
}

// 날짜 문자열 ↔ <input type="date"> 값(YYYY-MM-DD) 변환
export function dateToIso(date: string): string {
  const m = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(date);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : "";
}
export function isoToDate(iso: string): string {
  return iso ? iso.replace(/-/g, ".") : "";
}

// date 모드면 날짜 최신순(같은 날짜는 기존 순서 유지), manual 모드면 입력 순서 그대로.
export function sortPosts(posts: PrPost[], mode: PrOrderMode): PrPost[] {
  if (mode !== "date") return posts;
  return [...posts].sort((a, b) => dateRank(b.date) - dateRank(a.date));
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

// 외부 링크는 http(s)만 허용(javascript:/data: 등 XSS 스킴 차단). 빈 값은 그대로 허용.
const HTTP_URL_RE = /^https?:\/\//i;
function safeLink(v: unknown): string {
  if (typeof v !== "string") return "";
  const u = v.trim();
  if (!u) return "";
  return HTTP_URL_RE.test(u) ? u : "";
}

// 본문은 관리자가 에디터로 작성한 HTML 이다. 관리자(신뢰 주체)만 작성하지만,
// 저장값을 공개 페이지에서 dangerouslySetInnerHTML 로 렌더하므로 위험 태그/속성을
// 의존성 없이 가볍게 제거한다(스크립트·이벤트 핸들러·javascript: 스킴).
export function sanitizeBodyHtml(v: unknown): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta)\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '$1="#"');
}

// 본문이 HTML(에디터 작성)인지, 옛 평문(줄바꿈 텍스트)인지 판별 — 렌더 분기에 사용.
export function isHtmlBody(v: string): boolean {
  return /<[a-z][\s\S]*>/i.test(v);
}

function normalizePost(raw: unknown, idx: number): PrPost | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  return {
    id: str(p.id) || `pr-${idx}`,
    category: p.category === "press" ? "press" : DEFAULT_PR_CATEGORY,
    title: str(p.title),
    date: str(p.date),
    image_url: str(p.image_url),
    summary: str(p.summary),
    body: sanitizeBodyHtml(p.body),
    link: safeLink(p.link),
    is_visible: bool(p.is_visible, true),
    sort_order: typeof p.sort_order === "number" ? p.sort_order : idx,
  };
}

// 저장 데이터가 일부 누락/구버전이어도 안전하게 동작하도록 항상 정규화한다.
export function normalizePrRoom(raw: unknown): PrRoomConfig {
  const c = (raw ?? {}) as Record<string, unknown>;
  const order_mode: PrOrderMode = c.order_mode === "manual" ? "manual" : "date";
  const posts = Array.isArray(c.posts)
    ? sortPosts(
        c.posts
          .map((p, i) => normalizePost(p, i))
          .filter((p): p is PrPost => p !== null)
          .sort((a, b) => a.sort_order - b.sort_order),
        order_mode
      )
    : [];
  return {
    title: str(c.title, DEFAULT_PR_ROOM.title),
    subtitle: str(c.subtitle, DEFAULT_PR_ROOM.subtitle),
    order_mode,
    posts,
  };
}

// 공개 노출용 게시글만 추린다(관리자 미리보기 제외).
export function visiblePosts(config: PrRoomConfig): PrPost[] {
  return config.posts.filter((p) => p.is_visible && p.image_url);
}
