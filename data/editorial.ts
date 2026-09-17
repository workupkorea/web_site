import type { Product } from "./products";

export type EditorialTag = {
  x: number;        // 모바일 left %
  y: number;        // 모바일 top %
  pcX?: number;     // PC left % (없으면 x 사용)
  pcY?: number;     // PC top %  (없으면 y 사용)
  name: string;
  price: string;
  productId: string;
  bg: string;
  imageUrl?: string;
};

// 기획전 상세페이지의 "카드형" 제품 위젯(이미지 페이징+컬러+사이즈+아코디언) 전용 데이터.
export type EditorialCardColor = { id: string; name: string; hex: string; imageIndexes: number[]; soldOut?: boolean };
export type EditorialCardSize = { id: string; label: string; soldOut?: boolean };
export type EditorialCardDetail = {
  images: string[];
  colors: EditorialCardColor[];
  sizes: EditorialCardSize[];
  styleNo?: string;      // 품번(Style No.) — 입고 스케쥴에서 가져오거나 직접 입력
  detailText: string;
  materialText: string;
  essentialText: string;
};

export type EditorialSectionItem = {
  productId: string;
  name: string;
  price: string;
  bg: string;
  imageUrl?: string;
  displayName?: string; // "[브랜드] 상품명" — 상품 brand 조회 후 채움 (없으면 name 사용)
  cardDetail?: EditorialCardDetail;
};

// 섹션 이미지 위 상품 핫스팟 — PC·모바일 모두 8:9 object-contain이라 단일 좌표
export type EditorialSectionTag = {
  x: number;            // left %
  y: number;            // top %
  name: string;
  price: string;
  productId: string;
  imageUrl?: string;
};

export type EditorialSection = {
  sectionBg: string;   // bg class for the 440×495 placeholder image
  title: string;
  desc: string;
  imageUrl?: string;
  // 카드 타입 — "product"(기본): 상단이미지+제목+설명+썸네일 / "image": 통이미지 한 장
  cardType?: "product" | "image";
  link?: string;                        // 통이미지 카드 클릭 시 이동할 링크 (PR 소식 등)
  items: [EditorialSectionItem, EditorialSectionItem, EditorialSectionItem];
  detailItems?: EditorialSectionItem[]; // 상세페이지 전용 추가 상품 (메인 items 뒤에 노출)
  detailHref?: string;                  // 섹션이미지 클릭 시 이동할 상세페이지 경로
  tags?: EditorialSectionTag[];
};

export type Editorial = {
  slug: string;
  badge: string;
  title: string;
  subtitle: string;
  desc: string;
  bg: string;
  heroImageUrl?: string;        // 히어로 배경 이미지
  heroImagePosition?: string;   // CSS objectPosition (예: "50% 20%"), 기본값 "50% 0%"
  textAccent: string;
  heroSubtitle: string;
  tags: EditorialTag[];
  sections: EditorialSection[]; // 4개 (2행 × 2열)
};

