// 메인 "캠페인 매거진" 섹션 — 공유 타입/기본값/정규화.
// 저장 위치: site_settings(section="home_magazine").config
// 관리자 편집기·서버 렌더링·캐시 헬퍼가 모두 이 파일을 참조한다.
//
// 구성: 커버 → 인터뷰 → 챕터(01~) → 비하인드 → 배우가 입은 제품 → 클로징(매장 방문 CTA)
// 이미지 안에는 텍스트를 넣지 않는다 — 모든 문구는 아래 필드로 HTML 레이어에 얹는다.

export const HOME_MAGAZINE_SECTION = "home_magazine";

export type MagazineImage = {
  url: string; // PC(기본) 이미지
  mobileUrl?: string; // 모바일 전용 크롭(없으면 url 사용)
  alt: string; // 대체 텍스트 — 배우명·착용 제품 등 의미 있게
  position?: string; // object-position (예: "50% 30%")
  mobilePosition?: string;
  // 한 자리에 사진을 여러 장 등록. random=true 면 방문할 때마다 무작위로, 아니면 항상 대표 사진만 노출.
  // PC 후보 = url + more / 모바일 후보 = mobileUrl + mobileMore — PC·모바일은 각자의 후보 안에서 따로 뽑는다.
  // (모바일 후보가 없으면 PC 후보를 잘라서 사용)
  random?: boolean;
  more?: MagazineImage[]; // PC용 추가 사진
  mobileMore?: MagazineImage[]; // 모바일용 추가 사진
};

// ── 자리별 이미지 규격 안내 (편집기 표시용) ──
// 화면은 object-cover 로 채우므로 권장 비율에서 벗어나도 깨지지 않고 가장자리만 잘린다.
// ratio: 권장 비율, px: 권장 픽셀(가로×세로), minW: 이 폭 미만이면 화질 경고.
export type MagazineSlotSpec = { ratio: string; px: string; minW: number; note?: string };
export const MAGAZINE_SLOT_SPECS = {
  // 아래 비율은 실제 화면에서 측정한 칸 크기 기준(PC 1440~1920 / 모바일 375)
  coverPc: { ratio: "16:9 가로", px: "2400×1350", minW: 1600, note: "16:9 비율 그대로 보입니다(잘리지 않음). 아래쪽엔 이름·버튼 글자가 올라가니 얼굴은 중앙~위쪽에" },
  coverMobile: { ratio: "9:16 세로", px: "1080×1920", minW: 750, note: "9:16 비율 그대로 보입니다(잘리지 않음). 얼굴은 위쪽 절반에(아래쪽은 글자가 올라감)" },
  interview: { ratio: "4:5 세로", px: "1200×1500", minW: 800, note: "PC는 7:9, 모바일은 8:9로 보입니다" },
  interviewMobile: { ratio: "4:5 세로", px: "1080×1350", minW: 750 },
  chapterSplit: { ratio: "3:2 가로", px: "2400×1600", minW: 1600, note: "PC는 화면 폭에 따라 1.1:1~1.5:1로 보여 좌우가 가운데 기준으로 잘립니다" },
  chapterSplitMobile: { ratio: "4:5 세로", px: "1080×1350", minW: 750 },
  chapterFullPc: { ratio: "2:1 와이드", px: "2400×1200", minW: 1600, note: "글자가 올라가는 오른쪽은 비워 두세요" },
  chapterFullMobile: { ratio: "7:10 세로", px: "1080×1550", minW: 750 },
  chapterMosaic: { ratio: "7:8 세로", px: "1400×1600", minW: 1000, note: "PC 가운데 큰 칸" },
  chapterMosaicMobile: { ratio: "4:9 길쭉한 세로", px: "1080×2400", minW: 750, note: "모바일에선 좁고 긴 칸이라 별도 컷 권장" },
  chapterSubSplit: { ratio: "4:5 세로", px: "1000×1250", minW: 600, note: "오른쪽 단에 세로로 2장 나란히 들어갑니다(소재·포켓 등 디테일)" },
  chapterSubMosaic: { ratio: "2:3 세로", px: "1000×1500", minW: 600, note: "칸마다 비율이 달라요 — 번호별 권장 참고" },
  behind: { ratio: "4:5 세로", px: "1600×2000", minW: 1000, note: "목록은 PC 정사각·모바일 4:5로 잘리고, 누르면 원본 비율로 크게 보입니다" },
  wearing: { ratio: "3:4 세로", px: "1000×1333", minW: 700, note: "제품이 보이도록 크롭" },
  closing: { ratio: "3.4:1 와이드", px: "2400×700", minW: 1600, note: "PC에서 아주 납작하게 보입니다 — 가로로 긴 사진(가운데 기준)" },
  closingMobile: { ratio: "1:1 정사각", px: "1080×1080", minW: 750, note: "위에 어두운 막(60%)이 덮입니다" },
} satisfies Record<string, MagazineSlotSpec>;
export type MagazineSlotKey = keyof typeof MAGAZINE_SLOT_SPECS;

