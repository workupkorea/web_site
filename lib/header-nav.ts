// 헤더 내비게이션(탑바 아래 GNB) 메뉴 설정 — 타입 / 기본값 / 정규화.
// ⚠️ 이 파일은 클라이언트(관리자 페이지)와 서버(헤더/하단바) 양쪽에서 import 되므로
//    서버 전용 코드를 넣지 않는다. 서버 전용 조회 로직은 lib/header-nav-server.ts 에 둔다.
import { safeHref } from "./topbar";

export type NavMenuItem = {
  id: string;
  label: string;      // 메뉴 표시 텍스트(한글/영문 자유)
  labelKo?: string;   // 영문 레이블 아래 작게 표시될 한글 보조 텍스트
  href: string;       // 이동 경로
  newTab?: boolean;   // 새 탭으로 열기
  isVisible?: boolean; // 사이트 노출 여부(기본값 true)
};

export type HeaderNavConfig = {
  items: NavMenuItem[];
};

// 현재 사이트에 하드코딩돼 있던 기본 메뉴와 동일.
export const DEFAULT_HEADER_NAV: HeaderNavConfig = {
  items: [
    { id: "nav-products",   label: "PRODUCTS",   labelKo: "전체 제품",     href: "/products" },
    { id: "nav-store",      label: "STORE",      labelKo: "매장안내",      href: "/store" },
    { id: "nav-story",      label: "STORY",      labelKo: "브랜드 스토리", href: "/story" },
    { id: "nav-mate",       label: "MATE",       labelKo: "일하는 사람들", href: "/people" },
    { id: "nav-field-test", label: "FIELD TEST", labelKo: "기능성 테스트", href: "/field-test" },
  ],
};

// 영문 레이블 기준 한글 기본값 — id가 기본 메뉴와 달라도(예: ABOUT, BRANDS) 한글 메뉴명이 비지 않게 한다.
// PC 헤더는 한글만 표시하고, 모바일 메뉴는 영문 / 한글을 함께 표시하므로 같은 labelKo를 공유한다.
export const BRANDS_LABEL_KO = "브랜드 카탈로그";
const LABEL_KO_FALLBACK: Record<string, string> = {
  STORE: "매장안내",
  ABOUT: "워크업 이야기",
  BRANDS: BRANDS_LABEL_KO,
  MATE: "일하는 사람들",
};

// 저장된 JSON(부분/구버전 가능)을 안전한 완전체 설정으로 보정한다.
// label·href가 모두 있어야 유효한 메뉴로 본다. 결과가 비면(전부 삭제 등)
// 내비게이션이 통째로 사라지지 않도록 기본 메뉴로 폴백한다.
export function normalizeHeaderNav(raw: Partial<HeaderNavConfig> | null | undefined): HeaderNavConfig {
  const c = raw ?? {};
  const items = Array.isArray(c.items)
    ? c.items
        .filter((it): it is NavMenuItem => !!it && typeof it === "object")
        .map((it, i) => {
          const id = typeof it.id === "string" && it.id ? it.id : `nav-${i}`;
          const defaultItem = DEFAULT_HEADER_NAV.items.find((d) => d.id === id);
          const labelKo =
            typeof it.labelKo === "string" && it.labelKo.trim()
              ? it.labelKo.trim()
              : defaultItem?.labelKo ?? LABEL_KO_FALLBACK[(typeof it.label === "string" ? it.label : "").trim().toUpperCase()];
          return {
            id,
            label: typeof it.label === "string" ? it.label.trim() : "",
            labelKo,
            href: safeHref(it.href),
            newTab: !!it.newTab,
            isVisible: it.isVisible !== false,
          };
        })
        .filter((it) => it.label !== "" && it.href !== "")
    : DEFAULT_HEADER_NAV.items;

  return { items: items.length ? items : DEFAULT_HEADER_NAV.items };
}