export const editorials: Editorial[] = [
  {
    slug: "uv-protection",
    badge: "여름 필수",
    title: "UV 대책 특집",
    subtitle: "자외선 차단 + 흡한속건",
    desc: "UPF 인증 소재로 자외선을 막고, 땀은 날려버립니다.",
    bg: "bg-[#7C3400]",
    textAccent: "#E5541B",
    heroSubtitle: "여름 현장 필수 아이템",
    tags: [
      { x: 32, y: 22, name: "쿨링 반팔 티셔츠", price: "19,000원", productId: "cooling-short-sleeve", bg: "bg-[#2d4f72]" },
      { x: 58, y: 45, name: "흡한속건 긴팔 티셔츠", price: "25,000원", productId: "quick-dry-long-sleeve", bg: "bg-[#243d5e]" },
      { x: 42, y: 68, name: "스트레치 카고 팬츠", price: "39,000원", productId: "stretch-cargo-pants", bg: "bg-[#303236]" },
    ],
    sections: [
      {
        sectionBg: "bg-[#4a7fa5]",
        title: "자외선을 막는 기능성 상의",
        desc: "UPF 40+ 인증 소재로 강렬한 자외선을 차단하면서도 흡한속건 기능으로 쾌적함을 유지합니다.",
        items: [
          { productId: "cooling-short-sleeve", name: "쿨링 반팔 티셔츠", price: "19,000원", bg: "bg-[#2d4f72]" },
          { productId: "quick-dry-long-sleeve", name: "흡한속건 긴팔 티셔츠", price: "25,000원", bg: "bg-[#243d5e]" },
          { productId: "work-rollup-shirt", name: "워크 롤업 셔츠", price: "35,000원", bg: "bg-[#4d4d4d]" },
        ],
      },
      {
        sectionBg: "bg-[#303236]",
        title: "현장을 버티는 하의",
        desc: "움직임이 많은 현장 환경에서도 불편함 없이 착용 가능한 스트레치 소재 하의 라인업입니다.",
        items: [
          { productId: "stretch-cargo-pants", name: "스트레치 카고 팬츠", price: "39,000원", bg: "bg-[#303236]" },
          { productId: "work-chino-pants", name: "워크 치노 팬츠", price: "45,000원", bg: "bg-[#3D3D3D]" },
          { productId: "multi-pocket-vest", name: "멀티포켓 조끼", price: "35,000원", bg: "bg-[#5a5a5a]" },
        ],
      },
      {
        sectionBg: "bg-[#6b9cb0]",
        title: "UV 차단 액세서리 모음",
        desc: "자외선을 막는 것은 옷만이 아닙니다. 모자, 팔토시, 넥게이터까지 빈틈 없이 자외선을 차단하세요.",
        items: [
          { productId: "cooling-short-sleeve", name: "UV 차단 팔토시", price: "12,000원", bg: "bg-[#4a7fa5]" },
          { productId: "quick-dry-long-sleeve", name: "넥게이터", price: "9,000원", bg: "bg-[#2d4f72]" },
          { productId: "work-rollup-shirt", name: "챙넓은 작업 모자", price: "18,000원", bg: "bg-[#3a5a7a]" },
        ],
      },
      {
        sectionBg: "bg-[#2e4a6a]",
        title: "여성 UV 케어 라인",
        desc: "여성 작업자를 위한 UV 차단 전용 라인. 슬림 핏으로 작업 효율과 스타일을 동시에 잡았습니다.",
        items: [
          { productId: "stretch-cargo-pants", name: "여성 UV 슬림 팬츠", price: "42,000원", bg: "bg-[#303236]" },
          { productId: "cooling-short-sleeve", name: "여성 쿨링 상의", price: "22,000원", bg: "bg-[#2d4f72]" },
          { productId: "multi-pocket-vest", name: "여성 기능 조끼", price: "33,000원", bg: "bg-[#3a5a6a]" },
        ],
      },
    ],
  },
  {
    slug: "outdoor",
    badge: "아웃도어",
    title: "아웃도어 특집",
    subtitle: "방풍·방수 퍼포먼스",
    desc: "산에서도, 현장에서도. 날씨를 이기는 기어.",
    bg: "bg-[#1E3A20]",
    textAccent: "#7EC88B",
    heroSubtitle: "날씨를 이기는 기어",
    tags: [
      { x: 35, y: 25, name: "경량 방풍 자켓", price: "59,000원", productId: "lightweight-windproof-jacket", bg: "bg-[#243d5e]" },
      { x: 55, y: 50, name: "방풍 후드 집업", price: "65,000원", productId: "windproof-hoodie-zip", bg: "bg-[#3D3D3D]" },
      { x: 40, y: 72, name: "스트레치 카고 팬츠", price: "39,000원", productId: "stretch-cargo-pants", bg: "bg-[#303236]" },
    ],
    sections: [
      {
        sectionBg: "bg-[#2d5a30]",
        title: "바람과 비를 막는 아우터",
        desc: "방풍·방수 가공으로 거친 날씨에도 체온을 지켜주는 아우터 라인입니다. 360g의 초경량 설계로 움직임도 자유롭습니다.",
        items: [
          { productId: "lightweight-windproof-jacket", name: "경량 방풍 자켓", price: "59,000원", bg: "bg-[#243d5e]" },
          { productId: "windproof-hoodie-zip", name: "방풍 후드 집업", price: "65,000원", bg: "bg-[#3D3D3D]" },
          { productId: "multi-pocket-vest", name: "멀티포켓 조끼", price: "35,000원", bg: "bg-[#5a5a5a]" },
        ],
      },
      {
        sectionBg: "bg-[#3d5c3f]",
        title: "아웃도어를 완성하는 하의",
        desc: "험한 지형에서도 자유로운 움직임을 보장하는 스트레치 하의. 다용도 포켓으로 편의성을 높였습니다.",
        items: [
          { productId: "stretch-cargo-pants", name: "스트레치 카고 팬츠", price: "39,000원", bg: "bg-[#303236]" },
          { productId: "work-chino-pants", name: "워크 치노 팬츠", price: "45,000원", bg: "bg-[#3D3D3D]" },
          { productId: "quick-dry-long-sleeve", name: "흡한속건 긴팔 티셔츠", price: "25,000원", bg: "bg-[#243d5e]" },
        ],
      },
      {
        sectionBg: "bg-[#1e4022]",
        title: "아웃도어 베이스레이어",
        desc: "피부에 직접 닿는 베이스레이어는 소재가 핵심입니다. 흡습속건·항균 기능으로 장시간 착용에도 쾌적합니다.",
        items: [
          { productId: "cooling-short-sleeve", name: "흡습속건 베이스 티셔츠", price: "21,000원", bg: "bg-[#2d4f72]" },
          { productId: "quick-dry-long-sleeve", name: "베이스레이어 긴팔", price: "27,000원", bg: "bg-[#243d5e]" },
          { productId: "work-rollup-shirt", name: "항균 기능 셔츠", price: "37,000원", bg: "bg-[#3d5c3f]" },
        ],
      },
      {
        sectionBg: "bg-[#2a4a2c]",
        title: "아웃도어 전용 액세서리",
        desc: "장갑, 모자, 넥게이터. 작은 디테일이 모여 완벽한 아웃도어 착장이 됩니다.",
        items: [
          { productId: "multi-pocket-vest", name: "경량 멀티포켓 조끼", price: "37,000원", bg: "bg-[#4a6a4c]" },
          { productId: "stretch-cargo-pants", name: "아웃도어 레깅스 팬츠", price: "41,000원", bg: "bg-[#2d4a30]" },
          { productId: "work-chino-pants", name: "산행 치노 쇼츠", price: "33,000원", bg: "bg-[#3D3D3D]" },
        ],
      },
    ],
  },
  {
    slug: "construction",
    badge: "건설·현장",
    title: "건설현장 필수템",
    subtitle: "내구성과 안전을 동시에",
    desc: "15년 경력자도 인정한 현장 최강 라인업.",
    bg: "bg-[#303236]",
    textAccent: "#5B9BD5",
    heroSubtitle: "현장 작업자가 직접 선택한",
    tags: [
      { x: 30, y: 28, name: "반사띠 안전 자켓", price: "79,000원", productId: "reflective-safety-jacket", bg: "bg-[#303236]" },
      { x: 52, y: 48, name: "스트레치 카고 팬츠", price: "39,000원", productId: "stretch-cargo-pants", bg: "bg-[#303236]" },
      { x: 38, y: 70, name: "쿨링 반팔 티셔츠", price: "19,000원", productId: "cooling-short-sleeve", bg: "bg-[#2d4f72]" },
    ],
    sections: [
      {
        sectionBg: "bg-[#243d5e]",
        title: "내구성 검증 작업복",
        desc: "1,000회 내구성 테스트를 통과한 소재. 현장의 거친 환경에서도 형태를 유지하는 워크업 SITE 라인입니다.",
        items: [
          { productId: "stretch-cargo-pants", name: "스트레치 카고 팬츠", price: "39,000원", bg: "bg-[#303236]" },
          { productId: "cooling-short-sleeve", name: "쿨링 반팔 티셔츠", price: "19,000원", bg: "bg-[#2d4f72]" },
          { productId: "multi-pocket-vest", name: "멀티포켓 조끼", price: "35,000원", bg: "bg-[#5a5a5a]" },
        ],
      },
      {
        sectionBg: "bg-[#2e3d28]",
        title: "안전 인증 보호구",
        desc: "KC 인증을 받은 반사 소재와 형광 원단으로 어두운 현장에서도 내 존재를 알립니다.",
        items: [
          { productId: "reflective-safety-jacket", name: "반사띠 안전 자켓", price: "79,000원", bg: "bg-[#303236]" },
          { productId: "lightweight-windproof-jacket", name: "경량 방풍 자켓", price: "59,000원", bg: "bg-[#243d5e]" },
          { productId: "quick-dry-long-sleeve", name: "흡한속건 긴팔 티셔츠", price: "25,000원", bg: "bg-[#243d5e]" },
        ],
      },
      {
        sectionBg: "bg-[#1a2e4a]",
        title: "현장 방호 & 보호 용품",
        desc: "장갑, 안전모, 안전화까지. 전신을 지키는 워크업 안전 보호구 풀 라인업입니다.",
        items: [
          { productId: "reflective-safety-jacket", name: "고시인성 안전 조끼", price: "45,000원", bg: "bg-[#2d4a2a]" },
          { productId: "stretch-cargo-pants", name: "방호 카고 팬츠", price: "55,000원", bg: "bg-[#303236]" },
          { productId: "multi-pocket-vest", name: "안전 멀티포켓 조끼", price: "39,000원", bg: "bg-[#3a3a5a]" },
        ],
      },
      {
        sectionBg: "bg-[#3a3a2e]",
        title: "현장 작업 잡화",
        desc: "현장에서 매일 쓰는 공구함, 허리쌕, 장갑까지. 워크업 현장 잡화로 작업 효율을 높이세요.",
        items: [
          { productId: "cooling-short-sleeve", name: "작업용 장갑 (6매)", price: "8,000원", bg: "bg-[#4a3a2a]" },
          { productId: "quick-dry-long-sleeve", name: "현장 허리쌕", price: "28,000원", bg: "bg-[#3a4a2a]" },
          { productId: "work-rollup-shirt", name: "공구 파우치", price: "15,000원", bg: "bg-[#4a4a3a]" },
        ],
      },
    ],
  },
  {
    slug: "work-to-daily",
    badge: "데일리",
    title: "현장 to 일상",
    subtitle: "출근도 퇴근도 이 한 벌로",
    desc: "현장 실용성 + 일상 감각. DAILY 라인 전체 모음.",
    bg: "bg-[#2D2D2D]",
    textAccent: "#C8B89A",
    heroSubtitle: "현장과 일상 사이, 어색하지 않게",
    tags: [
      { x: 36, y: 24, name: "헤비 크루넥 스웻셔츠", price: "49,000원", productId: "heavy-crewneck-sweatshirt", bg: "bg-[#4d4d4d]" },
      { x: 55, y: 52, name: "워크 치노 팬츠", price: "45,000원", productId: "work-chino-pants", bg: "bg-[#3D3D3D]" },
      { x: 40, y: 74, name: "방풍 후드 집업", price: "65,000원", productId: "windproof-hoodie-zip", bg: "bg-[#3D3D3D]" },
    ],
    sections: [
      {
        sectionBg: "bg-[#4d4d4d]",
        title: "일상을 완성하는 상의",
        desc: "퇴근 후 카페, 주말 나들이. 현장 작업복에서 일상복으로 자연스럽게 이어지는 DAILY 상의 라인입니다.",
        items: [
          { productId: "heavy-crewneck-sweatshirt", name: "헤비 크루넥 스웻셔츠", price: "49,000원", bg: "bg-[#4d4d4d]" },
          { productId: "work-rollup-shirt", name: "워크 롤업 셔츠", price: "35,000원", bg: "bg-[#4d4d4d]" },
          { productId: "windproof-hoodie-zip", name: "방풍 후드 집업", price: "65,000원", bg: "bg-[#3D3D3D]" },
        ],
      },
      {
        sectionBg: "bg-[#3D3D3D]",
        title: "현장도 일상도 맞는 하의",
        desc: "오전엔 공장, 오후엔 바이어 미팅. 스트레치 소재와 세련된 실루엣으로 어느 자리에서도 어색함이 없습니다.",
        items: [
          { productId: "work-chino-pants", name: "워크 치노 팬츠", price: "45,000원", bg: "bg-[#3D3D3D]" },
          { productId: "stretch-cargo-pants", name: "스트레치 카고 팬츠", price: "39,000원", bg: "bg-[#303236]" },
          { productId: "multi-pocket-vest", name: "멀티포켓 조끼", price: "35,000원", bg: "bg-[#5a5a5a]" },
        ],
      },
      {
        sectionBg: "bg-[#5a5a5a]",
        title: "워크데일리 코디 세트",
        desc: "상의와 하의를 함께 구매하면 더 저렴하게. 워크업이 제안하는 데일리 코디 세트를 만나보세요.",
        items: [
          { productId: "heavy-crewneck-sweatshirt", name: "크루넥 + 치노 세트", price: "85,000원", bg: "bg-[#4d4d4d]" },
          { productId: "windproof-hoodie-zip", name: "집업 + 카고 세트", price: "95,000원", bg: "bg-[#3D3D3D]" },
          { productId: "work-rollup-shirt", name: "롤업셔츠 + 치노 세트", price: "72,000원", bg: "bg-[#5a5a5a]" },
        ],
      },
      {
        sectionBg: "bg-[#2D2D2D]",
        title: "커스텀 오더 라인",
        desc: "회사 로고, 이름, 부서명까지. 나만의 작업복을 맞춤 주문하세요. 10벌 이상 단체 주문 시 특별 할인.",
        items: [
          { productId: "cooling-short-sleeve", name: "커스텀 반팔 티셔츠", price: "24,000원~", bg: "bg-[#3a3a3a]" },
          { productId: "multi-pocket-vest", name: "커스텀 조끼", price: "42,000원~", bg: "bg-[#4a4a4a]" },
          { productId: "stretch-cargo-pants", name: "커스텀 카고 팬츠", price: "47,000원~", bg: "bg-[#1a2a3a]" },
        ],
      },
    ],
  },
  {
    slug: "new-arrivals",
    badge: "NEW",
    title: "신상품 특집",
    subtitle: "이번 시즌 첫 출시",
    desc: "올 시즌 가장 새로운 아이템만 모았습니다.",
    bg: "bg-[#111111]",
    heroImageUrl: "/images/hero-new-arrivals.jpg",
    textAccent: "#E5541B",
    heroSubtitle: "2026 SS · 신규 라인업",
    tags: [
      { x: 33, y: 32, name: "쿨링 반팔 티셔츠", price: "19,000원", productId: "cooling-short-sleeve", bg: "bg-[#243d5e]" },
      { x: 44, y: 81, name: "스트레치 카고 팬츠", price: "39,000원", productId: "stretch-cargo-pants", bg: "bg-[#303236]" },
      { x: 76, y: 72, name: "경량 방풍 자켓", price: "59,000원", productId: "lightweight-windproof-jacket", bg: "bg-[#243d5e]" },
    ],
    sections: [
      {
        sectionBg: "bg-[#303236]",
        title: "SITE 라인 신상품",
        desc: "현장의 목소리를 담아 새롭게 설계한 2026 SS SITE 라인. 기능성은 높이고 착용감은 더 가볍게.",
        items: [
          { productId: "lightweight-windproof-jacket", name: "경량 방풍 자켓", price: "59,000원", bg: "bg-[#243d5e]" },
          { productId: "cooling-short-sleeve", name: "쿨링 반팔 티셔츠", price: "19,000원", bg: "bg-[#2d4f72]" },
          { productId: "stretch-cargo-pants", name: "스트레치 카고 팬츠", price: "39,000원", bg: "bg-[#303236]" },
        ],
      },
      {
        sectionBg: "bg-[#3D3D3D]",
        title: "DAILY 라인 신상품",
        desc: "출근부터 퇴근까지, 어디서든 어울리는 2026 SS DAILY 라인. 소재와 핏을 새롭게 업그레이드했습니다.",
        items: [
          { productId: "heavy-crewneck-sweatshirt", name: "헤비 크루넥 스웻셔츠", price: "49,000원", bg: "bg-[#4d4d4d]" },
          { productId: "work-chino-pants", name: "워크 치노 팬츠", price: "45,000원", bg: "bg-[#3D3D3D]" },
          { productId: "work-rollup-shirt", name: "워크 롤업 셔츠", price: "35,000원", bg: "bg-[#4d4d4d]" },
        ],
      },
      {
        sectionBg: "bg-[#2a1a10]",
        title: "안전 & 기능성 라인 신상품",
        desc: "KC 인증 반사 소재와 강화된 기능성. 2026 SS 안전 라인이 현장의 기준을 새롭게 정의합니다.",
        items: [
          { productId: "reflective-safety-jacket", name: "반사띠 안전 자켓 NEW", price: "79,000원", bg: "bg-[#303236]" },
          { productId: "multi-pocket-vest", name: "기능성 멀티포켓 조끼", price: "39,000원", bg: "bg-[#3a3a2a]" },
          { productId: "quick-dry-long-sleeve", name: "흡한속건 긴팔 NEW", price: "27,000원", bg: "bg-[#243d5e]" },
        ],
      },
      {
        sectionBg: "bg-[#1a1a1a]",
        title: "워크업 핵심 잡화 신상품",
        desc: "올 시즌 새롭게 선보이는 워크업 잡화. 실용성과 마감 품질, 두 가지를 모두 잡았습니다.",
        items: [
          { productId: "cooling-short-sleeve", name: "워크업 캔버스 백팩", price: "55,000원", bg: "bg-[#2a2a2a]" },
          { productId: "work-rollup-shirt", name: "메쉬 허리쌕 NEW", price: "32,000원", bg: "bg-[#3a3a3a]" },
          { productId: "stretch-cargo-pants", name: "공구 파우치 세트", price: "18,000원", bg: "bg-[#1a2a3a]" },
        ],
      },
    ],
  },
];

export function filterProductsForEditorial(
  products: Product[],
  slug: string
): Product[] {
  switch (slug) {
    case "uv-protection":
      return products.filter((p) =>
        p.features.some((f) => f.includes("UPF") || f.includes("자외선"))
      );
    case "outdoor":
      return products.filter((p) => p.jobTypes.includes("아웃도어"));
    case "construction":
      return products.filter((p) => p.jobTypes.includes("건설·현장"));
    case "work-to-daily":
      return products.filter((p) => p.line === "DAILY");
    case "new-arrivals":
      return products.filter((p) => !!p.isNew);
    default:
      return [];
  }
}