// 보조 컷(B컷) 칸별 안내 — 레이아웃마다 칸의 모양과 개수가 다르다.
export const MAGAZINE_SUB_SLOTS: Record<"split" | "mosaic", string[]> = {
  split: ["오른쪽 단 왼쪽 · 4:5 세로 · 1000×1250", "오른쪽 단 오른쪽 · 4:5 세로 · 1000×1250"],
  mosaic: [
    "① PC 왼쪽 큰 칸 2:3 세로 · 1000×1500 / 모바일 우상단 2:3",
    "② PC 우상단 4:3 가로 · 1200×900 / 모바일 우하단 2:3",
    "③ PC 우하단 4:3 가로 · 1200×900 / 모바일에는 안 나옴",
  ],
};

export type MagazineCredit = { name: string; href?: string };

// split: 큰 컷 + 우측 텍스트·디테일컷 / fullbleed: 화면 전체 컷 위 텍스트 / mosaic: 3열 모자이크
export type MagazineChapterLayout = "split" | "fullbleed" | "mosaic";
export const MAGAZINE_CHAPTER_LAYOUTS: { value: MagazineChapterLayout; label: string }[] = [
  { value: "split", label: "분할형 (큰 컷 + 디테일)" },
  { value: "fullbleed", label: "풀블리드 (전체 화면 컷)" },
  { value: "mosaic", label: "모자이크 (3열)" },
];

export type MagazineChapter = {
  id: string;
  kicker: string; // 예: "Chapter · On Site"
  title: string; // 예: "현장의 하루를 입다"
  // 본문 — 엔터로 문단을 나눈다. 첫 문단은 리드(큰 글씨 도입부), 나머지는 본문으로 나온다.
  body?: string;
  quote?: string; // 풀 쿼트(큰 인용문) — 잡지식으로 본문 사이에 크게 들어간다
  layout: MagazineChapterLayout;
  main: MagazineImage; // A컷
  subs: MagazineImage[]; // B컷(디테일·보조)
  credits: MagazineCredit[]; // "착용" 크레딧
};

export type MagazineWearingItem = {
  id: string;
  image: MagazineImage;
  name: string;
  caption?: string; // 예: "CH.01 착용"
  href?: string; // 제품 상세(사이트 내부)
  chapterId?: string; // 연결된 챕터 — 챕터를 전환하면 이 챕터의 제품이 나온다(비우면 모든 챕터에서 공통 노출)
};

// ── 유튜브 영상 블록 ──
// 유튜브 영상 구간 — "섹션 순서"에서 정한 자리에 한꺼번에 나온다. 주소만 붙여넣으면 된다(영상·쇼츠 모두).
export type MagazineVideoItem = { id: string; url: string; title?: string; caption?: string };
export type MagazineVideoBlock = {
  id: string;
  kicker?: string; // 예: "Film"
  title: string; // 예: "촬영 현장 영상"
  layout: "single" | "grid"; // single: 크게 1개씩 / grid: 2~3열
  items: MagazineVideoItem[];
};

// 유튜브 주소 → 영상 ID. watch?v= / youtu.be/ / shorts/ / embed/ / live/ 지원. 인식 못 하면 null.
export function parseYouTubeUrl(input: string): { id: string; vertical: boolean } | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    const ID = /^[A-Za-z0-9_-]{11}$/;
    let id: string | null = null;
    let vertical = false;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([^/?]+)/);
      if (m) {
        id = m[2];
        vertical = m[1] === "shorts";
      } else if (u.pathname === "/watch") id = u.searchParams.get("v");
    }
    return id && ID.test(id) ? { id, vertical } : null;
  } catch {
    return null;
  }
}

// 커버 다음 구간들의 노출 순서·노출 여부 — 관리자가 "섹션 순서"에서 바꾼다.
export type MagazineSectionKey = "interview" | "chapters" | "videos" | "behind" | "wearing" | "closing";
export const MAGAZINE_SECTIONS: { key: MagazineSectionKey; label: string }[] = [
  { key: "interview", label: "인터뷰" },
  { key: "chapters", label: "챕터" },
  { key: "videos", label: "유튜브 영상" },
  { key: "behind", label: "비하인드" },
  { key: "wearing", label: "배우가 입은 제품" },
  { key: "closing", label: "클로징 (매장 방문 유도)" },
];
const SECTION_KEYS = new Set<string>(MAGAZINE_SECTIONS.map((x) => x.key));

// 메인 상단 배너 전환: "magazine" = 매거진 커버가 맨 위(기존 메인 비주얼은 자동 숨김),
// "existing" = 기존 메인 비주얼(슬라이딩 배너)이 맨 위(매거진 커버는 숨김).
export type MagazineTopBanner = "magazine" | "existing";

