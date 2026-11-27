export type JobType = "건설·현장" | "물류·배달" | "매장·서비스" | "아웃도어" | "일상";
export type LineType = "SITE" | "DAILY" | "PRO";
export type ProductStatus = "판매중" | "품절" | "판매중지" | "예약판매" | "진열대기";
export type Season = "봄/가을" | "여름" | "겨울";
export type MainExpose = "신상품" | "추천상품" | "베스트" | "기획전";
export type DetailBlock = {
  id: string;
  type: "상품 소개" | "착용 컷" | "기능 설명" | "현장 테스트" | "사이즈표" | "세탁법" | "구매 안내";
  content: string;
  imageUrl?: string;
};
// 측정 위치 안내 도식 위에 그리는 가이드선 (어깨/가슴/소매/총장 등) — 이미지에 텍스트를 넣지 않고 오버레이로 표시
// 좌표는 모두 guideImage 대비 %(0~100). horizontal: pos=y%, start/end=x% 구간. vertical: pos=x%, start/end=y% 구간.
export type SizeGuideLine = {
  label: string;
  orientation: "horizontal" | "vertical";
  pos: number;
  start: number;
  end: number;
};
// 사이즈 및 소재 탭 — 이미지 등록 또는 행·열 표 직접 생성
export type SizeGuide = {
  label?: string;                       // 여러 개일 때 구분 라벨 (예: "상의", "하의")
  mode: "image" | "table";
  guideImage?: string;                  // 측정 위치 안내 도식(어깨·가슴·총장 등) — 표/이미지 위에 노출, 선택
  guideLines?: SizeGuideLine[];         // guideImage 위 측정 가이드선(선택) — 없으면 표시 안 함
  image?: string;                       // mode="image"
  columns?: string[];                   // mode="table" 헤더, 예: ["항목","S","M","L","XL","XXL"]
  rows?: { cells: string[] }[];         // 각 행의 셀(첫 셀 = 행 라벨), columns 길이에 맞춤
  note?: string;                        // 안내 문구, 예: "본 사이즈는 실측이며 ±1-2cm 오차 (단위:cm)"
};
// 상세 정보 탭 — 라벨/값 텍스트 항목
export type DetailInfoItem = { label: string; value: string };

// 사이즈 가이드 하단 안내 문구 기본값 (필수) — 미입력 시 저장·노출에 모두 이 문구를 사용
export const SIZE_NOTE_DEFAULT = "본 사이즈는 상품의 실제 측정사이즈이며 ±1-2cm의 오차가 있을 수 있습니다. (단위:cm)";

// 사이즈 가이드 목록 정규화 — 신규(sizeGuides 배열) 우선, 없으면 레거시 단일(sizeGuide)을 배열로.
export function getSizeGuides(p: { sizeGuides?: SizeGuide[]; sizeGuide?: SizeGuide }): SizeGuide[] {
  if (Array.isArray(p.sizeGuides) && p.sizeGuides.length > 0) return p.sizeGuides;
  return p.sizeGuide ? [p.sizeGuide] : [];
}
// 인스타 피드 — 상품별 등록 미디어 (업로드한 대표 이미지 + 선택적 인스타 게시물 링크)
export type InstagramMedia = { image: string; url?: string };
export type MainCategory = "공용" | "남성" | "여성" | "소품" | "현장" | "일상";
export type SubCategory =
  // 공용
  | "공용 상의" | "공용 하의" | "공용 아우터"
  // 현장
  | "상의" | "하의" | "계절·기능" | "안전용품"
  // 일상
  | "데일리웨어" | "아우터" | "팬츠"
  // 남성
  | "남성 상의" | "남성 하의" | "남성 아우터" | "신발"
  // 여성
  | "여성 상의" | "여성 하의" | "여성 아우터"
  // 소품
  | "가방" | "모자" | "장갑" | "양말" | "벨트" | "기타";

export type Product = {
  id: string;
  sku?: string;
  brand?: string;
  hideBrandPrefix?: boolean;   // 제품명 앞 "[브랜드]" 표시 숨김 (기본 false = 표시)
  manufacturer?: string;
  origin?: string;
  line: LineType;
  category: MainCategory;
  subCategory: SubCategory;
  categories?: { main: string; sub: string }[];
  status?: ProductStatus;
  isNew?: boolean;
  rating?: number;
  reviewCount?: number;
  name: string;
  tagline: string;
  price: string;
  consumerPrice?: string;
  supplyPrice?: string;
  features: string[];
  featureTags?: string[];
  jobTypes: JobType[];
  jobSites?: string[];
  seasons?: Season[];
  promoStart?: string;
  promoEnd?: string;
  mainExpose?: MainExpose[];
  fieldTest?: string;
  wearerQuote?: { job: string; years: string; text: string };
  bg: string;
  colors: { name: string; hex: string }[];
  sizes?: string[];
  sizeGuide?: SizeGuide;         // (레거시) 단일 가이드 — 하위호환 읽기용
  sizeGuides?: SizeGuide[];      // 여러 사이즈 가이드 (상하세트 등: 상의/하의 등)
  detailInfo?: DetailInfoItem[];
  imageUrl?: string;
  subImages?: string[];
  videoUrl?: string;   // 갤러리 영상 (YouTube·Vimeo 링크 또는 mp4 등 직접 URL)
  instagramPosts?: InstagramMedia[];   // 이 상품 관련 인스타 미디어(이미지+링크) — 상세페이지 노출
  detailBlocks?: DetailBlock[];
  registrationStatus?: "임시등록" | "정식등록";   // MD 빠른 등록(임시등록) 지원 — 지점 출고 패스 공지에서 사용
  relatedIds?: string[];
  metaTitle?: string;
  metaDesc?: string;
  createdAt?: string;
  updatedAt?: string;   // 최종 수정 시각 (관리자 목록 정렬용)
  coreValues?: string[];
  recommendedFor?: string[];
  keyFeatures?: { title: string; desc: string }[];
  sizeRecs?: { height: string; weight: string; size: string }[];
  fitNote?: string;
  materialSpecs?: { label: string; value: string }[];
  washCare?: { icon: "cold" | "no-dry" | "no-bleach" | "low-iron" | "hand-wash"; text: string }[];
  detailPoints?: string[];
  lifestyleScenes?: { tag: string; title: string; desc: string }[];
  sizePrices?: { size: string; weight?: string; price: string }[];
};

