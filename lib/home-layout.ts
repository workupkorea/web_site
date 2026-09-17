// 메인 페이지 섹션 배치(순서·노출) — 공유 레지스트리/타입.
// 관리자 페이지·서버 렌더링·캐시 헬퍼가 모두 이 파일을 참조한다.

export type HomeSectionKey =
  | "hero"
  | "brandLogos"
  | "newArrivals"
  | "category"
  | "editorial"
  | "people"
  | "instagram";

export type HomeSectionMeta = {
  key: HomeSectionKey;
  label: string; // 관리자에 표시되는 이름
  description: string; // 관리자 보조 설명
  editHref?: string; // 해당 섹션 내용 편집 페이지 (없으면 코드에서만 관리)
};

// 배치 가능한 섹션 레지스트리 — 정의 순서 = 기본 노출 순서.
// 섹션을 새로 추가하면 여기에 한 줄 추가하면 된다(저장된 설정에도 자동으로 끝에 노출됨).
export const HOME_SECTIONS: HomeSectionMeta[] = [
  { key: "hero", label: "메인 비주얼", description: "최상단 히어로 영역", editHref: "/admin/main/visual" },
  { key: "brandLogos", label: "브랜드 로고", description: "매장검색 아래 브랜드 로고 무한 마퀴", editHref: "/admin/main/brands" },
  { key: "newArrivals", label: "신상품", description: "‘신상품이 입고되었어요’ 영역", editHref: "/admin/main/new-arrivals" },
  { key: "category", label: "카테고리", description: "카테고리 그리드", editHref: "/admin/main/categories" },
  { key: "editorial", label: "기획전", description: "기획전(에디토리얼) 블록", editHref: "/admin/main/editorial" },
  { key: "people", label: "일하는 사람들 이야기", description: "MATE 인터뷰 티저", editHref: "/admin/main/people" },
  { key: "instagram", label: "인스타그램 피드", description: "@workup_official_kr 실시간 피드" },
];

export type HomeSectionLayout = { key: HomeSectionKey; visible: boolean };
export type HomeLayoutConfig = { sections: HomeSectionLayout[] };

export const DEFAULT_HOME_LAYOUT: HomeLayoutConfig = {
  sections: HOME_SECTIONS.map((s) => ({ key: s.key, visible: true })),
};

const VALID_KEYS = new Set<HomeSectionKey>(HOME_SECTIONS.map((s) => s.key));

// 저장된(불완전·구버전일 수 있는) 설정을 레지스트리와 머지한다.
// - 알 수 없는/중복 키 제거
// - 저장된 순서 보존
// - 레지스트리에 있으나 저장본에 없는 섹션은 기본 순서대로 끝에 노출
export function normalizeHomeLayout(raw: unknown): HomeLayoutConfig {
  const saved = (raw as Partial<HomeLayoutConfig> | null)?.sections;
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
  return { sections: result };
}