// 목차 항목 — target: 구간 키("interview"|"chapters"|"videos"|"behind"|"wearing"|"closing") / "ch:챕터id"(특정 챕터) / "custom"(직접 입력한 주소 href).
// target "chapters"는 모든 챕터를 한 줄에서 순차 롤링으로 보여준다(title·note는 무시).
export type MagazineContentsItem = { id: string; title: string; note: string; target: string; href?: string };

// ── 구분선(라인) 레이아웃 ──
// "섹션 순서"에 원하는 만큼 끼워 넣는 장식 구간. 순서 키는 "divider:<id>".
export type MagazineDividerStyle = "line" | "bold" | "double" | "dashed" | "label";
export type MagazineDividerSpace = "sm" | "md" | "lg";
export const MAGAZINE_DIVIDER_STYLES: { value: MagazineDividerStyle; label: string }[] = [
  { value: "line", label: "가는 선" },
  { value: "bold", label: "굵은 선" },
  { value: "double", label: "이중선" },
  { value: "dashed", label: "점선" },
  { value: "label", label: "글자가 들어가는 선" },
];
export const MAGAZINE_DIVIDER_SPACES: { value: MagazineDividerSpace; label: string }[] = [
  { value: "sm", label: "여백 좁게" },
  { value: "md", label: "여백 보통" },
  { value: "lg", label: "여백 넓게" },
];
export type MagazineDivider = {
  id: string;
  enabled: boolean;
  style: MagazineDividerStyle;
  label?: string; // style === "label" 일 때 선 가운데에 들어가는 글자
  space: MagazineDividerSpace;
  color?: string; // 선·글자 색(#rrggbb) — 기본 #1d1e20
  bg?: string; // 배경색(#rrggbb) — 기본 투명(매거진 기본 배경)
};
export type MagazineOrderKey = MagazineSectionKey | `divider:${string}`;
export const isDividerKey = (k: string): k is `divider:${string}` => k.startsWith("divider:");

// 구간별 배경색 — 각 구간의 글자색이 정해져 있어 밝은 구간(목차·인터뷰·챕터·착용 제품)은 밝은 색, 어두운 구간(영상·비하인드·클로징)은 어두운 색만 적용된다.
export type MagazineBgKey = "contents" | MagazineSectionKey;
export const MAGAZINE_BG_TONE: Record<MagazineBgKey, "light" | "dark"> = {
  contents: "light",
  interview: "light",
  chapters: "light",
  wearing: "light",
  videos: "dark",
  behind: "dark",
  closing: "dark",
};
export const MAGAZINE_BG_PRESETS: Record<"light" | "dark", { label: string; value: string }[]> = {
  light: [
    { label: "화이트", value: "#ffffff" },
    { label: "베이지", value: "#f6f4ef" },
    { label: "샌드", value: "#e9e2d6" },
    { label: "라이트 그레이", value: "#ecebe7" },
    { label: "스카이", value: "#e6edf3" },
  ],
  dark: [
    { label: "블랙", value: "#1d1e20" },
    { label: "차콜", value: "#303236" },
    { label: "네이비", value: "#152238" },
    { label: "올리브", value: "#3a3f35" },
    { label: "브라운", value: "#3b2f2a" },
  ],
};

// "#abc" / "#aabbcc" → "#aabbcc". 아니면 null.
export function normalizeHex(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return `#${h.toLowerCase()}`;
}
// 상대 휘도(0 어둠 ~ 1 밝음)
export function hexLuminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
// 구간 톤에 맞는 색인가 (밝은 구간은 밝은 색, 어두운 구간은 어두운 색만)
export function isBgCompatible(key: MagazineBgKey, hex: string): boolean {
  const l = hexLuminance(hex);
  return MAGAZINE_BG_TONE[key] === "light" ? l >= 0.5 : l <= 0.22;
}
// 화면에 적용할 배경색(없거나 톤이 안 맞으면 undefined → 기본 배경)
export function magazineBgFor(cfg: Pick<HomeMagazineConfig, "sectionBg">, key: MagazineBgKey): string | undefined {
  const hex = normalizeHex(cfg.sectionBg[key]);
  return hex && isBgCompatible(key, hex) ? hex : undefined;
}

