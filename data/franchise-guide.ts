// 창업안내(/franchise) 페이지 편집 콘텐츠 + 디자인(크기·자간·행간·색상·배경).
// 관리자가 site_settings("franchise_guide")에서 수정. 계약 가맹수는 실제 매장 수로 실시간 반영.
// 히어로/통계/혜택3개/조건4개/CTA 구조는 고정 — 텍스트/스타일/색만 편집.
import type { CSSProperties } from "react";

export type TextStyle = { size: number; color: string; tracking: number; leading: number };

export type StatItem = { value: string; label: string };
export type BenefitCard = { title: string; desc: string };
export type ConditionRow = { label: string; value: string };

export const STYLE_KEYS = [
  "title",
  "hero_eyebrow", "hero_title", "hero_desc",
  "stat_value", "stat_label",
  "section_title", "section_desc",
  "benefit_num", "benefit_title", "benefit_desc",
  "condition_label", "condition_value",
  "notice", "cta_title", "cta_desc",
] as const;
export type GuideStyleKey = (typeof STYLE_KEYS)[number];
export type GuideStyles = Record<GuideStyleKey, TextStyle>;

export type GuideColors = {
  page_bg: string; header_bg: string; card_bg: string; accent: string;
};

export type FranchiseGuideConfig = {
  title: string;                    // 상단 슬림바 문구
  hero_eyebrow: string;
  hero_title: string;              // 여러 줄(\n)
  hero_desc: string;                // "{count}" → 실제 매장 수로 치환
  hero_secondary_label: string;
  hero_bg_img: string;               // 히어로 전체 배경 이미지
  stats: StatItem[];                // 매출 · 마진율 (2개, 직접 편집)
  store_stat_label: string;         // "계약 매장" — 값은 실제 매장 수로 자동 계산
  store_stat_unit: string;          // "개"
  section_title: string;            // "워크업 창업이 다른 이유"
  section_desc: string;
  benefits: BenefitCard[];          // 3개
  conditions_title: string;         // "창업 기본 조건"
  conditions_desc: string;
  conditions: ConditionRow[];       // 4개
  notice: string;
  cta_title: string;
  cta_desc: string;
  cta_button_label: string;
  count_fallback: number;
  colors: GuideColors;
  styles: GuideStyles;
};

const ts = (size: number, color: string, tracking = 0, leading = 1.4): TextStyle => ({ size, color, tracking, leading });

export const DEFAULT_FRANCHISE_GUIDE: FranchiseGuideConfig = {
  title: "워크업 창업안내",
  hero_eyebrow: "WORKUP FRANCHISE",
  hero_title: "일하는 사람들의 발걸음이,\n매출이 되는 브랜드.",
  hero_desc: "전국 {count}개 매장이 선택한 워크웨어 전문 비즈니스입니다.\n상권 보호부터 상품 공급, 지역 마케팅까지 함께합니다.",
  hero_secondary_label: "필수 조건 보기",
  hero_bg_img: "",
  stats: [
    { value: "1.5억+", label: "평균 월매출" },
    { value: "31.5~35%", label: "판매 마진율" },
  ],
  store_stat_label: "계약 매장",
  store_stat_unit: "개",
  section_title: "워크업 창업이 다른 이유",
  section_desc: "복잡한 설명보다, 매장을 운영할 때 실제로 도움이 되는 조건만 담았습니다.",
  benefits: [
    { title: "안정적인 영업권", desc: "지점 간 5km 기준으로 불필요한 상권 경쟁을 줄이고, 매장이 오래 운영될 수 있는 기반을 만듭니다." },
    { title: "낮은 초기 부담", desc: "교육비와 가맹비 없이 시작합니다. 보여주기 위한 비용보다 매장과 상품에 집중할 수 있습니다." },
    { title: "현장 중심 운영 지원", desc: "상품 공급부터 매장 운영, 지역 마케팅까지 실제 매출과 연결되는 업무를 지원합니다." },
  ],
  conditions_title: "창업 기본 조건",
  conditions_desc: "상담 전에 꼭 확인해야 할 조건입니다.",
  conditions: [
    { label: "매장 규모", value: "70평 이상" },
    { label: "초도 상품", value: "약 1억 5천만원" },
    { label: "시설·인테리어", value: "약 3천만원" },
    { label: "상권 기준", value: "기존 지점과 5km 이상" },
  ],
  notice: "※ 매출, 수익, 개설 비용은 매장 위치와 규모, 운영 방식에 따라 달라질 수 있습니다.",
  cta_title: "내 지역에서 가능한지 먼저 확인하세요.",
  cta_desc: "상담 접수 후 담당자가 순차적으로 연락드립니다.",
  cta_button_label: "창업 상담 신청하기",
  count_fallback: 130,
  colors: { page_bg: "#0d0d0d", header_bg: "#f3f0ea", card_bg: "#151515", accent: "#ff4d00" },
  styles: {
    title: ts(20, "#111111", -0.02, 1.1),
    hero_eyebrow: ts(12, "#ff4d00", 0.16, 1.4),
    hero_title: ts(36, "#ffffff", -0.03, 1.2),
    hero_desc: ts(15, "#d8d8d5", 0, 1.7),
    stat_value: ts(30, "#ffffff", -0.02, 1),
    stat_label: ts(12, "#a5a5a0", 0, 1.4),
    section_title: ts(26, "#f5f5f3", -0.02, 1.2),
    section_desc: ts(13, "#a5a5a0", 0, 1.6),
    benefit_num: ts(24, "#ff4d00", -0.02, 1),
    benefit_title: ts(18, "#f5f5f3", -0.02, 1.3),
    benefit_desc: ts(13, "#a5a5a0", 0, 1.65),
    condition_label: ts(14, "#a5a5a0", 0, 1.5),
    condition_value: ts(14, "#ffffff", 0, 1.5),
    notice: ts(11, "#777777", 0, 1.6),
    cta_title: ts(24, "#f5f5f3", -0.02, 1.25),
    cta_desc: ts(13, "#a5a5a0", 0, 1.5),
  },
};

