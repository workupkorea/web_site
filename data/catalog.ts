// 카탈로그(디지털 카탈로그/룩북) 페이지 한 장.
// 종류(page_type): image(단일 이미지+핫스팟) · split(분할 레이아웃) · cover(표지) · contents(목차) · divider(카테고리 구분)
// cover/contents/divider 는 옛 플립북 디자인을 코드로 재현하며, 내용은 data(JSONB)에 담는다.
// 기존 WORKUP 카탈로그 데이터는 brand_id 가 빈 문자열이며, 브랜드 카탈로그는 브랜드 ID를 사용한다.
// DB(snake_case) 행과 1:1로 매칭 — components/Hero.tsx 의 HeroSlide 패턴과 동일.

export type CatalogPageType = "image" | "split" | "cover" | "contents" | "divider";

export type ContentsItem = { name: string; count: string; page: string };

export type CatalogHotspot = {
  x: number;         // 이미지 내 좌측에서 % (0-100)
  y: number;         // 이미지 내 상단에서 % (0-100)
  name: string;      // 제품명
  desc?: string;     // 간단 설명
  price?: string;    // 가격 (예: "89,000원")
  href?: string;     // 제품 상세 페이지 경로 (미사용 시 image_url 표시 우선)
  image_url?: string; // 클릭 시 팝업에 보여줄 제품 이미지
};

// 분할(split) 페이지의 한 칸
export type CatalogTile = {
  image_url: string;
  title?: string;              // 이미지 위 작은 라벨 (선택)
  href?: string;               // 클릭 시 이동 (선택)
  hotspots?: CatalogHotspot[]; // 칸별 핫스팟 (선택)
};

export type CatalogSplitLayout = "2col" | "2row" | "3col" | "grid4";

export type CatalogPageData = {
  eyebrow?: string;            // 상단 영문 라벨 (cover/contents/divider 공통)
  bg?: string;                 // 배경색 hex (cover/divider)
  // cover (표지)
  season?: string; brand?: string; badge?: string; note?: string; code?: string;
  // contents (목차)
  items?: ContentsItem[]; footer?: string;
  // divider (구분)
  no?: string; title?: string; desc?: string; count?: string;
  // image 페이지 — 클릭 가능한 제품 핫스팟
  hotspots?: CatalogHotspot[];
  // split 페이지 — 분할 레이아웃 + 칸 목록
  layout?: CatalogSplitLayout;
  tiles?: CatalogTile[];
};

export type CatalogPage = {
  id: string;
  brand_id: string;          // 빈 문자열 = WORKUP 메인 카탈로그, 값 있음 = 해당 브랜드
  page_type: CatalogPageType;
  admin_title: string;       // 관리 목록 식별용 (실제 화면에는 표시되지 않음)
  image_url: string | null;  // 페이지 이미지 (image 종류)
  title: string;             // 이미지 위 캡션 제목 (image 종류, 선택)
  description: string;       // 캡션 설명 (image 종류, 선택)
  link_url: string;          // 클릭 시 이동 (image 종류, 선택)
  link_label: string;        // 링크 버튼 문구 (image 종류, 선택)
  data: CatalogPageData;     // 종류별 내용
  is_visible: boolean;
  sort_order: number;
};

// 관리자 목록 화면의 브랜드별 카탈로그 상태 표시용 — 키는 brand_id(문자열).
// GET /api/admin/catalog?summary=1 이 반환한다.
export type CatalogPagesSummary = Record<
  string,
  { count: number; visibleCount: number; latest: string }
>;

export const CATALOG_TYPE_LABEL: Record<CatalogPageType, string> = {
  image: "이미지",
  split: "분할",
  cover: "표지",
  contents: "목차",
  divider: "구분",
};

export const CATALOG_SPLIT_LAYOUT_LABEL: Record<CatalogSplitLayout, string> = {
  "2col": "좌우 2분할",
  "2row": "상하 2분할",
  "3col": "3분할",
  "grid4": "4분할 격자",
};

// 신규 페이지 기본값 (관리 폼에서 사용)
export const EMPTY_CATALOG_PAGE: Omit<CatalogPage, "id"> = {
  brand_id: "",
  page_type: "image",
  admin_title: "",
  image_url: "",
  title: "",
  description: "",
  link_url: "",
  link_label: "",
  data: {},
  is_visible: true,
  sort_order: 0,
};

// 종류 선택 시 채워줄 기본 내용 (옛 플립북 값 기준)
export function emptyDataFor(type: CatalogPageType): CatalogPageData {
  switch (type) {
    case "cover":
      return { eyebrow: "Product Catalog", season: "2026 Spring / Summer", brand: "WORKUP", badge: "2026 SS", note: "", code: "Cat. WU-2026-SS-001", bg: "#303236" };
    case "contents":
      return { eyebrow: "Contents", items: [{ name: "", count: "", page: "" }], footer: "WORKUP 2026 SS CATALOG" };
    case "divider":
      return { eyebrow: "Category 01", no: "01", title: "", desc: "", count: "", bg: "#303236" };
    case "split":
      return { layout: "2col", tiles: [{ image_url: "", title: "" }, { image_url: "", title: "" }] };
    default:
      return {};
  }
}