export type HomeMagazineConfig = {
  sectionBg: Partial<Record<MagazineBgKey, string>>; // 구간별 배경색(#rrggbb)
  enabled: boolean; // 공개 여부 — 꺼져 있으면 메인에 렌더하지 않는다
  chaptersEnabled: boolean; // 챕터 구간 노출
  videosEnabled: boolean; // 유튜브 영상 구간 노출
  topBanner: MagazineTopBanner;
  // 커버 아래 목차(In this issue). items 가 없으면 노출 구간을 자동 나열하고, 있으면 관리자가 편집한 목록을 쓴다.
  contents: { enabled: boolean; heading?: string; subtitle?: string; items?: MagazineContentsItem[] };
  issue: { label: string; season: string }; // 예: "ISSUE 01", "2026 SUMMER CAMPAIGN"
  cover: {
    image: MagazineImage;
    eyebrow: string; // 예: "WORKUP with"
    actorName: string;
    quote: string;
    coverLines: string[]; // 우상단 목차 문구
  };
  interview: {
    enabled: boolean;
    image: MagazineImage;
    quote: string;
    qa: { q: string; a: string }[];
    linkLabel?: string;
    linkHref?: string;
  };
  sectionOrder: MagazineOrderKey[];
  dividers: MagazineDivider[];
  // 챕터 보기 방식: tabs = 상단 탭으로 한 챕터씩 전환(착용 제품도 챕터에 맞춰 바뀜) / stack = 모든 챕터를 세로로 펼침
  chapterView: "tabs" | "stack";
  chapters: MagazineChapter[];
  videos: MagazineVideoBlock[];
  // shuffle: 방문할 때마다 순서를 무작위로 섞는다
  behind: { enabled: boolean; title: string; images: MagazineImage[]; shuffle?: boolean };
  wearing: { enabled: boolean; title: string; items: MagazineWearingItem[] };
  closing: {
    enabled: boolean;
    image: MagazineImage;
    eyebrow: string;
    title: string;
    sub: string;
    blur?: number; // 배경 사진 흐림 정도(px, 0~24) — 산업 현장 사진 등을 흐릿하게 깔 때
    phone?: string; // 입력 시 "전화 문의" 버튼 노출 (tel:)
    kakaoUrl?: string; // 입력 시 "카카오톡 상담" 버튼 노출
  };
};

const EMPTY_IMAGE: MagazineImage = { url: "", alt: "" };

export const DEFAULT_HOME_MAGAZINE: HomeMagazineConfig = {
  sectionBg: {},
  enabled: false,
  chaptersEnabled: true,
  videosEnabled: true,
  topBanner: "magazine",
  contents: { enabled: true },
  issue: { label: "ISSUE 01", season: "2026 SUMMER CAMPAIGN" },
  cover: {
    image: EMPTY_IMAGE,
    eyebrow: "WORKUP with",
    actorName: "",
    quote: "",
    coverLines: [],
  },
  interview: { enabled: true, image: EMPTY_IMAGE, quote: "", qa: [] },
  sectionOrder: MAGAZINE_SECTIONS.map((x) => x.key),
  dividers: [],
  chapterView: "tabs",
  chapters: [],
  videos: [],
  behind: { enabled: true, title: "촬영 현장의 기록", images: [] },
  wearing: { enabled: true, title: "배우가 입은 제품", items: [] },
  closing: {
    enabled: true,
    image: EMPTY_IMAGE,
    eyebrow: "See it, try it.",
    title: "배우가 입은 그 옷, 매장에서 직접",
    sub: "전국 워크업 매장에서 사이즈와 핏을 확인하세요.",
  },
};

// ── 정규화 헬퍼: 저장본이 불완전·구버전이어도 렌더러가 안전하게 쓸 수 있게 만든다 ──

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const optStr = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

function normalizeImage(v: unknown, nested = false, keep = false): MagazineImage {
  const o = obj(v);
  const img: MagazineImage = {
    url: str(o.url).trim(),
    mobileUrl: optStr(o.mobileUrl),
    alt: str(o.alt),
    position: optStr(o.position),
    mobilePosition: optStr(o.mobilePosition),
  };
  // 추가 사진(more)은 한 단계만 — more 안의 more 는 무시
  if (!nested) {
    const more = arr(o.more)
      .map((m) => normalizeImage(m, true))
      .filter((m) => keep || m.url);
    if (more.length > 0) img.more = more;
    const mobileMore = arr(o.mobileMore)
      .map((m) => normalizeImage(m, true))
      .filter((m) => keep || m.url);
    if (mobileMore.length > 0) img.mobileMore = mobileMore;
    if (o.random === true) img.random = true;
  }
  return img;
}

// URL 없는 이미지는 렌더 대상에서 뺀다(빈 칸 노출 방지). 편집기에서는 입력 중인 빈 칸도 유지한다.
const normalizeImages = (v: unknown, keep = false): MagazineImage[] =>
  arr(v).map((x) => normalizeImage(x)).filter((i) => keep || i.url);

const VALID_LAYOUTS = new Set<MagazineChapterLayout>(MAGAZINE_CHAPTER_LAYOUTS.map((l) => l.value));

function normalizeChapter(v: unknown, idx: number, keep = false): MagazineChapter {
  const o = obj(v);
  const layout = str(o.layout) as MagazineChapterLayout;
  return {
    id: str(o.id) || `chapter-${idx + 1}`,
    kicker: str(o.kicker),
    title: str(o.title),
    body: optStr(o.body),
    quote: optStr(o.quote),
    layout: VALID_LAYOUTS.has(layout) ? layout : "split",
    // 챕터 메인 컷은 무작위 노출을 쓰지 않는다 — 챕터는 추가해서 늘리는 구조라 추가 사진·랜덤 값은 저장돼 있어도 무시
    main: normalizeImage(o.main, true, keep),
    subs: normalizeImages(o.subs, keep),
    credits: arr(o.credits)
      .map((c) => ({ name: keep ? str(obj(c).name) : str(obj(c).name).trim(), href: optStr(obj(c).href) }))
      .filter((c) => keep || c.name),
  };
}

