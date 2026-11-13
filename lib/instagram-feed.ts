// 인스타그램 피드(큐레이션) — 관리자가 게시물 URL을 골라 등록하면
// 상품페이지 하단에 그리드로 노출. site_settings의 'instagram_feed' 섹션에 저장.

export type InstagramPost = { url: string };

export type InstagramFeedConfig = {
  is_visible: boolean;      // 섹션 노출 on/off
  title: string;            // 섹션 제목
  subtitle: string;         // 부제(선택)
  account: string;          // 계정(@아이디 또는 URL) — 팔로우 링크용(선택)
  columns_desktop: 3 | 4;   // 데스크탑 열 수
  posts: InstagramPost[];   // 게시물 목록(순서 = 노출 순서)
};

export const DEFAULT_INSTAGRAM_FEED: InstagramFeedConfig = {
  is_visible: true,
  title: "인스타그램 속 워크업",
  subtitle: "실제 현장에서 만나는 워크업",
  account: "",
  columns_desktop: 4,
  posts: [],
};

export function normalizeInstagramFeed(raw: unknown): InstagramFeedConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_INSTAGRAM_FEED };
  const r = raw as Partial<InstagramFeedConfig>;
  return {
    is_visible: r.is_visible ?? DEFAULT_INSTAGRAM_FEED.is_visible,
    title: (r.title ?? DEFAULT_INSTAGRAM_FEED.title).toString(),
    subtitle: (r.subtitle ?? DEFAULT_INSTAGRAM_FEED.subtitle).toString(),
    account: (r.account ?? "").toString(),
    columns_desktop: r.columns_desktop === 3 ? 3 : 4,
    posts: Array.isArray(r.posts)
      ? r.posts
          .filter((p): p is InstagramPost => !!p && typeof p.url === "string" && p.url.trim() !== "")
          .map((p) => ({ url: p.url.trim() }))
      : [],
  };
}

// 게시물 URL → 종류(p/reel/tv) + 숏코드 파싱. 공개 게시물·릴스·IGTV 지원.
export function parseInstagramUrl(url: string): { type: "p" | "reel" | "tv"; shortcode: string } | null {
  try {
    const u = new URL(url.trim());
    if (!/(^|\.)instagram\.com$/.test(u.hostname)) return null;
    const m = u.pathname.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    if (!m) return null;
    const type = m[1] === "reels" ? "reel" : (m[1] as "p" | "reel" | "tv");
    return { type, shortcode: m[2] };
  } catch {
    return null;
  }
}

// 게시물 URL → iframe에 넣을 임베드 주소. 파싱 실패 시 null.
export function instagramEmbedSrc(url: string): string | null {
  const parsed = parseInstagramUrl(url);
  if (!parsed) return null;
  return `https://www.instagram.com/${parsed.type}/${parsed.shortcode}/embed`;
}

// 계정 문자열(@아이디 / 아이디 / 프로필 URL) → 핸들 + 프로필 URL. 비어있으면 null.
export function normalizeAccount(account: string): { handle: string; url: string } | null {
  const a = (account ?? "").trim();
  if (!a) return null;
  const m = a.match(/instagram\.com\/([A-Za-z0-9._]+)/);
  const handle = (m ? m[1] : a).replace(/^@/, "").replace(/\/+$/, "");
  if (!handle) return null;
  return { handle, url: `https://www.instagram.com/${handle}/` };
}