// ── 정규화 ──
const str = (v: unknown, d: string): string => (typeof v === "string" ? v : d);
const nz = (v: unknown, d: string): string => (typeof v === "string" && v.trim() ? v : d);
const num = (v: unknown, d: number): number => (typeof v === "number" && !Number.isNaN(v) ? v : d);

function normStyle(raw: unknown, d: TextStyle): TextStyle {
  const r = (raw ?? {}) as Partial<TextStyle>;
  return {
    size: num(r.size, d.size),
    color: nz(r.color, d.color),
    tracking: num(r.tracking, d.tracking),
    leading: num(r.leading, d.leading),
  };
}

export function normalizeFranchiseGuide(raw: Partial<FranchiseGuideConfig> | null | undefined): FranchiseGuideConfig {
  const c = (raw ?? {}) as Record<string, unknown>;
  const d = DEFAULT_FRANCHISE_GUIDE;
  const stats = Array.isArray(c.stats) ? (c.stats as Record<string, unknown>[]) : [];
  const bens = Array.isArray(c.benefits) ? (c.benefits as Record<string, unknown>[]) : [];
  const conds = Array.isArray(c.conditions) ? (c.conditions as Record<string, unknown>[]) : [];
  const rc = (c.colors ?? {}) as Record<string, unknown>;
  const rs = (c.styles ?? {}) as Record<string, unknown>;
  const styles = {} as GuideStyles;
  for (const k of STYLE_KEYS) styles[k] = normStyle(rs[k], d.styles[k]);
  return {
    title: str(c.title, d.title),
    hero_eyebrow: str(c.hero_eyebrow, d.hero_eyebrow),
    hero_title: str(c.hero_title, d.hero_title),
    hero_desc: str(c.hero_desc, d.hero_desc),
    hero_secondary_label: str(c.hero_secondary_label, d.hero_secondary_label),
    hero_bg_img: str(c.hero_bg_img, d.hero_bg_img),
    stats: d.stats.map((ds, i) => {
      const st = stats[i] ?? {};
      return { value: str(st.value, ds.value), label: str(st.label, ds.label) };
    }),
    store_stat_label: str(c.store_stat_label, d.store_stat_label),
    store_stat_unit: str(c.store_stat_unit, d.store_stat_unit),
    section_title: str(c.section_title, d.section_title),
    section_desc: str(c.section_desc, d.section_desc),
    benefits: d.benefits.map((db, i) => {
      const b = bens[i] ?? {};
      return { title: str(b.title, db.title), desc: str(b.desc, db.desc) };
    }),
    conditions_title: str(c.conditions_title, d.conditions_title),
    conditions_desc: str(c.conditions_desc, d.conditions_desc),
    conditions: d.conditions.map((dc, i) => {
      const row = conds[i] ?? {};
      return { label: str(row.label, dc.label), value: str(row.value, dc.value) };
    }),
    notice: str(c.notice, d.notice),
    cta_title: str(c.cta_title, d.cta_title),
    cta_desc: str(c.cta_desc, d.cta_desc),
    cta_button_label: str(c.cta_button_label, d.cta_button_label),
    count_fallback: typeof c.count_fallback === "number" && c.count_fallback >= 0 ? c.count_fallback : d.count_fallback,
    colors: {
      page_bg: nz(rc.page_bg, d.colors.page_bg),
      header_bg: nz(rc.header_bg, d.colors.header_bg),
      card_bg: nz(rc.card_bg, d.colors.card_bg),
      accent: nz(rc.accent, d.colors.accent),
    },
    styles,
  };
}

// TextStyle → 인라인 CSS
export function styleCss(s: TextStyle): CSSProperties {
  return { fontSize: s.size, color: s.color, letterSpacing: `${s.tracking}em`, lineHeight: s.leading };
}