// 저장된 순서를 검증: 알 수 없는/중복 키 제거, 빠진 구간은 기본 순서대로 끝에 붙인다.
function normalizeSectionOrder(v: unknown, dividerIds: string[]): MagazineOrderKey[] {
  const out: MagazineOrderKey[] = [];
  const dset = new Set(dividerIds);
  for (const k of arr(v)) {
    if (typeof k !== "string" || out.includes(k as MagazineOrderKey)) continue;
    if (SECTION_KEYS.has(k)) out.push(k as MagazineSectionKey);
    else if (isDividerKey(k) && dset.has(k.slice(8))) out.push(k);
  }
  // 새로 생긴 "유튜브 영상" 구간은 기존 저장본에서 챕터 바로 뒤에 둔다(없으면 끝)
  if (!out.includes("videos")) {
    const at = out.indexOf("chapters");
    out.splice(at >= 0 ? at + 1 : out.length, 0, "videos");
  }
  for (const x of MAGAZINE_SECTIONS) if (!out.includes(x.key)) out.push(x.key);
  // 순서에 빠진 구분선은 끝에 붙인다
  for (const id of dividerIds) if (!out.includes(`divider:${id}`)) out.push(`divider:${id}`);
  return out;
}

function normalizeDividers(v: unknown): MagazineDivider[] {
  const seen = new Set<string>();
  const out: MagazineDivider[] = [];
  arr(v).forEach((x, i) => {
    const o = obj(x);
    const id = str(o.id) || `d${i + 1}`;
    if (seen.has(id)) return;
    seen.add(id);
    const style = (["line", "bold", "double", "dashed", "label"] as const).find((t) => t === o.style) ?? "line";
    const space = (["sm", "md", "lg"] as const).find((t) => t === o.space) ?? "md";
    out.push({ id, enabled: bool(o.enabled, true), style, label: optStr(o.label), space, color: normalizeHex(o.color) ?? undefined, bg: normalizeHex(o.bg) ?? undefined });
  });
  return out;
}

function normalizeSectionBg(v: unknown): HomeMagazineConfig["sectionBg"] {
  const o = obj(v);
  const out: HomeMagazineConfig["sectionBg"] = {};
  for (const k of Object.keys(MAGAZINE_BG_TONE) as MagazineBgKey[]) {
    const hex = normalizeHex(o[k]);
    if (hex) out[k] = hex; // 톤 호환 여부는 화면 적용 시점(magazineBgFor)에 판단 — 편집기에서는 입력값을 그대로 보여준다
  }
  return out;
}

function normalizeContents(v: unknown): HomeMagazineConfig["contents"] {
  const o = obj(v);
  const out: HomeMagazineConfig["contents"] = { enabled: bool(o.enabled, true), heading: optStr(o.heading), subtitle: optStr(o.subtitle) };
  if (Array.isArray(o.items)) {
    out.items = o.items.map((x, i) => {
      const it = obj(x);
      return { id: str(it.id) || `toc-${i + 1}`, title: str(it.title), note: str(it.note), target: str(it.target) || "custom", href: optStr(it.href) };
    });
  }
  return out;
}

function normalizeVideoBlock(v: unknown, idx: number, keep: boolean): MagazineVideoBlock {
  const o = obj(v);
  return {
    id: str(o.id) || `video-${idx + 1}`,
    kicker: optStr(o.kicker),
    title: str(o.title),
    layout: o.layout === "grid" ? "grid" : "single",
    items: arr(o.items)
      .map((x, i) => {
        const it = obj(x);
        return { id: str(it.id) || `v-${idx + 1}-${i + 1}`, url: str(it.url).trim(), title: optStr(it.title), caption: optStr(it.caption) };
      })
      .filter((it) => keep || parseYouTubeUrl(it.url)),
  };
}

