// PC 히어로 패널 크기 규칙 — 사이트(FeatureHeroLayout)와 관리자 미리보기가 같은 식을 쓰도록 한 곳에 둔다.
export const HERO_PANEL_WIDTH_RATIO = 0.49947; // 화면 폭 대비 패널 폭
// 패널 최소 세로/가로 비율 — 화면이 가로로 납작해도 이미지 하단이 과하게 잘리지 않게 한다.
export const HERO_PANEL_MIN_ASPECT = 1.1;

/** 패널 높이(px). contentHeight를 모르면(관리자 미리보기) Infinity를 넘긴다. */
export function heroPanelHeight(viewportW: number, viewportH: number, contentHeight = Infinity): number {
  const minH = viewportW * HERO_PANEL_WIDTH_RATIO * HERO_PANEL_MIN_ASPECT;
  return Math.min(contentHeight, Math.max(viewportH, minH));
}