// 제품명 표시 — 브랜드가 있고 숨김 설정이 아니면 "[브랜드] 제품명" 형태로 반환
export function productDisplayName(p: { name: string; brand?: string; hideBrandPrefix?: boolean }): string {
  const brand = (p.brand ?? "").trim();
  return brand && !p.hideBrandPrefix ? `[${brand}] ${p.name}` : p.name;
}

// 고객에게 숨기는 상태 — "판매중지"(판매안함)·"진열대기"(노출중지)
export const HIDDEN_PRODUCT_STATUSES: ReadonlySet<string> = new Set(["판매중지", "진열대기"]);
// 공개 사이트(목록·검색·홈·관련상품)에 노출 가능한지. status 미지정은 "판매중"으로 간주
export function isPubliclyVisible(p: { status?: string }): boolean {
  return !HIDDEN_PRODUCT_STATUSES.has(p.status ?? "판매중");
}

// 화면에 보여줄 상품코드 — "0"은 엑셀 임포트 시 빈 셀이 잘못 채워진 값이라 표시하지 않음
export function displaySku(sku?: string | null): string | null {
  const s = (sku ?? "").trim();
  return s && s !== "0" ? s : null;
}

export const mainCategories: MainCategory[] = [
  "공용", "남성", "여성", "소품", "현장", "일상",
];

export const subCategoriesByMain: Record<MainCategory, SubCategory[]> = {
  공용: ["공용 상의", "공용 하의", "공용 아우터"],
  남성: ["남성 상의", "남성 하의", "남성 아우터", "신발"],
  여성: ["여성 상의", "여성 하의", "여성 아우터"],
  소품: ["가방", "모자", "장갑", "양말", "벨트", "기타"],
  현장: ["상의", "하의", "계절·기능", "안전용품"],
  일상: ["데일리웨어", "아우터", "팬츠"],
};