// 대체 텍스트(alt) — 편집기에서 입력받지 않는다. 화면에는 배우명·챕터 제목 등으로 자동 문구를 채운다(접근성).
function applyDefaultAlts(cfg: HomeMagazineConfig): HomeMagazineConfig {
  const actor = cfg.cover.actorName.trim() || "워크업 캠페인";
  const alt = (img: MagazineImage, text: string): MagazineImage => ({
    ...img,
    alt: img.alt || text,
    ...(img.more ? { more: img.more.map((m) => ({ ...m, alt: m.alt || text })) } : {}),
    ...(img.mobileMore ? { mobileMore: img.mobileMore.map((m) => ({ ...m, alt: m.alt || text })) } : {}),
  });
  return {
    ...cfg,
    cover: { ...cfg.cover, image: alt(cfg.cover.image, `${actor} ${cfg.issue.label} 커버`) },
    interview: { ...cfg.interview, image: alt(cfg.interview.image, `${actor} 인터뷰`) },
    chapters: cfg.chapters.map((c) => ({
      ...c,
      main: alt(c.main, c.title || `${actor} 캠페인`),
      subs: c.subs.map((x, i) => alt(x, `${c.title || actor} 디테일 ${i + 1}`)),
    })),
    behind: { ...cfg.behind, images: cfg.behind.images.map((x, i) => alt(x, `${cfg.behind.title || "촬영 현장"} ${i + 1}`)) },
    wearing: { ...cfg.wearing, items: cfg.wearing.items.map((it) => ({ ...it, image: alt(it.image, it.name) })) },
    closing: { ...cfg.closing, image: alt(cfg.closing.image, "워크업 매장 방문 안내") },
  };
}

// forEditor: 관리자 편집기용 — 입력 중인 빈 항목(사진 없는 챕터·빈 문답 등)을 지우지 않는다.
export function normalizeHomeMagazine(raw: unknown, opts: { forEditor?: boolean } = {}): HomeMagazineConfig {
  const cfg = normalizeHomeMagazineBase(raw, opts);
  return opts.forEditor ? cfg : applyDefaultAlts(cfg);
}

function normalizeHomeMagazineBase(raw: unknown, { forEditor = false }: { forEditor?: boolean } = {}): HomeMagazineConfig {
  const keep = forEditor;
  const r = obj(raw);
  const d = DEFAULT_HOME_MAGAZINE;
  const issue = obj(r.issue);
  const cover = obj(r.cover);
  const interview = obj(r.interview);
  const behind = obj(r.behind);
  const wearing = obj(r.wearing);
  const closing = obj(r.closing);
  const dividers = normalizeDividers(r.dividers);

  return {
    enabled: bool(r.enabled, d.enabled),
    sectionBg: normalizeSectionBg(r.sectionBg),
    chaptersEnabled: bool(r.chaptersEnabled, true),
    videosEnabled: bool(r.videosEnabled, true),
    topBanner: r.topBanner === "existing" ? "existing" : "magazine",
    contents: normalizeContents(r.contents),
    issue: { label: str(issue.label, d.issue.label), season: str(issue.season, d.issue.season) },
    cover: {
      image: normalizeImage(cover.image, false, keep),
      eyebrow: str(cover.eyebrow, d.cover.eyebrow),
      actorName: str(cover.actorName),
      quote: str(cover.quote),
      coverLines: arr(cover.coverLines).map((l) => str(l).trim()).filter((l) => keep || l),
    },
    interview: {
      enabled: bool(interview.enabled, d.interview.enabled),
      image: normalizeImage(interview.image, false, keep),
      quote: str(interview.quote),
      qa: arr(interview.qa)
        .map((x) => ({ q: str(obj(x).q), a: str(obj(x).a) }))
        .filter((x) => keep || (x.q.trim() && x.a.trim())),
      linkLabel: optStr(interview.linkLabel),
      linkHref: optStr(interview.linkHref),
    },
    // 메인 컷이 없는 챕터는 렌더하지 않는다
    chapters: arr(r.chapters)
      .map((c, i) => normalizeChapter(c, i, keep))
      .filter((c) => keep || c.main.url),
    sectionOrder: normalizeSectionOrder(r.sectionOrder, dividers.map((d) => d.id)),
    dividers,
    chapterView: r.chapterView === "stack" ? "stack" : "tabs",
    videos: arr(r.videos)
      .map((b, i) => normalizeVideoBlock(b, i, keep))
      .filter((b) => keep || b.items.length > 0),
    behind: {
      enabled: bool(behind.enabled, d.behind.enabled),
      title: str(behind.title, d.behind.title),
      images: normalizeImages(behind.images, keep),
      shuffle: behind.shuffle === true,
    },
    wearing: {
      enabled: bool(wearing.enabled, d.wearing.enabled),
      title: str(wearing.title, d.wearing.title),
      items: arr(wearing.items)
        .map((x, i) => {
          const o = obj(x);
          return {
            id: str(o.id) || `wearing-${i + 1}`,
            image: normalizeImage(o.image, false, keep),
            name: keep ? str(o.name) : str(o.name).trim(),
            caption: optStr(o.caption),
            href: optStr(o.href),
            chapterId: optStr(o.chapterId),
          };
        })
        .filter((x) => keep || (x.image.url && x.name)),
    },
    closing: {
      enabled: bool(closing.enabled, d.closing.enabled),
      image: normalizeImage(closing.image, false, keep),
      eyebrow: str(closing.eyebrow, d.closing.eyebrow),
      title: str(closing.title, d.closing.title),
      sub: str(closing.sub, d.closing.sub),
      blur: typeof closing.blur === "number" && closing.blur > 0 ? Math.min(24, Math.round(closing.blur)) : undefined,
      phone: optStr(closing.phone),
      kakaoUrl: optStr(closing.kakaoUrl),
    },
  };
}

