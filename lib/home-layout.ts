// 메인 페이지 섹션 배치(순서·노출) — 공유 레지스트리/타입.
// 관리자 페이지·서버 렌더링·캐시 헬퍼가 모두 이 파일을 참조한다.

export type HomeSectionKey =
  | "magazine"
  | "hero"
  | "brandLogos"
  | "newArrivals"
  | "category"
  | "editorial"
  | "people"
  | "youtube"
  | "instagram";

export const HOME_MAIN_EXHIBITION_LABEL = "메인 기획전";
export const HOME_SUB_EXHIBITION_LABEL = "서브 기획전";
export const HOME_CLICK_SECTION_MAX_LENGTH = 56;
export const HOME_CLICK_ELEMENT_MAX_LENGTH = 40;

export function subExhibitionPath(href: string): string | undefined {
  const path = href.split(/[?#]/, 1)[0].replace(/\/$/, "");
  return /^\/products\/feature\/[^/]+\/[1-4]$/.test(path) ? path : undefined;
}

export function exhibitionClickSection(
  label: typeof HOME_MAIN_EXHIBITION_LABEL | typeof HOME_SUB_EXHIBITION_LABEL,
  title: string,
): string {
  const name = title.replace(/\s+/g, " ").trim().replaceAll(" · ", "·");
  return name ? `${label} - ${name}`.slice(0, HOME_CLICK_SECTION_MAX_LENGTH) : label;
}

export type HomeSectionMeta = {
  key: HomeSectionKey;
  label: string; // 관리자에 표시되는 이름
  description: string; // 관리자 보조 설명
  editHref?: string; // 해당 섹션 내용 편집 페이지 (없으면 코드에서만 관리)
};

// 배치 가능한 섹션 레지스트리 — 정의 순서 = 기본 노출 순서.
// 섹션을 새로 추가하면 여기에 한 줄 추가하면 된다(저장된 설정에도 자동으로 끝에 노출됨).
export const HOME_SECTIONS: HomeSectionMeta[] = [
  { key: "hero", label: "메인 비주얼", description: "최상단 히어로 영역", editHref: "/admin/main/home?tab=visual" },
  { key: "brandLogos", label: "브랜드 로고", description: "매장검색 아래 브랜드 로고 무한 마퀴", editHref: "/admin/main/home?tab=brands" },
  { key: "newArrivals", label: "신상품", description: "‘신상품이 입고되었어요’ 영역", editHref: "/admin/main/home?tab=new-arrivals" },
  { key: "category", label: "카테고리", description: "카테고리 그리드", editHref: "/admin/main/categories" },
  { key: "editorial", label: "기획전", description: "기획전(에디토리얼) 블록", editHref: "/admin/main/home?tab=editorial" },
  { key: "people", label: "일하는 사람들 이야기", description: "MATE 인터뷰 티저", editHref: "/admin/main/contents?tab=people" },
  { key: "youtube", label: "유튜브 롱폼", description: "@WorkUp_official 채널 최신 롱폼 영상(쇼츠 제외)" },
  { key: "instagram", label: "인스타그램 피드", description: "@workup_official_kr 실시간 피드" },
  // 저장본이 이미 있는 환경에선 normalizeHomeLayout 이 끝에 붙인다.
  // 공개 OFF·커버 미입력이면 렌더되지 않으므로 배포 직후 메인에는 변화가 없다.
  { key: "magazine", label: "캠페인 매거진", description: "배우 캠페인 매거진(커버·인터뷰·챕터·비하인드)", editHref: "/admin/main/home?tab=magazine" },
];

export type HomeSectionLayout = { key: HomeSectionKey; visible: boolean };

// 예약 메인(캠페인): start~end 동안만 이 배치·히어로 구성으로 메인 전체가 바뀐다.
// 그 외 기간에는 기본 배치(sections)로 보이고, 매거진은 숨겨진다. end 가 비면 계속 유지.
export type HomeCampaign = {
  start: string | null; // ISO. 비어 있으면 예약 미설정(기존 방식 그대로 동작)
  end: string | null;
  sections: HomeSectionLayout[]; // 예약 기간 중 메인 배치
  heroSlideIds: string[]; // 예약 기간에만 노출할 히어로 슬라이드 (기간 밖에서는 제외, 비면 히어로 변경 없음)
  // 예약 기간에만 노출할 기획전 블록(editorial_blocks 의 id). 메인 기획전 목록과 그 상세페이지에 함께 적용된다.
  // 기간 밖에서는 제외, 비면 기획전 변경 없음.
  editorialBlockIds: string[];
};

export type HomeLayoutConfig = { sections: HomeSectionLayout[]; campaign?: HomeCampaign | null };

export const DEFAULT_HOME_LAYOUT: HomeLayoutConfig = {
  sections: HOME_SECTIONS.map((s) => ({ key: s.key, visible: true })),
};

const VALID_KEYS = new Set<HomeSectionKey>(HOME_SECTIONS.map((s) => s.key));

// 히어로 슬라이드 필터: only=이 슬라이드만, exclude=이 슬라이드 제외
export type HeroFilter = { mode: "only" | "exclude"; ids: string[] } | null;

export type ResolvedHomeLayout = {
  sections: HomeSectionLayout[];
  heroFilter: HeroFilter;
  editorialFilter: HeroFilter; // 기획전 블록 id 필터 (heroFilter 와 같은 규칙)
  campaignActive: boolean;
};

// id 가 필터를 통과하는지 (필터 없으면 항상 통과)
export function passesIdFilter(filter: HeroFilter, id: string): boolean {
  if (!filter) return true;
  return filter.mode === "only" ? filter.ids.includes(id) : !filter.ids.includes(id);
}

function isoOrNull(v: unknown): string | null {
  return typeof v === "string" && !isNaN(new Date(v).getTime()) ? v : null;
}

export function isCampaignActive(c: HomeCampaign | null | undefined, nowMs: number): boolean {
  if (!c?.start) return false;
  const s = new Date(c.start).getTime();
  const e = c.end ? new Date(c.end).getTime() : Infinity;
  return s <= nowMs && nowMs <= e;
}

// 접속 시각 기준으로 실제 노출할 배치·히어로 구성을 결정한다. (캐시 밖, 요청마다 계산)
// - 예약 미설정: 저장된 기본 배치 그대로(기존 동작)
// - 예약 기간 중: 예약 배치 + 예약용 히어로만
// - 예약 설정됨 & 기간 밖: 기본 배치(매거진 숨김) + 예약용 히어로 제외
// force 로 예약 모습을 미리 볼 수 있다(관리자 미리보기용).
export function resolveHomeLayout(cfg: HomeLayoutConfig, nowMs: number = Date.now(), force?: boolean): ResolvedHomeLayout {
  const c = cfg.campaign;
  if (!c?.start) return { sections: cfg.sections, heroFilter: null, editorialFilter: null, campaignActive: false };
  // 예약 전용 히어로 슬라이드 선택 UI는 제거됨 — 저장돼 있던 heroSlideIds 는 무시한다(히어로는 항상 그대로).
  const ids: string[] = [];
  const edIds = c.editorialBlockIds;
  if (force || isCampaignActive(c, nowMs)) {
    return {
      sections: c.sections,
      heroFilter: ids.length ? { mode: "only", ids } : null,
      editorialFilter: edIds.length ? { mode: "only", ids: edIds } : null,
      campaignActive: true,
    };
  }
  return {
    sections: cfg.sections.map((s) => (s.key === "magazine" ? { ...s, visible: false } : s)),
    heroFilter: ids.length ? { mode: "exclude", ids } : null,
    editorialFilter: edIds.length ? { mode: "exclude", ids: edIds } : null,
    campaignActive: false,
  };
}

function normalizeSections(saved: unknown): HomeSectionLayout[] {
  const result: HomeSectionLayout[] = [];
  const seen = new Set<HomeSectionKey>();
  if (Array.isArray(saved)) {
    for (const s of saved) {
      const key = s?.key as HomeSectionKey;
      if (key && VALID_KEYS.has(key) && !seen.has(key)) {
        result.push({ key, visible: s?.visible !== false });
        seen.add(key);
      }
    }
  }
  for (const s of HOME_SECTIONS) {
    if (!seen.has(s.key)) result.push({ key: s.key, visible: true });
  }
  return result;
}

export function normalizeHomeLayout(raw: unknown): HomeLayoutConfig {
  const base = normalizeBaseLayout(raw);
  const rc = (raw as { campaign?: Partial<HomeCampaign> | null } | null)?.campaign;
  if (!rc || typeof rc !== "object") return base;
  return {
    ...base,
    campaign: {
      start: isoOrNull(rc.start),
      end: isoOrNull(rc.end),
      sections: normalizeSections(rc.sections),
      heroSlideIds: Array.isArray(rc.heroSlideIds) ? rc.heroSlideIds.filter((x): x is string => typeof x === "string") : [],
      editorialBlockIds: Array.isArray(rc.editorialBlockIds) ? rc.editorialBlockIds.filter((x): x is string => typeof x === "string") : [],
    },
  };
}

// 저장된(불완전·구버전일 수 있는) 설정을 레지스트리와 머지한다.
// - 알 수 없는/중복 키 제거
// - 저장된 순서 보존
// - 레지스트리에 있으나 저장본에 없는 섹션은 기본 순서대로 끝에 노출
function normalizeBaseLayout(raw: unknown): HomeLayoutConfig {
  return { sections: normalizeSections((raw as Partial<HomeLayoutConfig> | null)?.sections) };
}