export const products: Product[] = [
  {
    id: "stretch-cargo-pants",
    sku: "WU-S001",
    line: "SITE",
    category: "현장",
    subCategory: "하의",
    isNew: true,
    rating: 4.8,
    reviewCount: 134,
    name: "스트레치 카고 팬츠",
    tagline: "하루 종일 쪼그려 앉아도 안 당깁니다.",
    price: "39,000원",
    features: ["11개 포켓", "무릎 이중 보강", "스트레치율 35%"],
    jobTypes: ["건설·현장", "물류·배달"],
    fieldTest: "카고 팬츠 내구성 1,000회 테스트 통과",
    wearerQuote: {
      job: "건설 현장직",
      years: "경력 15년",
      text: "현장에서 옷이 불편하면 사고 납니다. 이 바지는 어떤 자세에서도 안 당겨요.",
    },
    bg: "bg-[#303236]",
    colors: [
      { name: "네이비", hex: "#303236" },
      { name: "카키", hex: "#4A5240" },
      { name: "블랙", hex: "#1C1C1C" },
    ],
  },
  {
    id: "lightweight-windproof-jacket",
    sku: "WU-S002",
    line: "SITE",
    category: "현장",
    subCategory: "계절·기능",
    isNew: true,
    rating: 4.9,
    reviewCount: 87,
    name: "경량 방풍 자켓",
    tagline: "바람 막고, 비 막고. 360g.",
    price: "59,000원",
    features: ["방풍 100%", "발수 가공", "무게 360g"],
    jobTypes: ["건설·현장", "아웃도어"],
    fieldTest: "폭우 8시간 방수 테스트 통과",
    wearerQuote: {
      job: "새벽 배달기사",
      years: "경력 4년",
      text: "비 와도 멈출 수 없어요. 이 자켓 입고부터 폭우에도 그냥 달립니다.",
    },
    bg: "bg-[#243d5e]",
    colors: [
      { name: "네이비", hex: "#303236" },
      { name: "블랙", hex: "#1C1C1C" },
      { name: "올리브", hex: "#556B2F" },
    ],
    coreValues: [
      "폭우 8시간도 거뜬한 100% 방풍·발수 설계",
      "360g 초경량, 하루 종일 입어도 부담 없는 무게",
      "현장도 일상도 어색하지 않는 슬림 실루엣",
    ],
    recommendedFor: [
      "새벽·야간 야외 작업이 많은 분",
      "비·바람이 잦은 현장에서 일하는 분",
      "가볍고 얇은 아우터를 찾는 분",
      "작업 후 그대로 외출하는 분",
    ],
    keyFeatures: [
      { title: "방풍 100%", desc: "촘촘한 립스탑 나일론이 바람을 완벽 차단합니다" },
      { title: "발수 가공", desc: "생활 방수로 가벼운 비에도 옷이 젖지 않습니다" },
      { title: "360g 초경량", desc: "배낭에 넣어도 짐이 되지 않는 초경량 설계" },
      { title: "YKK 방수 지퍼", desc: "지퍼 틈으로 바람이 들어오지 않는 견고한 구조" },
    ],
    sizeRecs: [
      { height: "168cm", weight: "60kg", size: "S" },
      { height: "173cm", weight: "70kg", size: "M" },
      { height: "178cm", weight: "80kg", size: "L" },
      { height: "183cm", weight: "88kg", size: "XL" },
      { height: "186cm", weight: "95kg", size: "2XL" },
    ],
    fitNote: "정사이즈 권장 · 레이어드 착용 시 한 사이즈 업 추천",
    detailPoints: ["YKK 방수 지퍼", "발수 원단", "파우치 수납", "조절 밴드"],
    lifestyleScenes: [
      { tag: "WORK", title: "현장에서", desc: "거친 환경에서도 흔들리지 않는 방풍·발수 성능" },
      { tag: "LIFE", title: "일상에서", desc: "슬림한 실루엣으로 출퇴근길, 주말 모두 활용" },
    ],
    materialSpecs: [
      { label: "소재",   value: "나일론 100% (립스탑)" },
      { label: "중량",   value: "약 360g" },
      { label: "신축성", value: "없음" },
      { label: "두께감", value: "얇음" },
      { label: "핏",    value: "레귤러" },
      { label: "계절",  value: "봄·가을·여름(방풍)" },
      { label: "제조국", value: "베트남" },
    ],
    washCare: [
      { icon: "cold",      text: "찬물 단독 세탁" },
      { icon: "no-dry",    text: "건조기 사용 금지" },
      { icon: "no-bleach", text: "표백제 금지" },
      { icon: "low-iron",  text: "저온 다림질" },
    ],
  },
  {
    id: "cooling-short-sleeve",
    sku: "WU-S003",
    line: "SITE",
    category: "현장",
    subCategory: "상의",
    isNew: true,
    rating: 4.7,
    reviewCount: 312,
    name: "쿨링 반팔 티셔츠",
    tagline: "8시간 입어도 냄새 안 납니다.",
    price: "19,000원",
    features: ["흡한속건 20분 건조", "UPF 50+ 자외선 차단", "항균 처리"],
    jobTypes: ["건설·현장", "물류·배달", "매장·서비스"],
    fieldTest: "35도 현장 8시간 체온 측정 테스트 통과",
    wearerQuote: {
      job: "물류센터 팀장",
      years: "경력 8년",
      text: "여름에 땀 때문에 고역이었는데. 이제는 퇴근까지 끄떡없어요.",
    },
    bg: "bg-[#2d4f72]",
    colors: [
      { name: "화이트", hex: "#F5F2ED" },
      { name: "그레이", hex: "#6B6B6B" },
      { name: "네이비", hex: "#303236" },
      { name: "블랙", hex: "#1C1C1C" },
    ],
  },
  {
    id: "reflective-safety-jacket",
    sku: "WU-S004",
    line: "SITE",
    category: "소품",
    subCategory: "기타",
    isNew: true,
    reviewCount: 45,
    name: "반사띠 안전 자켓",
    tagline: "어두운 현장에서 내 존재를 알립니다.",
    price: "79,000원",
    features: ["360도 반사 테이프", "형광 옐로우 원단", "다용도 포켓 8개"],
    jobTypes: ["건설·현장"],
    bg: "bg-[#303236]",
    colors: [
      { name: "형광 옐로우", hex: "#FFD700" },
      { name: "형광 오렌지", hex: "#FF6600" },
    ],
  },
  {
    id: "quick-dry-long-sleeve",
    sku: "WU-S005",
    line: "SITE",
    category: "현장",
    subCategory: "상의",
    isNew: true,
    rating: 4.6,
    reviewCount: 58,
    name: "흡한속건 긴팔 티셔츠",
    tagline: "땀이 차기 전에 날아갑니다.",
    price: "25,000원",
    features: ["흡한속건 소재", "UPF 40+ 자외선 차단", "래글런 슬리브 (움직임 자유)"],
    jobTypes: ["물류·배달", "건설·현장"],
    bg: "bg-[#243d5e]",
    colors: [
      { name: "화이트", hex: "#F5F2ED" },
      { name: "그레이", hex: "#6B6B6B" },
      { name: "블랙", hex: "#1C1C1C" },
    ],
  },
  {
    id: "work-chino-pants",
    sku: "WU-D001",
    line: "DAILY",
    category: "일상",
    subCategory: "팬츠",
    isNew: true,
    rating: 4.5,
    reviewCount: 203,
    name: "워크 치노 팬츠",
    tagline: "현장 출근, 퇴근 후 카페. 옷 한 벌로.",
    price: "45,000원",
    features: ["스트레치 소재", "테이퍼드 핏", "4개 포켓"],
    jobTypes: ["매장·서비스", "일상"],
    wearerQuote: {
      job: "제조업 창업자",
      years: "창업 2년차",
      text: "오전엔 공장 바닥, 오후엔 바이어 미팅. 이 바지 하나로 다 해결됩니다.",
    },
    bg: "bg-[#3D3D3D]",
    colors: [
      { name: "베이지", hex: "#C8B89A" },
      { name: "카키", hex: "#4A5240" },
      { name: "블랙", hex: "#1C1C1C" },
      { name: "네이비", hex: "#303236" },
    ],
  },
  {
    id: "heavy-crewneck-sweatshirt",
    sku: "WU-D002",
    line: "DAILY",
    category: "일상",
    subCategory: "데일리웨어",
    isNew: true,
    rating: 4.9,
    reviewCount: 421,
    name: "헤비 크루넥 스웻셔츠",
    tagline: "출근도, 카페도, 퇴근도. 300g 기모.",
    price: "49,000원",
    features: ["300g 기모 안감", "루즈핏", "내구성 원단"],
    jobTypes: ["일상", "매장·서비스"],
    bg: "bg-[#4d4d4d]",
    colors: [
      { name: "차콜", hex: "#3D3D3D" },
      { name: "아이보리", hex: "#FFFFF0" },
      { name: "네이비", hex: "#303236" },
    ],
  },
  {
    id: "multi-pocket-vest",
    sku: "WU-D003",
    line: "DAILY",
    category: "현장",
    subCategory: "상의",
    isNew: true,
    rating: 4.8,
    reviewCount: 76,
    name: "멀티포켓 조끼",
    tagline: "포켓 9개. 공구 없어도 손이 자유롭습니다.",
    price: "35,000원",
    features: ["포켓 9개", "20D 나일론 (190g)", "지퍼 + 버튼 혼합"],
    jobTypes: ["물류·배달", "건설·현장"],
    bg: "bg-[#5a5a5a]",
    colors: [
      { name: "블랙", hex: "#1C1C1C" },
      { name: "네이비", hex: "#303236" },
      { name: "올리브", hex: "#556B2F" },
    ],
  },
  {
    id: "windproof-hoodie-zip",
    sku: "WU-D004",
    line: "DAILY",
    category: "일상",
    subCategory: "아우터",
    isNew: true,
    reviewCount: 29,
    name: "방풍 후드 집업",
    tagline: "바람 막는 일상복. 현장도 거리도 어색하지 않습니다.",
    price: "65,000원",
    features: ["방풍 안감", "후드 조절 가능", "지퍼 포켓"],
    jobTypes: ["아웃도어", "일상"],
    bg: "bg-[#3D3D3D]",
    colors: [
      { name: "블랙", hex: "#1C1C1C" },
      { name: "차콜", hex: "#3D3D3D" },
      { name: "네이비", hex: "#303236" },
    ],
  },
  {
    id: "work-rollup-shirt",
    sku: "WU-D005",
    line: "DAILY",
    category: "일상",
    subCategory: "데일리웨어",
    isNew: true,
    reviewCount: 61,
    name: "워크 롤업 셔츠",
    tagline: "롤업하면 작업복, 내리면 캐주얼.",
    price: "35,000원",
    features: ["롤업 버튼 처리", "구김 적은 소재", "넉넉한 패턴"],
    jobTypes: ["매장·서비스", "일상"],
    wearerQuote: {
      job: "카페 사장",
      years: "창업 3년차",
      text: "10시간 서 있어도 구겨지지 않아요. 손님 앞에서도 괜찮고 뒷정리할 때도 편하고.",
    },
    bg: "bg-[#4d4d4d]",
    colors: [
      { name: "화이트", hex: "#F5F2ED" },
      { name: "블루 스트라이프", hex: "#4A7FA5" },
      { name: "카키", hex: "#4A5240" },
    ],
  },

  // ── 현장 > 상의 ─────────────────────────────────────────────────────────────
  {
    id: "cooltech-long-sleeve",
    sku: "WU-S011",
    line: "SITE",
    category: "현장",
    subCategory: "상의",
    isNew: true,
    reviewCount: 156,
    name: "흡한속건 긴팔 티셔츠",
    tagline: "땀이 나도 5분이면 말라요.",
    price: "22,000원",
    features: ["흡한속건 기능", "UPF 40+ 자외선 차단", "항균 처리"],
    featureTags: ["흡한속건", "UV차단"],
    jobTypes: ["건설·현장", "물류·배달"],
    seasons: ["봄/가을", "여름"],
    bg: "bg-[#2d4f72]",
    colors: [
      { name: "네이비", hex: "#303236" },
      { name: "그레이", hex: "#7A7A7A" },
      { name: "블랙", hex: "#1C1C1C" },
    ],
  },
  {
    id: "functional-half-shirt",
    sku: "WU-S012",
    line: "SITE",
    category: "현장",
    subCategory: "상의",
    reviewCount: 98,
    name: "기능성 반팔 셔츠",
    tagline: "현장에서 입는 진짜 작업 셔츠.",
    price: "25,000원",
    features: ["스냅 버튼 포켓 2개", "어깨 보강 재봉", "스트레치 원단"],
    featureTags: ["스트레치", "고내구성"],
    jobTypes: ["건설·현장", "아웃도어"],
    seasons: ["봄/가을", "여름"],
    bg: "bg-[#3a5a3a]",
    colors: [
      { name: "카키", hex: "#4A5240" },
      { name: "올리브", hex: "#556B2F" },
      { name: "그레이", hex: "#7A7A7A" },
    ],
  },
  {
    id: "worker-long-shirt",
    sku: "WU-S013",
    line: "SITE",
    category: "현장",
    subCategory: "상의",
    reviewCount: 72,
    name: "현장용 긴팔 작업 셔츠",
    tagline: "소매를 접으면 여름, 내리면 봄가을.",
    price: "28,000원",
    features: ["롤업 슬리브 버튼", "앞 포켓 × 2", "내구성 강화 원단"],
    featureTags: ["고내구성"],
    jobTypes: ["건설·현장", "아웃도어"],
    seasons: ["봄/가을"],
    bg: "bg-[#4d3a2a]",
    colors: [
      { name: "베이지", hex: "#C9B99A" },
      { name: "카키", hex: "#4A5240" },
      { name: "블랙", hex: "#1C1C1C" },
    ],
  },
  {
    id: "cooling-polo-tee",
    sku: "WU-S014",
    line: "SITE",
    category: "현장",
    subCategory: "상의",
    isNew: true,
    reviewCount: 213,
    name: "쿨링 폴로 티셔츠",
    tagline: "폴로 칼라로 땀도 자외선도 차단.",
    price: "23,000원",
    features: ["냉감 소재", "칼라로 목 자외선 차단", "빠른 건조"],
    featureTags: ["냉감", "UV차단", "흡한속건"],
    jobTypes: ["건설·현장", "매장·서비스"],
    seasons: ["여름"],
    bg: "bg-[#1a4060]",
    colors: [
      { name: "화이트", hex: "#F5F2ED" },
      { name: "네이비", hex: "#303236" },
      { name: "그린", hex: "#2D7A3A" },
    ],
  },
  {
    id: "insect-repellent-longsleeve",
    sku: "WU-S015",
    line: "SITE",
    category: "현장",
    subCategory: "상의",
    reviewCount: 44,
    name: "방충 긴소매 티셔츠",
    tagline: "벌레 많은 현장도 이제 걱정 없어요.",
    price: "26,000원",
    features: ["천연 방충 가공", "목 밀착 밴드", "손목 조임 밴드"],
    featureTags: ["UV차단"],
    jobTypes: ["건설·현장", "아웃도어"],
    seasons: ["봄/가을", "여름"],
    bg: "bg-[#2d5a1a]",
    colors: [
      { name: "올리브", hex: "#556B2F" },
      { name: "그린", hex: "#2D7A3A" },
      { name: "블랙", hex: "#1C1C1C" },
    ],
  },
  {
    id: "vee-neck-cooling",
    sku: "WU-S016",
    line: "SITE",
    category: "현장",
    subCategory: "상의",
    reviewCount: 187,
    name: "V넥 기능성 반팔 티",
    tagline: "목이 시원해야 몸이 시원하다.",
    price: "18,000원",
    features: ["V넥 통기 설계", "냉감 원단", "경량 200g"],
    featureTags: ["냉감", "경량"],
    jobTypes: ["건설·현장", "물류·배달", "매장·서비스"],
    seasons: ["여름"],
    bg: "bg-[#4a4a4a]",
    colors: [
      { name: "화이트", hex: "#F5F2ED" },
      { name: "그레이", hex: "#7A7A7A" },
      { name: "블랙", hex: "#1C1C1C" },
      { name: "네이비", hex: "#303236" },
    ],
  },

  // ── 현장 > 하의 ─────────────────────────────────────────────────────────────
  {
    id: "waterproof-work-pants",
    sku: "WU-S021",
    line: "SITE",
    category: "현장",
    subCategory: "하의",
    reviewCount: 89,
    name: "방수 작업 바지",
    tagline: "비 와도 그냥 일해요.",
    price: "45,000원",
    features: ["발수 코팅", "내측 메쉬 라이닝", "무릎 더블 봉제"],
    featureTags: ["방수", "고내구성"],
    jobTypes: ["건설·현장", "아웃도어"],
    seasons: ["봄/가을"],
    bg: "bg-[#303236]",
    colors: [
      { name: "네이비", hex: "#303236" },
      { name: "블랙", hex: "#1C1C1C" },
      { name: "카키", hex: "#4A5240" },
    ],
  },
  {
    id: "work-shorts",
    sku: "WU-S022",
    line: "SITE",
    category: "현장",
    subCategory: "하의",
    isNew: true,
    reviewCount: 134,
    name: "현장 반바지",
    tagline: "여름 현장 필수템. 시원하고 든든.",
    price: "29,000원",
    features: ["멀티포켓 6개", "신축성 허리밴드", "무릎 위 짧은 기장"],
    featureTags: ["스트레치"],
    jobTypes: ["건설·현장", "아웃도어"],
    seasons: ["여름"],
    bg: "bg-[#3a4a2a]",
    colors: [
      { name: "카키", hex: "#4A5240" },
      { name: "블랙", hex: "#1C1C1C" },
      { name: "그레이", hex: "#7A7A7A" },
    ],
  },
  {
    id: "jogger-work-pants",
    sku: "WU-S023",
    line: "SITE",
    category: "현장",
    subCategory: "하의",
    reviewCount: 201,
    name: "기능성 조거팬츠",
    tagline: "작업복 같지 않아서 더 좋아요.",
    price: "38,000원",
    features: ["조거 밴드 밑단", "힙 쪽 강화 내구성 패치", "4방향 스트레치"],
    featureTags: ["스트레치", "고내구성"],
    jobTypes: ["건설·현장", "물류·배달"],
    seasons: ["봄/가을"],
    bg: "bg-[#2a2a2a]",
    colors: [
      { name: "블랙", hex: "#1C1C1C" },
      { name: "차콜", hex: "#3a3a3a" },
      { name: "네이비", hex: "#303236" },
    ],
  },
  {
    id: "denim-work-pants",
    sku: "WU-S024",
    line: "SITE",
    category: "현장",
    subCategory: "하의",
    reviewCount: 55,
    name: "덴임 작업 바지",
    tagline: "청바지지만 현장에서 버팁니다.",
    price: "49,000원",
    features: ["12온스 내구성 데님", "리벳 보강 처리", "무릎 패드 포켓"],
    featureTags: ["고내구성"],
    jobTypes: ["건설·현장", "아웃도어"],
    seasons: ["봄/가을"],
    bg: "bg-[#334d66]",
    colors: [
      { name: "인디고 블루", hex: "#2B4D80" },
      { name: "블랙 워싱", hex: "#2a2a2a" },
    ],
  },
  {
    id: "winter-work-pants",
    sku: "WU-S025",
    line: "SITE",
    category: "현장",
    subCategory: "하의",
    reviewCount: 67,
    name: "방한 작업 바지",
    tagline: "겨울 현장 한파도 버텨줍니다.",
    price: "55,000원",
    features: ["안감 기모 처리", "바람막이 원단", "무릎 이중 보강"],
    featureTags: ["보온", "방풍"],
    jobTypes: ["건설·현장"],
    seasons: ["겨울"],
    bg: "bg-[#1a2a3a]",
    colors: [
      { name: "네이비", hex: "#303236" },
      { name: "블랙", hex: "#1C1C1C" },
    ],
  },
  {
    id: "cooling-shorts",
    sku: "WU-S026",
    line: "SITE",
    category: "현장",
    subCategory: "하의",
    isNew: true,
    reviewCount: 176,
    name: "쿨링 반바지",
    tagline: "여름 현장의 기적, 안 더워요.",
    price: "25,000원",
    features: ["냉감 원단", "속건 처리", "4분할 포켓"],
    featureTags: ["냉감", "흡한속건"],
    jobTypes: ["건설·현장", "물류·배달", "아웃도어"],
    seasons: ["여름"],
    bg: "bg-[#2a4a6a]",
    colors: [
      { name: "그레이", hex: "#7A7A7A" },
      { name: "네이비", hex: "#303236" },
      { name: "블랙", hex: "#1C1C1C" },
    ],
  },

  // ── 현장 > 계절·기능 ────────────────────────────────────────────────────────
  {
    id: "winter-field-jacket",
    sku: "WU-S031",
    line: "SITE",
    category: "현장",
    subCategory: "계절·기능",
    reviewCount: 92,
    name: "동계 방한 자켓",
    tagline: "영하 10도도 현장에서 버팁니다.",
    price: "89,000원",
    features: ["덕다운 충전재 200g", "방풍 쉘 원단", "커프스 조절 밴드"],
    featureTags: ["보온", "방풍"],
    jobTypes: ["건설·현장"],
    seasons: ["겨울"],
    bg: "bg-[#303236]",
    colors: [
      { name: "네이비", hex: "#303236" },
      { name: "블랙", hex: "#1C1C1C" },
      { name: "올리브", hex: "#556B2F" },
    ],
  },
  {
    id: "rain-gear-set",
    sku: "WU-S032",
    line: "SITE",
    category: "현장",
    subCategory: "계절·기능",
    reviewCount: 48,
    name: "현장 우비 세트",
    tagline: "장마철 현장도 업무 중단 없이.",
    price: "55,000원",
    features: ["상하의 세트", "테이프 씰링 솔기", "야광 반사 테이프"],
    featureTags: ["방수"],
    jobTypes: ["건설·현장", "아웃도어"],
    seasons: ["봄/가을", "여름"],
    bg: "bg-[#1a4a1a]",
    colors: [
      { name: "형광 옐로우", hex: "#D4AA00" },
      { name: "올리브", hex: "#556B2F" },
    ],
  },
  {
    id: "down-vest-site",
    sku: "WU-S033",
    line: "SITE",
    category: "현장",
    subCategory: "계절·기능",
    isNew: true,
    reviewCount: 113,
    name: "조끼 패딩",
    tagline: "팔 자유롭고 몸통은 따뜻하게.",
    price: "65,000원",
    features: ["충전재 150g", "민소매로 팔 활동 자유", "반사 스트립"],
    featureTags: ["보온", "경량"],
    jobTypes: ["건설·현장", "물류·배달"],
    seasons: ["겨울", "봄/가을"],
    bg: "bg-[#2a3a4a]",
    colors: [
      { name: "네이비", hex: "#303236" },
      { name: "블랙", hex: "#1C1C1C" },
      { name: "레드", hex: "#CC2020" },
    ],
  },
  {
    id: "summer-cooling-jacket",
    sku: "WU-S034",
    line: "SITE",
    category: "현장",
    subCategory: "계절·기능",
    reviewCount: 78,
    name: "여름 쿨링 자켓",
    tagline: "자켓 입는데 시원한 마법.",
    price: "49,000원",
    features: ["아이스 쿨 소재", "등판 메쉬 패널", "UPF 50+ 자외선 완전 차단"],
    featureTags: ["냉감", "UV차단", "경량"],
    jobTypes: ["건설·현장", "아웃도어"],
    seasons: ["여름"],
    bg: "bg-[#1a3a5a]",
    colors: [
      { name: "화이트", hex: "#F5F2ED" },
      { name: "블루", hex: "#1E6FCC" },
      { name: "그레이", hex: "#7A7A7A" },
    ],
  },

  // ── 현장 > 안전용품 ─────────────────────────────────────────────────────────
  {
    id: "hi-vis-safety-vest",
    sku: "WU-A001",
    line: "SITE",
    category: "현장",
    subCategory: "안전용품",
    isNew: false,
    reviewCount: 234,
    name: "형광 안전 조끼",
    tagline: "어둠 속에서도 내 위치를 알립니다.",
    price: "15,000원",
    features: ["형광 옐로우·오렌지 반사", "360도 반사 테이프", "조절 가능 사이즈"],
    featureTags: [],
    jobTypes: ["건설·현장", "물류·배달"],
    bg: "bg-[#cc8800]",
    colors: [
      { name: "형광 옐로우", hex: "#D4AA00" },
      { name: "형광 오렌지", hex: "#E05A10" },
    ],
  },
  {
    id: "safety-helmet-basic",
    sku: "WU-A002",
    line: "SITE",
    category: "현장",
    subCategory: "안전용품",
    reviewCount: 187,
    name: "산업 안전 헬멧",
    tagline: "머리를 지켜야 가족이 기다립니다.",
    price: "45,000원",
    features: ["ABS 외피 내충격", "내부 폼 쿠션", "턱 끈 조절"],
    featureTags: [],
    jobTypes: ["건설·현장"],
    bg: "bg-[#cc8800]",
    colors: [
      { name: "화이트", hex: "#F5F2ED" },
      { name: "옐로우", hex: "#D4AA00" },
      { name: "레드", hex: "#CC2020" },
      { name: "블루", hex: "#1E6FCC" },
    ],
  },
  {
    id: "knee-protector-work",
    sku: "WU-A003",
    line: "SITE",
    category: "현장",
    subCategory: "안전용품",
    reviewCount: 95,
    name: "무릎 보호대",
    tagline: "무릎 하나로 버티는 현장 베테랑.",
    price: "28,000원",
    features: ["PE 경질 쉘", "겔 쿠션 내피", "미끄럼 방지 고정 밴드"],
    featureTags: [],
    jobTypes: ["건설·현장"],
    bg: "bg-[#2a3a4a]",
    colors: [
      { name: "블랙", hex: "#1C1C1C" },
      { name: "그레이", hex: "#7A7A7A" },
    ],
  },
  {
    id: "back-support-belt",
    sku: "WU-A004",
    line: "SITE",
    category: "현장",
    subCategory: "안전용품",
    reviewCount: 142,
    name: "허리 보호대",
    tagline: "허리가 버텨줘야 오래 일합니다.",
    price: "35,000원",
    features: ["척추 지지 보강 스트립", "복압 조절 벨크로", "통기성 메쉬 소재"],
    featureTags: [],
    jobTypes: ["건설·현장", "물류·배달"],
    bg: "bg-[#2a2a2a]",
    colors: [
      { name: "블랙", hex: "#1C1C1C" },
    ],
  },

  // ── 여성 > 여성 상의 ────────────────────────────────────────────────────────
  {
    id: "womens-cooling-tee",
    sku: "WU-W001",
    line: "SITE",
    category: "여성",
    subCategory: "여성 상의",
    isNew: true,
    reviewCount: 198,
    name: "여성 쿨링 반팔 티셔츠",
    tagline: "여성 작업자를 위한 냉감 티.",
    price: "19,000원",
    features: ["여성 전용 패턴", "냉감 기능 원단", "흡한속건"],
    featureTags: ["냉감", "흡한속건"],
    jobTypes: ["건설·현장", "물류·배달", "매장·서비스"],
    seasons: ["여름"],
    bg: "bg-[#2d4f72]",
    colors: [
      { name: "화이트", hex: "#F5F2ED" },
      { name: "그레이", hex: "#7A7A7A" },
      { name: "핑크", hex: "#CC4080" },
      { name: "네이비", hex: "#303236" },
    ],
  },
  {
    id: "womens-quickdry-long",
    sku: "WU-W002",
    line: "SITE",
    category: "여성",
    subCategory: "여성 상의",
    reviewCount: 123,
    name: "여성 흡한속건 긴팔 티",
    tagline: "봄가을 현장도 땀 걱정 없게.",
    price: "22,000원",
    features: ["여성 슬림 핏", "흡한속건 기능", "UPF 40+"],
    featureTags: ["흡한속건", "UV차단"],
    jobTypes: ["건설·현장", "매장·서비스"],
    seasons: ["봄/가을"],
    bg: "bg-[#3a2d5a]",
    colors: [
      { name: "민트", hex: "#40A08A" },
      { name: "라벤더", hex: "#8A80C0" },
      { name: "그레이", hex: "#7A7A7A" },
    ],
  },
  {
    id: "womens-work-shirt",
    sku: "WU-W003",
    line: "SITE",
    category: "여성",
    subCategory: "여성 상의",
    reviewCount: 56,
    name: "여성 작업 셔츠",
    tagline: "여성 현장인을 위한 기능성 셔츠.",
    price: "27,000원",
    features: ["여성 전용 너비", "포켓 2개", "스트레치 원단"],
    featureTags: ["스트레치"],
    jobTypes: ["건설·현장", "매장·서비스"],
    seasons: ["봄/가을", "여름"],
    bg: "bg-[#3a4a2a]",
    colors: [
      { name: "카키", hex: "#4A5240" },
      { name: "베이지", hex: "#C9B99A" },
      { name: "블랙", hex: "#1C1C1C" },
    ],
  },
  {
    id: "womens-polo-tee",
    sku: "WU-W004",
    line: "SITE",
    category: "여성",
    subCategory: "여성 상의",
    isNew: true,
    reviewCount: 89,
    name: "여성 쿨링 폴로 티",
    tagline: "칼라 있어서 더 시원한 역설.",
    price: "23,000원",
    features: ["냉감 폴리 원단", "넥 자외선 차단 칼라", "여성 슬림 핏"],
    featureTags: ["냉감", "UV차단"],
    jobTypes: ["매장·서비스", "건설·현장"],
    seasons: ["여름"],
    bg: "bg-[#1a4060]",
    colors: [
      { name: "화이트", hex: "#F5F2ED" },
      { name: "네이비", hex: "#303236" },
      { name: "핑크", hex: "#CC4080" },
    ],
  },
  {
    id: "womens-zip-top",
    sku: "WU-W005",
    line: "SITE",
    category: "여성",
    subCategory: "여성 상의",
    reviewCount: 67,
    name: "여성 기능성 집업 티",
    tagline: "반만 올려도 스타일, 다 내려도 작업복.",
    price: "31,000원",
    features: ["하프 집업 설계", "스탠드 칼라 바람막이", "스트레치 기능"],
    featureTags: ["스트레치", "방풍"],
    jobTypes: ["건설·현장", "아웃도어"],
    seasons: ["봄/가을"],
    bg: "bg-[#2a3a4a]",
    colors: [
      { name: "블랙", hex: "#1C1C1C" },
      { name: "네이비", hex: "#303236" },
      { name: "그레이", hex: "#7A7A7A" },
    ],
  },

  // ── 여성 > 여성 하의 ────────────────────────────────────────────────────────
  {
    id: "womens-stretch-cargo",
    sku: "WU-W011",
    line: "SITE",
    category: "여성",
    subCategory: "여성 하의",
    isNew: true,
    reviewCount: 145,
    name: "여성 스트레치 카고 팬츠",
    tagline: "현장에서도 예쁘게 입을 수 있어요.",
    price: "39,000원",
    features: ["여성 전용 와이드 핏", "카고 포켓 4개", "스트레치율 30%"],
    featureTags: ["스트레치"],
    jobTypes: ["건설·현장", "물류·배달"],
    seasons: ["봄/가을"],
    bg: "bg-[#3a4a2a]",
    colors: [
      { name: "카키", hex: "#4A5240" },
      { name: "블랙", hex: "#1C1C1C" },
      { name: "베이지", hex: "#C9B99A" },
    ],
  },
  {
    id: "womens-functional-pants",
    sku: "WU-W012",
    line: "SITE",
    category: "여성",
    subCategory: "여성 하의",
    reviewCount: 78,
    name: "여성 기능성 팬츠",
    tagline: "움직임에 맞춰 늘어나는 현장 팬츠.",
    price: "35,000원",
    features: ["4방향 스트레치", "허리 고무 밴드", "미끄럼 방지 밑단"],
    featureTags: ["스트레치"],
    jobTypes: ["건설·현장", "매장·서비스"],
    seasons: ["봄/가을"],
    bg: "bg-[#2a2a2a]",
    colors: [
      { name: "블랙", hex: "#1C1C1C" },
      { name: "네이비", hex: "#303236" },
      { name: "그레이", hex: "#7A7A7A" },
    ],
  },
  {
    id: "womens-work-shorts",
    sku: "WU-W013",
    line: "SITE",
    category: "여성",
    subCategory: "여성 하의",
    reviewCount: 102,
    name: "여성 작업 반바지",
    tagline: "여름 현장도 여성스럽게.",
    price: "25,000원",
    features: ["여성 전용 패턴", "내부 반바지 일체형", "쿨링 원단"],
    featureTags: ["냉감"],
    jobTypes: ["건설·현장", "매장·서비스"],
    seasons: ["여름"],
    bg: "bg-[#1a3a5a]",
    colors: [
      { name: "블랙", hex: "#1C1C1C" },
      { name: "네이비", hex: "#303236" },
      { name: "카키", hex: "#4A5240" },
    ],
  },

  // ── 여성 > 여성 아우터 ──────────────────────────────────────────────────────
  {
    id: "womens-windbreaker",
    sku: "WU-W021",
    line: "SITE",
    category: "여성",
    subCategory: "여성 아우터",
    isNew: true,
    reviewCount: 84,
    name: "여성 경량 방풍 자켓",
    tagline: "여성 작업자도 가볍게, 따뜻하게.",
    price: "55,000원",
    features: ["290g 초경량", "방풍 100%", "발수 가공"],
    featureTags: ["방풍", "방수", "경량"],
    jobTypes: ["건설·현장", "아웃도어"],
    seasons: ["봄/가을"],
    bg: "bg-[#1a3a5a]",
    colors: [
      { name: "네이비", hex: "#303236" },
      { name: "퍼플", hex: "#6B3FA0" },
      { name: "블랙", hex: "#1C1C1C" },
    ],
  },
  {
    id: "womens-winter-jacket",
    sku: "WU-W022",
    line: "SITE",
    category: "여성",
    subCategory: "여성 아우터",
    reviewCount: 61,
    name: "여성 방한 패딩 자켓",
    tagline: "겨울 현장도 스타일 포기 안 해요.",
    price: "79,000원",
    features: ["덕다운 충전재 180g", "여성 슬림 핏", "모피 후드 탈착"],
    featureTags: ["보온"],
    jobTypes: ["건설·현장"],
    seasons: ["겨울"],
    bg: "bg-[#1a2a3a]",
    colors: [
      { name: "블랙", hex: "#1C1C1C" },
      { name: "네이비", hex: "#303236" },
      { name: "베이지", hex: "#C9B99A" },
    ],
  },

  // ── 소품 > 양말 ─────────────────────────────────────────────────────────────
  {
    id: "cushion-work-socks",
    sku: "WU-P001",
    line: "SITE",
    category: "소품",
    subCategory: "양말",
    isNew: false,
    reviewCount: 312,
    name: "현장 쿠션 안전 양말",
    tagline: "발바닥 쿠션이 피로를 반으로 줄입니다.",
    price: "8,000원",
    features: ["발바닥 테리 쿠션", "발목 아치 서포트", "땀 흡수 면 소재"],
    featureTags: [],
    jobTypes: ["건설·현장", "물류·배달"],
    bg: "bg-[#2a2a2a]",
    colors: [
      { name: "화이트", hex: "#F5F2ED" },
      { name: "그레이", hex: "#7A7A7A" },
      { name: "블랙", hex: "#1C1C1C" },
    ],
  },
  {
    id: "coolmax-socks",
    sku: "WU-P002",
    line: "SITE",
    category: "소품",
    subCategory: "양말",
    reviewCount: 156,
    name: "쿨맥스 기능성 양말",
    tagline: "여름 현장 발도 시원해야 합니다.",
    price: "9,000원",
    features: ["쿨맥스 원단", "발가락 강화 처리", "항균 방취"],
    featureTags: ["냉감"],
    jobTypes: ["건설·현장", "아웃도어"],
    seasons: ["여름"],
    bg: "bg-[#1a4060]",
    colors: [
      { name: "화이트", hex: "#F5F2ED" },
      { name: "블루", hex: "#1E6FCC" },
    ],
  },
  {
    id: "waterproof-socks",
    sku: "WU-P003",
    line: "SITE",
    category: "소품",
    subCategory: "양말",
    reviewCount: 78,
    name: "방수 현장 양말",
    tagline: "발만큼은 절대 젖지 않습니다.",
    price: "18,000원",
    features: ["3중 방수 레이어", "드라이맥스 인너", "발목 씰링 처리"],
    featureTags: ["방수"],
    jobTypes: ["건설·현장", "아웃도어"],
    seasons: ["봄/가을"],
    bg: "bg-[#1a3a1a]",
    colors: [
      { name: "블랙", hex: "#1C1C1C" },
      { name: "그린", hex: "#2D7A3A" },
    ],
  },
  {
    id: "tough-work-socks",
    sku: "WU-P004",
    line: "SITE",
    category: "소품",
    subCategory: "양말",
    reviewCount: 245,
    name: "터프 작업 양말 3켤레",
    tagline: "1년 신어도 구멍 안 납니다.",
    price: "22,000원",
    features: ["강화 나일론 혼방", "발가락·발뒤꿈치 이중 두께", "세트 3켤레"],
    featureTags: ["고내구성"],
    jobTypes: ["건설·현장", "물류·배달"],
    bg: "bg-[#2a2a2a]",
    colors: [
      { name: "블랙", hex: "#1C1C1C" },
      { name: "그레이", hex: "#7A7A7A" },
      { name: "네이비", hex: "#303236" },
    ],
  },

  // ── 소품 > 가방 ─────────────────────────────────────────────────────────────
  {
    id: "field-tool-backpack",
    sku: "WU-P011",
    line: "SITE",
    category: "소품",
    subCategory: "가방",
    reviewCount: 87,
    name: "현장 공구 백팩",
    tagline: "공구부터 도시락까지 다 들어갑니다.",
    price: "65,000원",
    features: ["35L 대용량", "공구 정리 포켓", "방수 코팅 원단"],
    featureTags: ["방수", "고내구성"],
    jobTypes: ["건설·현장", "아웃도어"],
    bg: "bg-[#2a2a2a]",
    colors: [
      { name: "블랙", hex: "#1C1C1C" },
      { name: "카키", hex: "#4A5240" },
    ],
  },
  {
    id: "waterproof-hip-bag",
    sku: "WU-P012",
    line: "SITE",
    category: "소품",
    subCategory: "가방",
    isNew: true,
    reviewCount: 134,
    name: "방수 힙색",
    tagline: "현장에서 핸즈프리로 가볍게.",
    price: "28,000원",
    features: ["방수 TPU 소재", "허리 조절 버클", "파우치 포켓 분리"],
    featureTags: ["방수"],
    jobTypes: ["건설·현장", "아웃도어", "물류·배달"],
    bg: "bg-[#1a3a1a]",
    colors: [
      { name: "블랙", hex: "#1C1C1C" },
      { name: "올리브", hex: "#556B2F" },
      { name: "오렌지", hex: "#E05A10" },
    ],
  },

  // ── 소품 > 모자 ─────────────────────────────────────────────────────────────
  {
    id: "uv-bucket-hat",
    sku: "WU-P021",
    line: "SITE",
    category: "소품",
    subCategory: "모자",
    isNew: true,
    reviewCount: 178,
    name: "UV 차단 버킷햇",
    tagline: "머리도 얼굴도 목도 자외선 차단.",
    price: "22,000원",
    features: ["UPF 50+ 자외선 차단", "넓은 챙 전면 차단", "통기 메쉬 인서트"],
    featureTags: ["UV차단"],
    jobTypes: ["건설·현장", "아웃도어"],
    seasons: ["여름"],
    bg: "bg-[#cc8800]",
    colors: [
      { name: "베이지", hex: "#C9B99A" },
      { name: "카키", hex: "#4A5240" },
      { name: "그레이", hex: "#7A7A7A" },
    ],
  },
  {
    id: "cooling-work-cap",
    sku: "WU-P022",
    line: "SITE",
    category: "소품",
    subCategory: "모자",
    reviewCount: 203,
    name: "쿨링 작업 캡",
    tagline: "머리가 시원해야 집중력이 올라간다.",
    price: "18,000원",
    features: ["냉감 내피", "앞챙 자외선 차단", "사이즈 조절 버클"],
    featureTags: ["냉감", "UV차단"],
    jobTypes: ["건설·현장", "물류·배달", "아웃도어"],
    seasons: ["여름"],
    bg: "bg-[#1a2a3a]",
    colors: [
      { name: "블랙", hex: "#1C1C1C" },
      { name: "네이비", hex: "#303236" },
      { name: "그레이", hex: "#7A7A7A" },
    ],
  },

  // ── 소품 > 장갑 ─────────────────────────────────────────────────────────────
  {
    id: "anti-vibration-gloves",
    sku: "WU-P031",
    line: "SITE",
    category: "소품",
    subCategory: "장갑",
    reviewCount: 119,
    name: "방진 작업 장갑",
    tagline: "진동 공구 쓸 때 손이 안 저려요.",
    price: "12,000원",
    features: ["젤 방진 패드", "손바닥 미끄럼 방지", "벨크로 손목 고정"],
    featureTags: [],
    jobTypes: ["건설·현장"],
    bg: "bg-[#2a2a2a]",
    colors: [
      { name: "블랙", hex: "#1C1C1C" },
      { name: "그레이", hex: "#7A7A7A" },
    ],
  },

  // ── 소품 > 벨트 ─────────────────────────────────────────────────────────────
  {
    id: "work-tool-belt",
    sku: "WU-P041",
    line: "SITE",
    category: "소품",
    subCategory: "벨트",
    isNew: false,
    reviewCount: 67,
    name: "현장 공구 벨트",
    tagline: "공구를 허리에 달고 다닙니다.",
    price: "38,000원",
    features: ["6개 공구 홀더", "내구성 나일론 원단", "퀵릴리즈 버클"],
    featureTags: ["고내구성"],
    jobTypes: ["건설·현장"],
    bg: "bg-[#3a2a1a]",
    colors: [
      { name: "블랙", hex: "#1C1C1C" },
      { name: "베이지", hex: "#C9B99A" },
    ],
  },
];

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export const jobTypes: JobType[] = [
  "건설·현장",
  "물류·배달",
  "매장·서비스",
  "아웃도어",
  "일상",
];

export const lineTypes: LineType[] = ["SITE", "DAILY", "PRO"];