// 메인에 노출 가능한 상태인가 — 공개 ON + 커버 이미지·배우명이 있어야 한다.
// (반쯤 입력된 매거진이 메인에 노출되는 것을 막는다)
export function isMagazinePublishable(cfg: HomeMagazineConfig): boolean {
  // 기존 배너를 상단으로 쓰는 모드에서는 커버 입력이 필요 없다.
  if (!cfg.enabled) return false;
  return cfg.topBanner === "existing" || (!!cfg.cover.image.url && !!cfg.cover.actorName.trim());
}

// ── 배치 미리보기용: 비어 있는 자리를 회색 안내 블록으로 채운다 ──
// 관리자 미리보기 전용(공개 화면에는 쓰지 않는다 — 공개 화면은 비어 있으면 구간을 숨긴다).
// 안내 블록에는 자리 이름·권장 비율·크기가 적혀 있어 사진을 어디에 어떻게 넣을지 바로 알 수 있다.
const PH_COLORS = ["#a7a397", "#c6bfb2", "#9da1a4", "#b3b8a6", "#8b8880", "#cfc8bc"];

function placeholderImage(label: string, spec: MagazineSlotSpec, idx = 0): MagazineImage {
  const [w, h] = spec.px.split("×").map(Number);
  const fs = Math.round(Math.min(w, h) / 16);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'>` +
    `<rect width='100%' height='100%' fill='${PH_COLORS[idx % PH_COLORS.length]}'/>` +
    `<text x='50%' y='47%' text-anchor='middle' font-family='sans-serif' font-weight='700' font-size='${fs}' fill='#fff'>${label}</text>` +
    `<text x='50%' y='${47 + (fs / h) * 130}%' text-anchor='middle' font-family='sans-serif' font-size='${Math.round(fs * 0.7)}' fill='#fff' fill-opacity='.85'>${spec.ratio} · ${spec.px}px</text>` +
    `</svg>`;
  return { url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, alt: `(빈 자리) ${label}` };
}

export function fillMagazinePlaceholders(cfg: HomeMagazineConfig): HomeMagazineConfig {
  const S = MAGAZINE_SLOT_SPECS;
  let n = 0;
  const ph = (label: string, spec: MagazineSlotSpec) => placeholderImage(label, spec, n++);
  const fill = (img: MagazineImage, label: string, spec: MagazineSlotSpec) => (img.url ? img : { ...img, ...ph(label, spec) });
  const fillList = (list: MagazineImage[], count: number, label: string, spec: MagazineSlotSpec) => {
    const out = [...list];
    while (out.length < count) out.push(ph(`${label} ${out.length + 1}`, spec));
    return out;
  };

  const chapters: MagazineChapter[] =
    cfg.chapters.length > 0
      ? cfg.chapters
      : (["split", "fullbleed", "mosaic"] as const).map((layout, i) => ({
          id: `sample-${i + 1}`,
          kicker: ["Chapter · On Site", "Chapter · Commute", "Chapter · Weekend"][i],
          body: "리드 문단이 여기에 크게 들어갑니다. 챕터의 분위기를 두세 줄로 소개하세요.\n본문 문단이 이어집니다. 엔터로 문단을 나눌 수 있습니다.",
          quote: i === 0 ? "큰 인용문(풀 쿼트)이 여기에 들어갑니다." : undefined,
          title: ["현장의 하루를 입다", "출근길에도 그대로 괜찮은 옷", "주말, 일하지 않는 날에도"][i],
          layout,
          main: { url: "", alt: "" },
          subs: [],
          credits: [{ name: "제품 태그" }],
        }));

  return {
    ...cfg,
    cover: {
      ...cfg.cover,
      image: fill(cfg.cover.image, "커버 (A컷)", S.coverPc),
      actorName: cfg.cover.actorName.trim() || "배우 이름",
      quote: cfg.cover.quote || "배우 한마디가 여기에 들어갑니다.",
      coverLines: cfg.cover.coverLines.length ? cfg.cover.coverLines : ["INTERVIEW", "CHAPTER 01–03", "BEHIND THE SCENES"],
    },
    interview: {
      ...cfg.interview,
      image: fill(cfg.interview.image, "인터뷰 사진", S.interview),
      quote: cfg.interview.quote || "배우의 인터뷰 인용구가 크게 들어갑니다.",
      qa: cfg.interview.qa.length ? cfg.interview.qa : [{ q: "질문이 들어갑니다", a: "답변이 들어갑니다." }],
    },
    chapters: chapters.map((c) => {
      const subCount = c.layout === "split" ? 2 : c.layout === "mosaic" ? 3 : 0;
      const subSpec = c.layout === "split" ? S.chapterSubSplit : S.chapterSubMosaic;
      const mainSpec = c.layout === "fullbleed" ? S.chapterFullPc : c.layout === "mosaic" ? S.chapterMosaic : S.chapterSplit;
      return {
        ...c,
        title: c.title || "챕터 제목",
        kicker: c.kicker || "Chapter",
        main: fill(c.main, "메인 컷 (A컷)", mainSpec),
        subs: fillList(c.subs, subCount, "보조 컷", subSpec),
      };
    }),
    behind: { ...cfg.behind, images: cfg.behind.images.length ? cfg.behind.images : fillList([], 12, "비하인드", S.behind) },
    wearing: {
      ...cfg.wearing,
      items: cfg.wearing.items.length
        ? cfg.wearing.items
        : [1, 2, 3, 4].map((i) => ({ id: `sample-w${i}`, image: ph(`착용 제품 ${i}`, S.wearing), name: `제품명 ${i}`, caption: "CH.01 착용" })),
    },
    closing: { ...cfg.closing, image: fill(cfg.closing.image, "클로징 배경", S.closing) },
  };
}

// 구간별 노출 여부 — 섹션 순서 카드의 노출 체크와 화면·목차가 같은 기준을 쓴다.
export function isSectionEnabled(cfg: HomeMagazineConfig, key: MagazineOrderKey): boolean {
  if (isDividerKey(key)) return cfg.dividers.find((d) => d.id === key.slice(8))?.enabled ?? false;
  switch (key) {
    case "interview": return cfg.interview.enabled;
    case "chapters": return cfg.chaptersEnabled;
    case "videos": return cfg.videosEnabled;
    case "behind": return cfg.behind.enabled;
    case "wearing": return cfg.wearing.enabled;
    case "closing": return cfg.closing.enabled;
  }
}
export function withSectionEnabled(cfg: HomeMagazineConfig, key: MagazineOrderKey, on: boolean): HomeMagazineConfig {
  if (isDividerKey(key)) return { ...cfg, dividers: cfg.dividers.map((d) => (d.id === key.slice(8) ? { ...d, enabled: on } : d)) };
  switch (key) {
    case "interview": return { ...cfg, interview: { ...cfg.interview, enabled: on } };
    case "chapters": return { ...cfg, chaptersEnabled: on };
    case "videos": return { ...cfg, videosEnabled: on };
    case "behind": return { ...cfg, behind: { ...cfg.behind, enabled: on } };
    case "wearing": return { ...cfg, wearing: { ...cfg.wearing, enabled: on } };
    case "closing": return { ...cfg, closing: { ...cfg.closing, enabled: on } };
  }
}

// ── 목차 ──
// 현재 노출 구간을 섹션 순서대로 자동 나열한 목차 항목(편집기에서 "직접 편집"으로 전환할 때의 시작 목록이기도 하다)
export function buildAutoContentsItems(cfg: HomeMagazineConfig): MagazineContentsItem[] {
  const out: MagazineContentsItem[] = [];
  for (const key of cfg.sectionOrder) {
    if (key === "interview") out.push({ id: "toc-interview", title: "Interview", note: cfg.interview.quote, target: "interview" });
    else if (key === "chapters") out.push({ id: "toc-chapters", title: "Chapters", note: "", target: "chapters" });
    else if (key === "behind") out.push({ id: "toc-behind", title: cfg.behind.title, note: "Behind the scenes", target: "behind" });
    else if (key === "wearing") out.push({ id: "toc-wearing", title: cfg.wearing.title, note: "Wearing", target: "wearing" });
  }
  return out.filter((it) => isContentsItemAvailable(cfg, it));
}

// 항목이 가리키는 구간이 실제로 노출될 때만 목차에 보여준다
export function isContentsItemAvailable(cfg: HomeMagazineConfig, it: MagazineContentsItem): boolean {
  if (it.target === "custom") return !!it.href;
  if (it.target.startsWith("ch:")) return cfg.chaptersEnabled && cfg.chapters.some((c) => `ch:${c.id}` === it.target);
  switch (it.target) {
    case "interview": return cfg.interview.enabled && !!cfg.interview.image.url && !!cfg.interview.quote;
    case "chapters": return cfg.chaptersEnabled && cfg.chapters.length > 0;
    case "videos": return cfg.videosEnabled && cfg.videos.length > 0;
    case "behind": return cfg.behind.enabled && cfg.behind.images.length > 0;
    case "wearing": return cfg.wearing.enabled && cfg.wearing.items.length > 0;
    case "closing": return cfg.closing.enabled;
    default: return false;
  }
}

// 항목의 이동 주소(앵커)
export function contentsItemHref(it: MagazineContentsItem): string {
  if (it.target === "custom") return it.href ?? "#";
  if (it.target.startsWith("ch:")) return `#mag-chapter-${it.target.slice(3)}`;
  return `#mag-${it.target}`;
}
