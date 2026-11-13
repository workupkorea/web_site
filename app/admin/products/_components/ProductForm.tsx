"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Product, DetailBlock, MainExpose, Season, SizeGuide, SizeGuideLine, DetailInfoItem, InstagramMedia } from "@/data/products";
import { SIZE_NOTE_DEFAULT } from "@/data/products";
import { parseInstagramUrl } from "@/lib/instagram-feed";
import { resizeImageToMaxWidth } from "@/lib/imageResize";
import { generateSubThumbnail } from "@/lib/thumbnailGenerator";
import SizeGuideLinesOverlay from "@/components/SizeGuideLinesOverlay";

// 사이즈 가이드 이미지 기준 폭 — 초과 시 이 폭으로 축소, 이하면 원본 그대로 업로드
const SIZE_GUIDE_MAX_WIDTH = 800;

// 업로드 에러를 어느 섹션 근처에 표시할지 구분하는 태그 — 폼이 길어서 에러가
// 엉뚱한(예: 상세 설명에서 난 에러가 추가 이미지 밑에 뜨는) 위치에 나오는 걸 방지한다.
type UploadZone = "main" | "sub" | "detail" | "sizeGuide" | "instagram" | "folder";

// 숫자·범위(예: 88-92) 값에 "cm" 단위 붙임. 빈 값·비숫자·이미 cm면 원본 그대로.
function appendCmUnit(v: string): string {
  const t = (v ?? "").trim();
  if (!t || /cm\s*$/i.test(t) || !/^[\d.,~\-\s]+$/.test(t)) return v;
  return `${t}cm`;
}

// ── 상수 ──────────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ["판매중", "품절", "판매중지", "예약판매", "진열대기"] as const;
// 상세 정보 탭 기본 라벨 (필요 항목만 값 입력 → 빈 값은 노출 안 됨)
const DETAIL_INFO_DEFAULTS = [
  "제품정보", "품명 및 모델명", "소재", "색상", "사이즈", "제조국·제조지",
  "세탁방법 및 취급시 주의사항", "제조연월", "품질보증기준",
  "A/S 책임자와 전화번호 / 소비자상담관련 전화번호",
];
const SIZE_GUIDE_DEFAULT: SizeGuide = {
  mode: "table",
  columns: ["항목", "S", "M", "L", "XL", "XXL"],
  rows: [],
  note: SIZE_NOTE_DEFAULT,
};
// 사이즈 가이드 행(측정 항목) 템플릿 — 클릭 시 항목 행 자동 구성 (사이즈 열은 기존 값 유지)
const SIZE_GUIDE_ROW_TEMPLATES: { label: string; firstCol: string; rows: string[] }[] = [
  { label: "티셔츠", firstCol: "항목", rows: ["총장", "어깨너비", "가슴둘레", "밑단너비", "소매길이", "전체 팔길이", "밑단둘레", "가슴너비"] },
  { label: "바지", firstCol: "항목", rows: ["허리", "힙", "밑위", "인심(다리길이)", "허벅지너비", "밑단 너비"] },
  { label: "상하세트", firstCol: "사이즈", rows: ["총장", "어깨너비", "가슴둘레", "허리둘레", "소매길이", "전체 팔길이", "인심(다리길이)", "허리", "밑단둘레"] },
];
// 측정 위치 안내 이미지 위 가이드선 프리셋 — 클릭 시 기본 위치(%)로 추가, 이후 숫자로 미세 조정
const SIZE_GUIDE_LINE_PRESETS: SizeGuideLine[] = [
  { label: "어깨", orientation: "horizontal", pos: 15, start: 25, end: 75 },
  { label: "가슴", orientation: "horizontal", pos: 45, start: 15, end: 85 },
  { label: "소매", orientation: "vertical", pos: 8, start: 24, end: 88 },
  { label: "총장", orientation: "vertical", pos: 92, start: 8, end: 90 },
];
const SEASON_OPTIONS: Season[] = ["봄/가을", "여름", "겨울"];
const FEATURE_TAG_PRESETS = ["냉감", "방수", "방풍", "스트레치", "고내구성", "UV차단", "흡한속건", "경량", "보온", "반사"];
const JOB_SITE_PRESETS = ["건설", "물류", "정비", "배달", "농업", "서비스", "캠핑"];
const MAIN_EXPOSE_OPTIONS: MainExpose[] = ["신상품", "추천상품", "베스트", "기획전"];
const CLOTHING_SIZE_PRESETS = ["S", "M", "L", "XL", "2XL", "3XL", "4XL"];
// 직접 입력 사이즈 빠른 템플릿 (신발·단독사이즈 등) — 클릭 시 해당 사이즈 세트로 교체
const SIZE_TEMPLATES: { label: string; sizes: string[] }[] = [
  { label: "신발 (230–290)", sizes: ["230", "235", "240", "245", "250", "255", "260", "265", "270", "275", "280", "285", "290"] },
  { label: "허리인치 (28–38)", sizes: ["28", "30", "32", "34", "36", "38"] },
  { label: "ONE SIZE", sizes: ["ONE SIZE"] },
];
// 의류 사이즈 표준 순서 — 클릭·입력 순서와 무관하게 항상 이 순서로 정렬한다.
const CLOTHING_SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"];
// 인식된 의류 사이즈(S~6XL)는 표준 순서로, 신발·허리인치 등 그 외 값은 기존 순서를 그대로 유지한다
// (숫자 사이즈까지 이 규칙에 끌려오면 신발 사이즈 템플릿이 깨지므로 대소문자만 무시하고 매칭).
function sortSizes(sizes: string[]): string[] {
  const rankOf = (s: string) => {
    const i = CLOTHING_SIZE_ORDER.indexOf(s.trim().toUpperCase());
    return i === -1 ? null : i;
  };
  return [...sizes].sort((a, b) => {
    const ra = rankOf(a), rb = rankOf(b);
    if (ra !== null && rb !== null) return ra - rb;
    if (ra !== null) return -1;
    if (rb !== null) return 1;
    return 0;
  });
}
const COLOR_PRESETS = [
  { name: "블랙",   hex: "#1C1C1C" },
  { name: "화이트", hex: "#F0F0F0" },
  { name: "네이비", hex: "#303236" },
  { name: "그레이", hex: "#7A7A7A" },
  { name: "베이지", hex: "#C9B99A" },
  { name: "카키",   hex: "#4A5240" },
];
const DEFAULT_SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL"];

type CategoryEntry = { main: string; sub: string };

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[가-힣]/g, (c) => c.charCodeAt(0).toString(16));
}

function formatPrice(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR") + "원";
}

type FormData = {
  id: string;
  sku: string;
  brand: string;
  hideBrandPrefix: boolean;
  manufacturer: string;
  origin: string;
  name: string;
  line: string;
  categories: CategoryEntry[];
  tagline: string;
  price: string;
  consumerPrice: string;
  supplyPrice: string;
  status: string;
  seasons: string[];
  promoStart: string;
  promoEnd: string;
  imageUrl: string;
  subImages: string[];
  videoUrl: string;
  instagramPosts: InstagramMedia[];
  detailBlocks: (Omit<DetailBlock, "id"> & { id: string })[];
  features: string;
  featureTags: string[];
  customFeatureTag: string;
  jobSites: string[];
  customJobSite: string;
  mainExpose: string[];
  sizes: string[];
  sizePrices: { size: string; price: string }[];
  sizeGuides: SizeGuide[];
  detailInfo: DetailInfoItem[];
  customSizeInput: string;
  colorName: string;
  colorHex: string;
  colors: { name: string; hex: string }[];
  relatedIds: string[];
  metaTitle: string;
  metaDesc: string;
  fieldTest: string;
  isNew: boolean;
  registrationStatus: "임시등록" | "정식등록";
};

function toForm(p?: Product): FormData {
  // 기존 단일 카테고리 or 신규 다중 카테고리 모두 지원
  const rawCats = (p as Record<string, unknown> | undefined)?.categories as CategoryEntry[] | undefined;
  const categories: CategoryEntry[] = rawCats?.length
    ? rawCats
    : p?.category
      ? [{ main: p.category as string, sub: (p.subCategory ?? "") as string }]
      : [{ main: "현장", sub: "상의" }];

  return {
    id: p?.id ?? "",
    sku: p?.sku ?? "",
    brand: p?.brand ?? "",
    hideBrandPrefix: p?.hideBrandPrefix ?? false,
    manufacturer: p?.manufacturer ?? "",
    origin: p?.origin ?? "",
    name: p?.name ?? "",
    line: p?.line ?? "SITE",
    categories,
    tagline: p?.tagline ?? "",
    price: p?.price ?? "",
    consumerPrice: p?.consumerPrice ?? "",
    supplyPrice: p?.supplyPrice ?? "",
    status: p?.status ?? "판매중",
    seasons: p?.seasons ?? [],
    promoStart: p?.promoStart ?? "",
    promoEnd: p?.promoEnd ?? "",
    imageUrl: p?.imageUrl ?? "",
    subImages: p?.subImages ?? [],
    videoUrl: p?.videoUrl ?? "",
    instagramPosts: p?.instagramPosts ?? [],
    detailBlocks: p?.detailBlocks ?? [],
    features: (p?.features ?? []).join("\n"),
    featureTags: p?.featureTags ?? [],
    customFeatureTag: "",
    jobSites: p?.jobSites ?? [],
    customJobSite: "",
    mainExpose: p?.mainExpose ?? (p?.isNew ? ["신상품"] : []),
    sizes: sortSizes(p?.sizes ?? DEFAULT_SIZES),
    sizePrices: (p?.sizePrices ?? []).map((sp) => ({ size: sp.size, price: sp.price })),
    // 안내 문구는 기본 문구로 미리 채운다(기존 상품 포함). note가 명시적으로 ""이면(사용자가 지운 것) 그대로 유지
    // 사이즈 가이드 목록 — 신규(sizeGuides) 우선, 레거시 단일(sizeGuide) 수용, 없으면 기본 1개
    sizeGuides: (() => {
      const list = (p?.sizeGuides && p.sizeGuides.length > 0)
        ? p.sizeGuides
        : (p?.sizeGuide ? [p.sizeGuide] : [{ ...SIZE_GUIDE_DEFAULT }]);
      return list.map((g) => ({ ...g, note: g.note ?? SIZE_NOTE_DEFAULT }));
    })(),
    detailInfo: p?.detailInfo ?? [],
    customSizeInput: "",
    colorName: "",
    colorHex: "#303236",
    colors: p?.colors ?? [],
    relatedIds: p?.relatedIds ?? [],
    metaTitle: p?.metaTitle ?? "",
    metaDesc: p?.metaDesc ?? "",
    fieldTest: p?.fieldTest ?? "",
    isNew: p?.isNew ?? false,
    registrationStatus: p?.registrationStatus ?? "정식등록",
  };
}

// ─── UI 헬퍼 ──────────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold text-[#303236] uppercase tracking-widest border-b border-gray-100 pb-3 mb-5">
      {children}
    </h2>
  );
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

const INPUT_CLS = "w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#303236] rounded";
const SELECT_CLS = `${INPUT_CLS} bg-white`;

function SaveBar({ saving, isEdit, onCancel, onPreview, status, onStatusChange }: {
  saving: boolean; isEdit?: boolean; onCancel: () => void; onPreview: () => void;
  status: string; onStatusChange: (s: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <select value={status} onChange={(e) => onStatusChange(e.target.value)}
        title="판매 상태"
        className="border border-gray-200 px-3 py-2.5 text-sm bg-white rounded focus:outline-none focus:border-[#303236]">
        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button type="button" onClick={onPreview}
        className="px-5 py-2.5 border border-[#303236] text-[#303236] text-sm font-semibold hover:bg-[#303236] hover:text-white transition-colors rounded">
        미리보기
      </button>
      <button type="submit" disabled={saving}
        className="px-8 py-2.5 bg-[#E5541B] text-white text-sm font-semibold hover:bg-[#e04500] transition-colors disabled:opacity-50 rounded">
        {saving ? "저장 중..." : isEdit ? "수정 완료" : "제품 추가"}
      </button>
      <button type="button" onClick={onCancel}
        className="px-8 py-2.5 border border-gray-200 text-gray-600 text-sm hover:border-gray-400 transition-colors rounded">
        취소
      </button>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function ProductForm({ initial, isEdit }: { initial?: Product; isEdit?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(toForm(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 이미지 업로드 상태
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingSubIdx, setUploadingSubIdx] = useState<number | null>(null);
  const [uploadingBlockIdx, setUploadingBlockIdx] = useState<number | null>(null);
  const [uploadingSizeGuide, setUploadingSizeGuide] = useState(false);
  const [uploadingSizeDiagram, setUploadingSizeDiagram] = useState(false);
  const [activeGuideIdx, setActiveGuideIdx] = useState(0);   // 편집 중인 사이즈 가이드 인덱스
  // 등록 화면을 짧게 유지하기 위해 기본 접힘으로 시작하는 섹션들
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [detailInfoOpen, setDetailInfoOpen] = useState(false);
  const [instagramFeedOpen, setInstagramFeedOpen] = useState(false);
  const [folderHelpOpen, setFolderHelpOpen] = useState(false); // 폴더 일괄 업로드 규칙 안내 ? 아이콘
  const [videoHelpOpen, setVideoHelpOpen] = useState(false); // 동영상 URL 안내 ? 아이콘
  const [detailBlocksHelpOpen, setDetailBlocksHelpOpen] = useState(false); // 상세 설명 안내 ? 아이콘
  // 사이즈 가이드 이미지 크기 표시 (표시용 · onLoad로 실제 픽셀 읽음) + 방금 업로드 시 축소 여부
  const [sgImageDim, setSgImageDim] = useState<{ w: number; h: number } | null>(null);
  const [sgImageResized, setSgImageResized] = useState(false);
  const [sgDiagramDim, setSgDiagramDim] = useState<{ w: number; h: number } | null>(null);
  const [sgDiagramResized, setSgDiagramResized] = useState(false);
  const [uploadingIgIdx, setUploadingIgIdx] = useState<number | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);   // 사이즈표 무료 OCR 진행 상태
  const [ocrProgress, setOcrProgress] = useState(0);
  const [bulkColInput, setBulkColInput] = useState("");  // 사이즈 가이드 열 일괄 추가 입력
  const [bulkRowInput, setBulkRowInput] = useState("");  // 사이즈 가이드 행 일괄 추가 입력
  const [uploadingMulti, setUploadingMulti] = useState(false);
  // 업로드 에러는 발생 지점(zone) 근처에 보여줘야 하므로, 어느 섹션에서 난 에러인지 함께 저장한다.
  const [uploadError, setUploadError] = useState<{ zone: UploadZone; message: string } | null>(null);


  const mainInputRef = useRef<HTMLInputElement>(null);
  const subInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const blockImgRefs = useRef<(HTMLInputElement | null)[]>([]);
  const multiSubInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // 추가 이미지 드래그 순서 변경
  const [dragSubIdx, setDragSubIdx] = useState<number | null>(null);
  const [dragOverSubIdx, setDragOverSubIdx] = useState<number | null>(null);

  // 동적 카테고리
  type CatItem = { name: string; subs: string[] };
  const DEFAULT_CAT_LIST: CatItem[] = [
    { name: "현장", subs: ["상의", "하의", "계절·기능", "안전용품"] },
    { name: "여성", subs: ["여성 상의", "여성 하의", "여성 아우터"] },
    { name: "소품", subs: ["가방", "모자", "장갑", "양말", "벨트", "기타"] },
    { name: "남성", subs: ["남성 상의", "남성 하의", "남성 아우터", "신발"] },
    { name: "공용", subs: ["공용 상의", "공용 하의", "공용 아우터"] },
    { name: "일상", subs: ["데일리웨어", "아우터", "팬츠"] },
  ];
  const [catList, setCatList] = useState<CatItem[]>(DEFAULT_CAT_LIST);
  const dynMainCats = catList.map((c) => c.name);
  const dynSubCats = (main: string) => catList.find((c) => c.name === main)?.subs ?? [];

  // 카테고리 피커 UI 상태
  const [pickerMain, setPickerMain] = useState<string>(DEFAULT_CAT_LIST[0].name);
  const [pickerSub, setPickerSub] = useState<string>("");

  // 외부 데이터
  const [brands, setBrands] = useState<string[]>([]);
  // 브랜드 즉시 추가 팝업
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandError, setBrandError] = useState("");
  const [allProducts, setAllProducts] = useState<{ id: string; name: string; category: string; imageUrl?: string }[]>([]);
  const [colorUsage, setColorUsage] = useState<Record<string, { hex: string; count: number }>>({});
  const [colorDropdownOpen, setColorDropdownOpen] = useState(false);
  const [relatedCatFilter, setRelatedCatFilter] = useState("");
  const [relatedSearch, setRelatedSearch] = useState("");
  const [relatedModalOpen, setRelatedModalOpen] = useState(false);
  const [uploadingBlocksMulti, setUploadingBlocksMulti] = useState(false); // 상세설명 여러 장 업로드
  const [dragBlockIdx, setDragBlockIdx] = useState<number | null>(null);
  const [dragOverBlockIdx, setDragOverBlockIdx] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/site-settings/categories")
      .then((r) => r.ok ? r.json() : null)
      .then((data: unknown) => {
        if (data && Array.isArray((data as { categories?: unknown }).categories)) {
          const cats = (data as { categories: CatItem[] }).categories;
          setCatList(cats);
          if (cats.length > 0) setPickerMain(cats[0].name);
        }
      })
      .catch(() => {});

    fetch("/api/admin/brands")
      .then((r) => r.ok ? r.json() : [])
      .then((data: unknown) => {
        if (Array.isArray(data)) setBrands(data.map((b: { name: string }) => b.name));
      })
      .catch(() => {});

    fetch("/api/admin/products")
      .then((r) => r.ok ? r.json() : [])
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          const rows = data as { id: string; name: string; category: string; imageUrl?: string; colors?: { name: string; hex: string }[] }[];
          setAllProducts(
            rows.map((p) => ({ id: p.id, name: p.name, category: p.category, imageUrl: p.imageUrl }))
          );
          // 그동안 등록된 색상 사용 빈도 집계 (드롭다운에서 자주 쓰는 색상을 위로)
          const usage: Record<string, { hex: string; count: number }> = {};
          for (const p of rows) {
            for (const c of p.colors ?? []) {
              if (!c?.name) continue;
              if (usage[c.name]) usage[c.name].count += 1;
              else usage[c.name] = { hex: c.hex, count: 1 };
            }
          }
          setColorUsage(usage);
        }
      })
      .catch(() => {});
  }, []);

  // SEO 자동 입력
  useEffect(() => {
    setForm((prev) => {
      if (prev.name && !prev.metaTitle) return { ...prev, metaTitle: `${prev.name} | 워크업 작업복` };
      return prev;
    });
  }, [form.name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setForm((prev) => {
      if (prev.tagline && !prev.metaDesc) {
        const featList = prev.features.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 2);
        return { ...prev, metaDesc: featList.length > 0 ? `${prev.tagline} ${featList.join(", ")}.` : prev.tagline };
      }
      return prev;
    });
  }, [form.tagline]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key: keyof FormData, val: unknown) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const autoGenSeo = () => {
    const featList = form.features.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 2);
    set("metaTitle", form.name ? `${form.name} | 워크업 작업복` : "");
    set("metaDesc", featList.length > 0 ? `${form.tagline} ${featList.join(", ")}.` : form.tagline);
  };

  // ── 카테고리 다중 선택 ─────────────────────────────────────────────────────
  const addCategory = () => {
    if (!pickerMain || !pickerSub) return;
    const alreadyExists = form.categories.some((c) => c.main === pickerMain && c.sub === pickerSub);
    if (!alreadyExists) {
      set("categories", [...form.categories, { main: pickerMain, sub: pickerSub }]);
    }
    setPickerSub("");
  };

  const removeCategory = (idx: number) => {
    set("categories", form.categories.filter((_, i) => i !== idx));
  };

  // ── 이미지 업로드 ──────────────────────────────────────────────────────────
  // 4MB를 넘는 이미지는 자동 압축(화질 저하로 이미지가 깨져 보이는 원인이었음) 대신
  // 업로더가 직접 용량을 줄여서 다시 올리도록 즉시 안내한다.
  const uploadFile = async (file: File, zone: UploadZone): Promise<string | null> => {
    if (file.size > 4 * 1024 * 1024) {
      setUploadError({ zone, message: `이미지 용량을 줄여주세요. "${file.name}"이(가) 4MB를 초과합니다.` });
      return null;
    }

    // 파일명에 한글·공백·괄호 등 영문/숫자/.-_ 이외의 문자가 있으면 Next.js route handler의
    // req.formData() 파싱이 "Failed to parse body as FormData"로 실패하는 문제가 있어
    // (멀티파트 Content-Disposition 헤더 인코딩 이슈), 업로드 직전 안전한 파일명으로 바꿔서 전송한다
    // (내용은 동일, 이름만 대체 — 한글만 걸러서는 부족해 공백·괄호 등도 함께 차단).
    const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0]) || "";
    const safeName = /^[a-zA-Z0-9._-]+$/.test(file.name)
      ? file.name
      : `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const safeFile = safeName === file.name ? file : new File([file], safeName, { type: file.type });

    const fd = new FormData();
    fd.append("file", safeFile);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    // 서버/프록시가 JSON이 아닌 에러(예: 413 Request Entity Too Large)를 반환할 수 있어
    // res.json()이 바로 실패하지 않도록 먼저 텍스트로 받고 안전하게 파싱한다.
    const raw = await res.text();
    let data: { url?: string; error?: string } = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { /* JSON이 아니면 아래에서 raw를 그대로 안내 */ }
    if (res.ok && data.url) return data.url;
    const detail = data.error ?? (raw ? raw.slice(0, 200) : `HTTP ${res.status}`);
    setUploadError({
      zone,
      message:
        res.status === 413
          ? `파일 용량이 너무 큽니다(413). "${file.name}" 크기를 줄여서 다시 시도해주세요.`
          : `업로드 실패: ${detail}`,
    });
    return null;
  };

  // 폴더 일괄 업로드: model*/etc*(대표, 첫 번째만) · sub_NN.*(추가) · detail_NN.*(상세) 규칙으로 자동 반영
  const [uploadingFolder, setUploadingFolder] = useState(false);
  const [folderUploadResult, setFolderUploadResult] = useState("");
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;

    setUploadError(null); setFolderUploadResult(""); setUploadingFolder(true);
    try {
      const mainCandidates: File[] = [];
      const subFiles: File[] = [];
      const detailFiles: File[] = [];

      // 자연 정렬(숫자를 숫자 크기로 비교) — "sub_front1(2).jpg"가 "(10)"보다 앞에 오도록
      const naturalSort = (a: File, b: File) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

      for (const file of files) {
        const name = file.name;
        // 파일명 어디든 규칙 텍스트가 포함되어 있으면 매칭 (위치·바로 뒤 숫자 여부 상관없음)
        if (/model|etc/i.test(name)) {
          mainCandidates.push(file);
        } else if (/sub/i.test(name)) {
          subFiles.push(file);
        } else if (/detail/i.test(name)) {
          detailFiles.push(file);
        }
      }
      // model/etc가 여러 개면 파일명 순서상 첫 번째만 대표, 나머지는 추가 이미지로
      mainCandidates.sort(naturalSort);
      const mainFile = mainCandidates[0] ?? null;
      const extraMainFiles = mainCandidates.slice(1);

      subFiles.sort(naturalSort);
      detailFiles.sort(naturalSort);

      let mainCount = 0, subCount = 0, detailCount = 0;

      if (mainFile) {
        const url = await uploadFile(mainFile, "main");
        if (url) { set("imageUrl", url); mainCount = 1; }
      }

      if (subFiles.length || extraMainFiles.length) {
        const urls: string[] = [];
        for (const file of subFiles) {
          const url = await uploadFile(file, "sub");
          if (url) urls.push(url);
        }
        for (const file of extraMainFiles) {
          if (urls.length >= 9) break;
          const url = await uploadFile(file, "sub");
          if (url) urls.push(url);
        }
        const capped = urls.slice(0, 9);
        if (capped.length) { set("subImages", capped); subCount = capped.length; }
      }

      if (detailFiles.length) {
        const next = [...form.detailBlocks];
        for (let i = 0; i < detailFiles.length; i++) {
          const url = await uploadFile(detailFiles[i], "detail");
          if (!url) continue;
          if (i < next.length) {
            // 기존 블록에 이미지만 채워넣기
            next[i] = { ...next[i], imageUrl: url };
          } else {
            // 매칭할 블록이 없으면 새 블록 생성 (내용은 비워둠, 나중에 직접 입력)
            next.push({ id: `block-${Date.now()}-${i}`, type: "상품 소개", content: "", imageUrl: url });
          }
          detailCount++;
        }
        set("detailBlocks", next);
      }

      const unmatched = files.length - (mainFile ? 1 : 0) - subFiles.length - extraMainFiles.length - detailFiles.length;
      setFolderUploadResult(
        `대표 ${mainCount}개 · 추가 ${subCount}개 · 상세 ${detailCount}개 업로드 완료` +
        (unmatched > 0 ? ` (규칙에 안 맞는 파일 ${unmatched}개는 건너뜀)` : "")
      );
    } catch (error) {
      setUploadError({ zone: "folder", message: `폴더 업로드 실패: ${error instanceof Error ? error.message : "Unknown error"}` });
    } finally {
      setUploadingFolder(false);
    }
  };

  const handleMainFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadError(null); setUploadingMain(true);
    const url = await uploadFile(file, "main");
    setUploadingMain(false);
    if (url) {
      set("imageUrl", url);
    }
    if (mainInputRef.current) mainInputRef.current.value = "";
  };

  const handleSubFile = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadError(null); setUploadingSubIdx(idx);
    try {
      const url = await uploadFile(file, "sub");
      if (url) {
        const blob = await generateSubThumbnail(url);
        const thumbnailFile = new File([blob], `sub-thumb-${Date.now()}.jpg`, { type: "image/jpeg" });
        const thumbnailUrl = await uploadFile(thumbnailFile, "sub");
        if (thumbnailUrl) {
          const next = [...form.subImages]; next[idx] = thumbnailUrl; set("subImages", next);
        }
      }
    } catch (error) {
      setUploadError({ zone: "sub", message: `썸네일 생성 실패: ${error instanceof Error ? error.message : "Unknown error"}` });
    } finally {
      setUploadingSubIdx(null);
    }
    if (subInputRefs.current[idx]) subInputRefs.current[idx]!.value = "";
  };

  const removeSubImage = (idx: number) => {
    const next = [...form.subImages]; next.splice(idx, 1); set("subImages", next);
  };

  // 여러 장 한번에 업로드 — 960×960 안에 비율 유지로 맞춰서(확대·크롭 없음) 저장
  const handleMultiSubFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadError(null); setUploadingMulti(true);

    const filled = form.subImages.filter(Boolean);
    const slots = Math.max(0, 9 - filled.length);
    const toUpload = files.slice(0, slots);

    const urls: string[] = [];

    for (const file of toUpload) {
      try {
        // 1. 원본 업로드 (썸네일 생성용 소스)
        const url = await uploadFile(file, "sub");
        if (!url) continue;

        // 2. 960×960 안에 비율 유지로 맞춤
        const blob = await generateSubThumbnail(url);

        // 3. 생성된 결과를 실제 저장용으로 업로드
        const thumbnailFile = new File([blob], `sub-thumb-${Date.now()}-${Math.random()}.jpg`, { type: "image/jpeg" });
        const thumbnailUrl = await uploadFile(thumbnailFile, "sub");
        if (thumbnailUrl) urls.push(thumbnailUrl);
      } catch (error) {
        console.error("서브 썸네일 생성 실패:", error);
        setUploadError({ zone: "sub", message: `썸네일 생성 실패: ${error instanceof Error ? error.message : "Unknown error"}` });
      }
    }

    set("subImages", [...filled, ...urls]);
    setUploadingMulti(false);
    if (multiSubInputRef.current) multiSubInputRef.current.value = "";
  };

  // 드래그로 순서 변경
  const handleDragStart = (idx: number) => setDragSubIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragSubIdx !== null && dragSubIdx !== idx) setDragOverSubIdx(idx);
  };
  const handleDrop = (e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    if (dragSubIdx === null || dragSubIdx === toIdx) {
      setDragSubIdx(null); setDragOverSubIdx(null); return;
    }
    const next = [...form.subImages];
    while (next.length <= Math.max(dragSubIdx, toIdx)) next.push("");
    const temp = next[dragSubIdx];
    next[dragSubIdx] = next[toIdx] ?? "";
    next[toIdx] = temp;
    // 뒷 빈슬롯 정리
    while (next.length > 0 && !next[next.length - 1]) next.pop();
    set("subImages", next);
    setDragSubIdx(null); setDragOverSubIdx(null);
  };
  const handleDragEnd = () => { setDragSubIdx(null); setDragOverSubIdx(null); };

  // ── 상세 설명 블록 ──────────────────────────────────────────────────────────
  const updateBlock = (idx: number, key: string, val: string) => {
    const next = form.detailBlocks.map((b, i) => i === idx ? { ...b, [key]: val } : b);
    set("detailBlocks", next);
  };

  const removeBlock = (idx: number) => {
    set("detailBlocks", form.detailBlocks.filter((_, i) => i !== idx));
  };

  const handleBlockImgFile = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadError(null); setUploadingBlockIdx(idx);
    const url = await uploadFile(file, "detail");
    setUploadingBlockIdx(null);
    if (url) updateBlock(idx, "imageUrl", url);
    if (blockImgRefs.current[idx]) blockImgRefs.current[idx]!.value = "";
  };

  // 상세설명 — 여러 장 한 번에 업로드 → 각 이미지가 블록으로 추가 (이미지 중심 에디터)
  const handleBlocksMultiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setUploadError(null); setUploadingBlocksMulti(true);
    const urls: string[] = [];
    for (const file of files) { const url = await uploadFile(file, "detail"); if (url) urls.push(url); }
    const blocks = urls.map((url, i) => ({ id: `block-${Date.now()}-${i}`, type: "상품 소개" as const, content: "", imageUrl: url }));
    if (blocks.length) set("detailBlocks", [...form.detailBlocks, ...blocks]);
    setUploadingBlocksMulti(false);
  };

  // 블록 드래그 순서 변경 (드래그 핸들 ⠿ 사용 → 입력칸 편집 방해 없음)
  const onBlockDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragBlockIdx !== null && dragBlockIdx !== idx) setDragOverBlockIdx(idx);
  };
  const onBlockDrop = (e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    if (dragBlockIdx === null || dragBlockIdx === toIdx) { setDragBlockIdx(null); setDragOverBlockIdx(null); return; }
    const next = [...form.detailBlocks];
    const [moved] = next.splice(dragBlockIdx, 1);
    next.splice(toIdx, 0, moved);
    set("detailBlocks", next);
    setDragBlockIdx(null); setDragOverBlockIdx(null);
  };
  const onBlockDragEnd = () => { setDragBlockIdx(null); setDragOverBlockIdx(null); };

  // ── 태그 토글 ──────────────────────────────────────────────────────────────
  const toggleArr = (key: "featureTags" | "jobSites" | "mainExpose" | "seasons" | "sizes", val: string) => {
    const arr = form[key] as string[];
    const next = arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
    set(key, key === "sizes" ? sortSizes(next) : next);
  };

  const addCustomTag = (key: "featureTags" | "jobSites", inputKey: "customFeatureTag" | "customJobSite") => {
    const val = (form[inputKey] as string).trim();
    if (!val) return;
    const arr = form[key] as string[];
    if (!arr.includes(val)) set(key, [...arr, val]);
    set(inputKey, "");
  };

  // ── 커스텀 사이즈 ─────────────────────────────────────────────────────────
  const customSizes = form.sizes.filter((s) => !CLOTHING_SIZE_PRESETS.includes(s));

  const addCustomSize = () => {
    // 콤마로 구분해 여러 사이즈를 한 번에 입력 가능 (예: "30,32,34,36,38,40")
    const values = form.customSizeInput.split(",").map((v) => v.trim()).filter(Boolean);
    if (values.length === 0) { set("customSizeInput", ""); return; }
    const newSizes = values.filter((v) => !form.sizes.includes(v));
    if (newSizes.length > 0) set("sizes", sortSizes([...form.sizes, ...newSizes]));
    set("customSizeInput", "");
  };

  // ── 사이즈 가이드 (여러 개 가능: 상하세트 등) ──────────────────────────────
  const sizeGuides = form.sizeGuides.length > 0 ? form.sizeGuides : [{ ...SIZE_GUIDE_DEFAULT }];
  const gIdx = Math.min(activeGuideIdx, sizeGuides.length - 1);   // 현재 편집 중인 가이드
  const sg = sizeGuides[gIdx];
  const setSG = (patch: Partial<SizeGuide>) =>
    set("sizeGuides", sizeGuides.map((g, i) => (i === gIdx ? { ...g, ...patch } : g)));
  // 가이드 추가/삭제/라벨/전환
  const sgAddGuide = () => {
    set("sizeGuides", [...sizeGuides, { ...SIZE_GUIDE_DEFAULT, label: "" }]);
    setActiveGuideIdx(sizeGuides.length);
    setSgImageDim(null); setSgImageResized(false); setSgDiagramDim(null); setSgDiagramResized(false);
  };
  const sgRemoveGuide = (i: number) => {
    if (sizeGuides.length <= 1) { set("sizeGuides", [{ ...SIZE_GUIDE_DEFAULT }]); setActiveGuideIdx(0); return; }
    if (!confirm("이 사이즈 가이드를 삭제할까요?")) return;
    const next = sizeGuides.filter((_, idx) => idx !== i);
    set("sizeGuides", next);
    setActiveGuideIdx((prev) => Math.max(0, Math.min(prev >= i ? prev - 1 : prev, next.length - 1)));
  };
  const sgSwitchGuide = (i: number) => {
    setActiveGuideIdx(i);
    setSgImageDim(null); setSgImageResized(false); setSgDiagramDim(null); setSgDiagramResized(false);
  };
  const sgSetLabel = (label: string) => setSG({ label });
  // 측정 위치 안내 이미지 위 가이드선 — 선택 기능(추가하지 않으면 오버레이 표시 안 함)
  const sgLines = sg.guideLines ?? [];
  const sgAddLine = (preset: SizeGuideLine) => setSG({ guideLines: [...sgLines, { ...preset }] });
  const sgUpdateLine = (i: number, patch: Partial<SizeGuideLine>) =>
    setSG({ guideLines: sgLines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  const sgRemoveLine = (i: number) => setSG({ guideLines: sgLines.filter((_, idx) => idx !== i) });
  const sgCols = sg.columns ?? [];
  const sgRows = sg.rows ?? [];
  const sgAddColumn = () => setSG({ columns: [...sgCols, ""], rows: sgRows.map((r) => ({ cells: [...r.cells, ""] })) });
  const sgRemoveColumn = (ci: number) => setSG({ columns: sgCols.filter((_, i) => i !== ci), rows: sgRows.map((r) => ({ cells: r.cells.filter((_, i) => i !== ci) })) });
  const sgSetColumn = (ci: number, v: string) => setSG({ columns: sgCols.map((c, i) => (i === ci ? v : c)) });
  const sgAddRow = () => setSG({ rows: [...sgRows, { cells: sgCols.map(() => "") }] });
  // 열 일괄 추가 — "XL, 2XL, 3XL"처럼 입력하면 한 번에 여러 열 추가 (기존 열 뒤에 붙임)
  const sgBulkAddColumns = () => {
    const items = bulkColInput.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    if (!items.length) return;
    setSG({
      columns: [...sgCols, ...items],
      rows: sgRows.map((r) => ({ cells: [...r.cells, ...items.map(() => "")] })),
    });
    setBulkColInput("");
  };
  // 행 일괄 추가 — "총장, 가슴, 어깨"처럼 입력하면 한 번에 여러 행 추가 (첫 칸=항목명, 나머지 빈칸)
  const sgBulkAddRows = () => {
    const items = bulkRowInput.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
    if (!items.length || sgCols.length === 0) return;
    setSG({
      rows: [...sgRows, ...items.map((label) => ({ cells: sgCols.map((_, ci) => (ci === 0 ? label : "")) }))],
    });
    setBulkRowInput("");
  };
  // 행/열 전환 — 표를 전치(행↔열). 헤더 첫 칸(항목)은 고정, 나머지 축을 서로 바꾼다.
  const sgTranspose = () => {
    if (sgCols.length === 0) return;
    const corner = sgCols[0] ?? "";
    const newColumns = [corner, ...sgRows.map((r) => r.cells[0] ?? "")];
    const newRows = sgCols.slice(1).map((colHeader, ci) => ({
      cells: [colHeader, ...sgRows.map((r) => r.cells[ci + 1] ?? "")],
    }));
    setSG({ columns: newColumns, rows: newRows });
  };
  const sgRemoveRow = (ri: number) => setSG({ rows: sgRows.filter((_, i) => i !== ri) });
  const sgSetCell = (ri: number, ci: number, v: string) =>
    setSG({ rows: sgRows.map((r, i) => (i === ri ? { cells: r.cells.map((c, j) => (j === ci ? v : c)) } : r)) });
  // 값 칸(항목명 열 제외) 입력 후 자동으로 "cm" 붙임 — 숫자/범위이고 아직 cm가 없을 때만
  const sgCellBlur = (ri: number, ci: number, v: string) => {
    if (ci === 0) return;                         // 첫 칸(항목명)은 제외
    const nc = appendCmUnit(v);
    if (nc !== v) sgSetCell(ri, ci, nc);
  };
  const sgApplyTemplate = (tpl: { firstCol: string; rows: string[] }) => {
    if (sgRows.length > 0 && !confirm("현재 표의 행(항목)을 선택한 템플릿으로 교체할까요?")) return;
    const sizeCols = sgCols.length > 1 ? sgCols.slice(1) : ["S", "M", "L", "XL", "XXL"];
    setSG({
      mode: "table",
      columns: [tpl.firstCol, ...sizeCols],
      rows: tpl.rows.map((label) => ({ cells: [label, ...sizeCols.map(() => "")] })),
    });
  };
  const sgClearAll = () => {
    if (!confirm("사이즈 가이드를 전체 삭제할까요?")) return;
    setSG({ columns: [], rows: [], image: "", note: "" });
  };
  // 무료 OCR — 표 구조는 관리자가 만들고, 가운데 "수치 칸"만 자동으로 채운다.
  // (한글 항목/사이즈 제목은 건드리지 않음 → 라벨 깨짐 없음. 인식 오류는 검수)
  const handleSizeOcr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (sgRows.length === 0 || sgCols.length < 2) {
      alert("먼저 템플릿(티셔츠·바지·상하세트)이나 ‘+ 열 추가 / + 행 추가’로 표 구조(항목·사이즈)를 만든 뒤 사용하세요.\n수치 칸만 채워집니다.");
      return;
    }
    setOcrBusy(true); setOcrProgress(0);
    try {
      const { extractSizeValuesFromImage } = await import("@/lib/sizeGuideOcr");
      const valueRows = await extractSizeValuesFromImage(file, (p) => setOcrProgress(p));
      if (!valueRows.length) {
        alert("수치를 인식하지 못했습니다. 더 선명한(글자가 큰) 캡쳐를 사용해 주세요.");
        return;
      }
      // 기존 행/열 제목은 유지하고, 각 행의 첫 칸(라벨)을 제외한 수치 칸만 채움
      const newRows = sgRows.map((row, ri) => {
        const vals = valueRows[ri] ?? [];
        const cells = [...row.cells];
        while (cells.length < sgCols.length) cells.push("");
        for (let ci = 1; ci < sgCols.length; ci++) {
          const v = vals[ci - 1];
          if (v != null && v !== "") cells[ci] = appendCmUnit(String(v));   // OCR 값에도 자동 cm
        }
        return { cells };
      });
      setSG({ rows: newRows });
      alert("수치를 채웠습니다. 인식 오류가 있을 수 있으니 값을 꼭 확인·수정해 주세요.");
    } catch {
      alert("OCR 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setOcrBusy(false); setOcrProgress(0);
    }
  };
  const handleSizeGuideFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadError(null); setUploadingSizeGuide(true);
    // 기준 폭 초과 시 축소, 이하면 원본 그대로
    const r = await resizeImageToMaxWidth(file, SIZE_GUIDE_MAX_WIDTH);
    const url = await uploadFile(r.file, "sizeGuide");
    setUploadingSizeGuide(false);
    if (url) { setSG({ image: url }); setSgImageResized(r.resized); }
    e.target.value = "";
  };

  // 측정 위치 안내 도식(어깨·가슴·총장 등) — 표/이미지 위에 노출
  const handleSizeDiagramFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadError(null); setUploadingSizeDiagram(true);
    const r = await resizeImageToMaxWidth(file, SIZE_GUIDE_MAX_WIDTH);
    const url = await uploadFile(r.file, "sizeGuide");
    setUploadingSizeDiagram(false);
    if (url) { setSG({ guideImage: url }); setSgDiagramResized(r.resized); }
    e.target.value = "";
  };

  // ── 상세 정보 (라벨/값 텍스트) ─────────────────────────────────────────────
  const diAdd = () => set("detailInfo", [...form.detailInfo, { label: "", value: "" }]);
  const diRemove = (i: number) => set("detailInfo", form.detailInfo.filter((_, idx) => idx !== i));
  const diSet = (i: number, key: "label" | "value", v: string) =>
    set("detailInfo", form.detailInfo.map((it, idx) => (idx === i ? { ...it, [key]: v } : it)));
  const diLoadDefaults = () => set("detailInfo", DETAIL_INFO_DEFAULTS.map((label) => ({ label, value: "" })));
  const diClearAll = () => {
    if (form.detailInfo.length === 0) return;
    if (!confirm("상세 정보를 전체 삭제할까요?")) return;
    set("detailInfo", []);
  };

  // ── 인스타 피드 (이 상품 미디어: 이미지 업로드 + 선택적 인스타 링크) ──────────
  const igAdd = () => set("instagramPosts", [...form.instagramPosts, { image: "", url: "" }]);
  const igSetUrl = (i: number, url: string) =>
    set("instagramPosts", form.instagramPosts.map((p, idx) => (idx === i ? { ...p, url } : p)));
  const igSetImage = (i: number, image: string) =>
    set("instagramPosts", form.instagramPosts.map((p, idx) => (idx === i ? { ...p, image } : p)));
  const igRemove = (i: number) =>
    set("instagramPosts", form.instagramPosts.filter((_, idx) => idx !== i));
  const igMove = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= form.instagramPosts.length) return;
    const next = [...form.instagramPosts];
    [next[i], next[j]] = [next[j], next[i]];
    set("instagramPosts", next);
  };
  const handleIgImage = async (e: React.ChangeEvent<HTMLInputElement>, i: number) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadError(null); setUploadingIgIdx(i);
    const url = await uploadFile(file, "instagram");
    setUploadingIgIdx(null);
    if (url) igSetImage(i, url);
    e.target.value = "";
  };

  // ── 색상 ──────────────────────────────────────────────────────────────────
  const toggleColor = (preset: { name: string; hex: string }) => {
    const existing = form.colors.find((c) => c.name === preset.name);
    if (existing) {
      if (existing.hex.toLowerCase() === preset.hex.toLowerCase()) {
        // 이미 같은 색상 — 다시 클릭하면 해제
        set("colors", form.colors.filter((c) => c.name !== preset.name));
      } else {
        // 이름은 같지만 색상값이 다름 — 엑셀 등록 시 기본값(예: 검정)으로 잘못 들어간 경우가 많아
        // 해제 대신 올바른 색상값으로 바로 교체한다.
        set("colors", form.colors.map((c) => (c.name === preset.name ? { ...c, hex: preset.hex } : c)));
      }
    } else {
      set("colors", [...form.colors, { name: preset.name, hex: preset.hex }]);
    }
  };

  const addCustomColor = () => {
    if (!form.colorName.trim()) return;
    if (form.colors.some((c) => c.name === form.colorName.trim())) return;
    set("colors", [...form.colors, { name: form.colorName.trim(), hex: form.colorHex }]);
    set("colorName", "");
    set("colorHex", "#303236");
  };

  // ── 연관 상품 ──────────────────────────────────────────────────────────────
  const filteredRelatedProducts = allProducts
    .filter((p) => !form.id || p.id !== form.id)
    .filter((p) => !relatedCatFilter || p.category === relatedCatFilter)
    .filter((p) => !relatedSearch.trim() || p.name.toLowerCase().includes(relatedSearch.trim().toLowerCase()));

  const toggleRelated = (id: string) => {
    set("relatedIds", form.relatedIds.includes(id)
      ? form.relatedIds.filter((rid) => rid !== id)
      : [...form.relatedIds, id]);
  };

  // ── 저장 ──────────────────────────────────────────────────────────────────
  // 폼 → 저장/미리보기 공용 product 객체 구성
  // 브랜드 즉시 생성 — 팝업에서 등록 후 목록에 반영하고 이 상품에 바로 선택
  const createBrand = async () => {
    const name = newBrandName.trim();
    if (!name) { setBrandError("브랜드명을 입력하세요."); return; }
    if (brands.includes(name)) {   // 이미 있으면 새로 만들지 않고 선택만
      set("brand", name); setBrandModalOpen(false); setNewBrandName(""); return;
    }
    setBrandSaving(true); setBrandError("");
    try {
      const res = await fetch("/api/admin/brands", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setBrandError(data?.error ?? "브랜드 생성에 실패했습니다."); return; }
      const created: string = (data?.name as string) ?? name;
      setBrands((prev) => Array.from(new Set([...prev, created])).sort((a, b) => a.localeCompare(b, "ko")));
      set("brand", created);
      setNewBrandName(""); setBrandModalOpen(false);
    } finally {
      setBrandSaving(false);
    }
  };

  const buildPayload = (): Partial<Product> & { id: string; categories?: CategoryEntry[] } => {
    const id = form.id || slugify(form.name) || `product-${Date.now()}`;
    const primaryCat = form.categories[0] ?? { main: "현장", sub: "상의" };
    return {
      id,
      sku: form.sku || undefined,
      brand: form.brand || undefined,
      hideBrandPrefix: form.hideBrandPrefix,
      manufacturer: form.manufacturer || undefined,
      origin: form.origin || undefined,
      name: form.name,
      line: form.line as Product["line"],
      category: primaryCat.main as Product["category"],
      subCategory: primaryCat.sub as Product["subCategory"],
      categories: form.categories,
      // 임시등록 상품은 이 화면에서 다른 내용을 아무리 수정·저장해도 상태가 저절로 풀리지 않는다.
      // "정식등록으로 전환" 체크박스를 명시적으로 체크했을 때만 정식등록으로 바뀐다.
      registrationStatus: form.registrationStatus,
      tagline: form.tagline,
      price: form.price,
      consumerPrice: form.consumerPrice || undefined,
      supplyPrice: form.supplyPrice || undefined,
      status: form.status as Product["status"],
      seasons: form.seasons as Season[],
      promoStart: form.status === "예약판매" ? (form.promoStart || undefined) : undefined,
      promoEnd: form.status === "예약판매" ? (form.promoEnd || undefined) : undefined,
      imageUrl: form.imageUrl || undefined,
      subImages: form.subImages.filter(Boolean),
      videoUrl: form.videoUrl.trim() || undefined,
      instagramPosts: form.instagramPosts
        .filter((p) => (p.image ?? "").trim() !== "")
        .map((p) => ({ image: p.image.trim(), url: (p.url ?? "").trim() || undefined })),
      // 착용 컷: content가 비어있는 것들은 저장하지 않음 (자동 추가 방지)
      detailBlocks: (form.detailBlocks as DetailBlock[]).filter((b) => {
        if (b.type === "착용 컷" && !b.content?.trim()) return false;
        return true;
      }),
      features: form.features.split("\n").map((s) => s.trim()).filter(Boolean),
      featureTags: form.featureTags,
      jobTypes: initial?.jobTypes ?? [],   // 폼에서 편집하지 않는 필드는 기존 값 보존 (덮어쓰기로 인한 손실 방지)
      jobSites: form.jobSites,
      wearerQuote: initial?.wearerQuote,   // 착용자 후기도 폼 밖 필드 — 보존
      mainExpose: form.mainExpose as MainExpose[],
      isNew: form.mainExpose.includes("신상품"),
      fieldTest: form.fieldTest || undefined,
      bg: "bg-[#303236]",
      colors: form.colors,
      sizes: form.sizes,
      sizePrices: form.sizePrices.filter((sp) => form.sizes.includes(sp.size) && sp.price.trim()),
      // 안내 문구 필수 — 비어 있으면 기본 문구로 강제 저장
      sizeGuides: form.sizeGuides.map((g) => ({ ...g, note: g.note?.trim() ? g.note : SIZE_NOTE_DEFAULT })),
      sizeGuide: (() => { const g = form.sizeGuides[0]; return g ? { ...g, note: g.note?.trim() ? g.note : SIZE_NOTE_DEFAULT } : g; })(),   // 레거시 하위호환
      detailInfo: form.detailInfo.filter((d) => d.label.trim() || d.value.trim()),
      relatedIds: form.relatedIds,
      metaTitle: form.metaTitle || undefined,
      metaDesc: form.metaDesc || undefined,
    };
  };

  // 미리보기 — 현재 입력값을 sessionStorage에 담아 새 탭에서 상세페이지로 렌더
  const handlePreview = () => {
    try {
      sessionStorage.setItem("wu-product-preview", JSON.stringify(buildPayload()));
      window.open("/products/preview", "_blank");
    } catch { alert("미리보기를 열 수 없습니다. 잠시 후 다시 시도해 주세요."); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (form.categories.length === 0) {
      setError("카테고리를 하나 이상 선택해 주세요.");
      return;
    }
    setSaving(true);
    const payload = buildPayload();

    const url = isEdit ? `/api/admin/products/${initial!.id}` : "/api/admin/products";
    try {
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        alert(isEdit ? "수정이 완료되었습니다." : "제품이 등록되었습니다.");
        router.push("/admin/products");
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "저장 중 오류가 발생했습니다.");
      }
    } catch {
      setError("저장 중 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);   // 네트워크 실패 시에도 버튼 잠금 해제 (영구 "저장 중" 방지)
    }
  };

  const customColors = form.colors.filter((c) => !COLOR_PRESETS.some((p) => p.name === c.name));

  // 색상 드롭다운 옵션: 기본 프리셋(6개) 제외, 5회 이상 사용된 커스텀 색상만 자주 쓴 순서로 정렬
  const colorDropdownOptions = (() => {
    const isBasePreset = (name: string) => COLOR_PRESETS.some((p) => p.name === name);
    return Object.entries(colorUsage)
      .filter(([name, u]) => !isBasePreset(name) && u.count >= 5)
      .map(([name, u]) => ({ name, hex: u.hex, count: u.count }))
      .sort((a, b) => b.count - a.count);
  })();

  // ─── 렌더 ──────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="w-full">
      {error && (
        <div className="p-4 mb-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded">{error}</div>
      )}

      {initial?.registrationStatus === "임시등록" && (
        <label className="flex items-center gap-2.5 p-4 mb-4 bg-pink-50 border border-pink-200 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={form.registrationStatus === "정식등록"}
            onChange={(e) => set("registrationStatus", e.target.checked ? "정식등록" : "임시등록")}
            className="w-4 h-4 accent-[#303236]"
          />
          <span className="text-sm text-pink-700">
            <b>임시등록</b> 상태인 상품입니다 — 이 체크박스를 체크하지 않으면 다른 내용을 수정·저장해도
            임시등록 상태가 그대로 유지됩니다. 정식등록으로 전환하려면 체크한 뒤 저장해 주세요.
            {form.registrationStatus === "정식등록" && (
              <span className="block mt-1 font-semibold">✓ 저장하면 정식등록으로 전환됩니다.</span>
            )}
          </span>
        </label>
      )}

      {/* ── 상단 저장 버튼 ── */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <p className="text-sm text-gray-500">{isEdit ? "상품 수정 중" : "새 상품 등록"}</p>
        <SaveBar saving={saving} isEdit={isEdit} onCancel={() => router.back()} onPreview={handlePreview} status={form.status} onStatusChange={(s) => set("status", s)} />
      </div>

      <div className="grid grid-cols-2 gap-6 items-start">
        {/* ══════════ 왼쪽 컬럼 ══════════ */}
        <div className="flex flex-col gap-6 min-w-0">

          {/* ── 1. 기본 정보 ── */}
          <section className="bg-white border border-gray-200 p-7 rounded-xl">
            <SectionTitle>기본 정보</SectionTitle>
            <div className="space-y-5">
              {/* 상품명 · 판매가 */}
              <div className="grid grid-cols-2 gap-5">
                <Field label="상품명" required>
                  <input required value={form.name}
                    onChange={(e) => { set("name", e.target.value); if (!isEdit) set("id", slugify(e.target.value)); }}
                    className={INPUT_CLS} placeholder="예: 스트레치 카고 팬츠" />
                </Field>
                <Field label="판매가" required>
                  <input required value={form.price} onChange={(e) => set("price", formatPrice(e.target.value))}
                    inputMode="numeric" className={INPUT_CLS} placeholder="예: 39,000원" />
                </Field>
              </div>

              {/* 상품코드 · 제품 ID */}
              <div className="grid grid-cols-2 gap-5">
                <Field label="상품코드 (SKU)">
                  <input value={form.sku} onChange={(e) => set("sku", e.target.value)}
                    className={`${INPUT_CLS} font-mono`} placeholder="예: WU-S001" />
                </Field>
                <Field label="제품 ID">
                  <input value={form.id} onChange={(e) => set("id", e.target.value)}
                    className={`${INPUT_CLS} font-mono`} placeholder="자동 생성됨" disabled={isEdit} />
                </Field>
              </div>

              {/* 브랜드 */}
              <div>
                {/* 라벨 행: 브랜드 + 작은 추가/관리 버튼 (셀렉트는 아래 전체 폭) */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-xs font-medium text-gray-500">브랜드</label>
                  <button type="button"
                    onClick={() => { setNewBrandName(""); setBrandError(""); setBrandModalOpen(true); }}
                    className="text-[10px] font-semibold text-[#303236] border border-[#303236] rounded px-1.5 py-0.5 leading-none hover:bg-[#303236] hover:text-white transition-colors">
                    + 추가
                  </button>
                  <a href="/admin/brands" target="_blank" rel="noopener" className="text-[10px] text-gray-400 hover:text-[#303236]">관리 ↗</a>
                </div>
                <select value={form.brand} onChange={(e) => set("brand", e.target.value)} className={SELECT_CLS}>
                  <option value="">선택 안 함</option>
                  {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                  {form.brand && !brands.includes(form.brand) && <option value={form.brand}>{form.brand}</option>}
                </select>
                <label className="flex items-center gap-1.5 mt-2 cursor-pointer w-fit">
                  <input type="checkbox" checked={!form.hideBrandPrefix}
                    onChange={(e) => set("hideBrandPrefix", !e.target.checked)}
                    className="accent-[#303236] w-3.5 h-3.5" />
                  <span className="text-[11px] text-gray-500">제품명 앞에 <b className="text-[#303236]">[브랜드]</b> 표시</span>
                </label>
              </div>

            </div>
          </section>

          {/* ── 사이즈 가이드 (사이즈 및 소재 탭) — 기본 접힘 ── */}
          <section className="bg-white border border-gray-200 p-7 rounded-xl">
            <button type="button" onClick={() => setSizeGuideOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 text-left">
              <h2 className="text-xs font-bold text-[#303236] uppercase tracking-widest">사이즈 가이드</h2>
              <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${sizeGuideOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {sizeGuideOpen && (
            <div className="mt-4">
            {/* 가이드 선택 탭 — 상하세트 등 여러 개(상의/하의…) 등록 */}
            <div className="flex items-center gap-1.5 flex-wrap mb-4">
              {sizeGuides.map((g, i) => (
                <button key={i} type="button" onClick={() => sgSwitchGuide(i)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    i === gIdx ? "bg-[#303236] text-white border-[#303236]" : "bg-white text-gray-600 border-gray-200 hover:border-[#303236]"
                  }`}>
                  {g.label?.trim() || `가이드 ${i + 1}`}
                </button>
              ))}
              <button type="button" onClick={sgAddGuide}
                className="px-3 py-1.5 text-xs rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-[#303236] hover:text-[#303236] transition-colors">
                + 가이드 추가
              </button>
              <span className="text-[11px] text-gray-400 ml-1">상하세트는 상의·하의를 따로 추가하세요</span>
            </div>

            {uploadError?.zone === "sizeGuide" && <p className="text-xs text-red-500 mb-2">{uploadError.message}</p>}
            <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <input value={sg.label ?? ""} onChange={(e) => sgSetLabel(e.target.value)}
                  placeholder="라벨 (예: 상의 / 하의)"
                  className="w-32 border border-gray-200 px-2 py-1 text-xs rounded focus:outline-none focus:border-[#303236]" />
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                  {(["image", "table"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setSG({ mode: m })}
                      className={`px-3 py-1.5 transition-colors ${sg.mode === m ? "bg-[#303236] text-white" : "bg-white text-gray-500 hover:text-[#303236]"}`}>
                      {m === "image" ? "이미지" : "행·열 표"}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={sgClearAll}
                  className="px-3 py-1.5 text-[11px] border border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500 rounded transition-colors">내용 비우기</button>
                {sizeGuides.length > 1 && (
                  <button type="button" onClick={() => sgRemoveGuide(gIdx)}
                    className="px-3 py-1.5 text-[11px] border border-red-200 text-red-500 hover:bg-red-50 rounded transition-colors">가이드 삭제</button>
                )}
              </div>
            </div>

            {/* 측정 위치 안내 이미지 — 사이즈표/이미지 바로 위에 노출 (선택) */}
            <div className="mb-5 pb-5 border-b border-gray-100 flex gap-4 items-start">
              {sg.guideImage ? (
                <div className="relative w-40 border border-gray-200 rounded overflow-hidden bg-gray-50 flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sg.guideImage} alt="측정 위치 안내" className="w-full h-auto block grayscale opacity-40"
                    onLoad={(e) => setSgDiagramDim({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
                  <button type="button" onClick={() => { setSG({ guideImage: "" }); setSgDiagramDim(null); setSgDiagramResized(false); }}
                    className="absolute top-1 right-1 bg-black/60 text-white w-6 h-6 rounded-full text-xs leading-none">×</button>
                  {sgLines.length > 0 && <SizeGuideLinesOverlay lines={sgLines} />}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-40 h-40 border-2 border-dashed border-gray-200 rounded cursor-pointer text-gray-400 hover:border-[#303236] hover:text-[#303236] transition-colors flex-shrink-0 text-center px-2">
                  <input type="file" accept="image/*" className="hidden" onChange={handleSizeDiagramFile} />
                  <span className="text-xs leading-snug">{uploadingSizeDiagram ? "업로드 중…" : "＋ 측정 위치 안내 이미지"}</span>
                </label>
              )}
              <div className="flex-1">
                <p className="text-xs font-semibold text-[#303236] mb-1">측정 위치 안내 이미지 <span className="text-gray-400 font-normal">(선택)</span></p>
                <p className="text-xs text-gray-400 leading-relaxed">어깨·가슴·총장 등 <b>어디를 잰 치수인지</b> 보여주는 도식 이미지입니다. 등록하면 &quot;사이즈 및 소재&quot; 탭에서 사이즈표 <b>바로 위</b>에 표시됩니다.</p>
                {sg.guideImage && sgDiagramDim && (
                  <p className="text-[11px] text-gray-500 mt-1.5">이미지 크기: <b>{sgDiagramDim.w} × {sgDiagramDim.h}px</b>{sgDiagramResized && <span className="text-[#E5541B]"> · {SIZE_GUIDE_MAX_WIDTH}px로 축소됨</span>}</p>
                )}
                <p className="text-[11px] text-gray-300 mt-1">기준 폭 {SIZE_GUIDE_MAX_WIDTH}px — 초과 시 자동 축소, 이하면 원본 그대로.</p>
              </div>
            </div>

            {/* 가이드선(어깨/가슴/소매/총장 등) — 측정 위치 안내 이미지가 있을 때만 선택적으로 사용 */}
            {sg.guideImage && (
              <div className="mb-5 pb-5 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <p className="text-xs font-semibold text-[#303236]">가이드선 <span className="text-gray-400 font-normal">(선택 — 추가 안 하면 표시 안 됨)</span></p>
                  <div className="flex flex-wrap gap-1.5">
                    {SIZE_GUIDE_LINE_PRESETS.map((preset) => (
                      <button key={preset.label} type="button" onClick={() => sgAddLine(preset)}
                        className="px-2.5 py-1 text-[11px] border border-gray-200 text-gray-600 rounded-full hover:border-[#303236] hover:text-[#303236] transition-colors">
                        + {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {sgLines.length > 0 && (
                  <div className="flex flex-col md:flex-row gap-4 items-start">
                    <div className="relative w-full md:w-56 flex-shrink-0 border border-gray-200 rounded overflow-hidden bg-gray-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sg.guideImage} alt="가이드선 미리보기" className="w-full h-auto block grayscale opacity-40" />
                      <SizeGuideLinesOverlay lines={sgLines} />
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      {sgLines.map((l, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-1.5 p-2 bg-gray-50 rounded border border-gray-100">
                          <input value={l.label} onChange={(e) => sgUpdateLine(i, { label: e.target.value })}
                            placeholder="라벨 (예: 어깨)" className="w-20 px-2 py-1 text-xs border border-gray-200 rounded" />
                          <select value={l.orientation} onChange={(e) => sgUpdateLine(i, { orientation: e.target.value as SizeGuideLine["orientation"] })}
                            className="px-2 py-1 text-xs border border-gray-200 rounded">
                            <option value="horizontal">가로</option>
                            <option value="vertical">세로</option>
                          </select>
                          <label className="flex items-center gap-1 text-[11px] text-gray-500">위치
                            <input type="number" min={0} max={100} value={l.pos} onChange={(e) => sgUpdateLine(i, { pos: Number(e.target.value) })}
                              className="w-14 px-1.5 py-1 text-xs border border-gray-200 rounded" />%
                          </label>
                          <label className="flex items-center gap-1 text-[11px] text-gray-500">시작
                            <input type="number" min={0} max={100} value={l.start} onChange={(e) => sgUpdateLine(i, { start: Number(e.target.value) })}
                              className="w-14 px-1.5 py-1 text-xs border border-gray-200 rounded" />%
                          </label>
                          <label className="flex items-center gap-1 text-[11px] text-gray-500">끝
                            <input type="number" min={0} max={100} value={l.end} onChange={(e) => sgUpdateLine(i, { end: Number(e.target.value) })}
                              className="w-14 px-1.5 py-1 text-xs border border-gray-200 rounded" />%
                          </label>
                          <button type="button" onClick={() => sgRemoveLine(i)}
                            className="ml-auto px-2 py-1 text-[11px] text-gray-400 hover:text-red-500 transition-colors">삭제</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {sg.mode === "image" ? (
              <div className="flex gap-4 items-start">
                {sg.image ? (
                  <div className="relative w-44 border border-gray-200 rounded overflow-hidden flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sg.image} alt="사이즈 가이드" className="w-full h-auto block"
                      onLoad={(e) => setSgImageDim({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
                    <button type="button" onClick={() => { setSG({ image: "" }); setSgImageDim(null); setSgImageResized(false); }}
                      className="absolute top-1 right-1 bg-black/60 text-white w-6 h-6 rounded-full text-xs leading-none">×</button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-44 h-44 border-2 border-dashed border-gray-200 rounded cursor-pointer text-gray-400 hover:border-[#303236] hover:text-[#303236] transition-colors">
                    <input type="file" accept="image/*" className="hidden" onChange={handleSizeGuideFile} />
                    <span className="text-xs">{uploadingSizeGuide ? "업로드 중…" : "＋ 이미지 등록"}</span>
                  </label>
                )}
                <div className="flex-1">
                  <p className="text-xs text-gray-400 leading-relaxed">사이즈표 이미지를 등록하면 &quot;사이즈 및 소재&quot; 탭에 그대로 표시됩니다.</p>
                  {sg.image && sgImageDim && (
                    <p className="text-[11px] text-gray-500 mt-1.5">이미지 크기: <b>{sgImageDim.w} × {sgImageDim.h}px</b>{sgImageResized && <span className="text-[#E5541B]"> · {SIZE_GUIDE_MAX_WIDTH}px로 축소됨</span>}</p>
                  )}
                  <p className="text-[11px] text-gray-300 mt-1">기준 폭 {SIZE_GUIDE_MAX_WIDTH}px — 초과 시 자동 축소, 이하면 원본 그대로.</p>
                </div>
              </div>
            ) : (
              <div>
                {/* 무료 OCR — 표 구조는 직접 만들고, 수치 칸만 자동으로 채움 (브라우저 내 실행, 키 불필요) */}
                <div className="mb-3 p-3 bg-gray-50 border border-gray-100 rounded-lg">
                  <label className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded cursor-pointer transition-colors ${ocrBusy ? "bg-gray-200 text-gray-400 cursor-not-allowed pointer-events-none" : "bg-[#303236] text-white hover:bg-[#243d5e]"}`}>
                    <input type="file" accept="image/*" className="hidden" onChange={handleSizeOcr} disabled={ocrBusy} />
                    {ocrBusy ? (
                      <><span className="w-3 h-3 border-2 border-gray-300 border-t-white rounded-full animate-spin" />인식 중… {ocrProgress}%</>
                    ) : (
                      "📷 이미지에서 수치만 채우기 (무료)"
                    )}
                  </label>
                  <p className="text-[11px] text-gray-400 mt-1.5">먼저 <b>템플릿</b>이나 <b>행·열 추가</b>로 표 구조(항목·사이즈)를 만든 뒤 이미지를 올리면, <b>가운데 수치 칸만</b> 자동으로 채웁니다. (행·열 제목은 안 바뀜) 인식 오류는 확인·수정하세요.</p>
                </div>
                {/* 항목 템플릿 — 클릭 시 측정 항목(행) 자동 구성 */}
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <span className="text-[11px] text-gray-400 mr-0.5">템플릿:</span>
                  {SIZE_GUIDE_ROW_TEMPLATES.map((t) => (
                    <button key={t.label} type="button" onClick={() => sgApplyTemplate(t)}
                      className="px-2.5 py-1 text-[11px] border border-gray-200 text-gray-600 rounded-full hover:border-[#303236] hover:text-[#303236] transition-colors">
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 mb-3 items-center">
                  <button type="button" onClick={sgAddColumn}
                    className="px-3 py-1.5 text-xs border border-[#303236] text-[#303236] hover:bg-[#303236] hover:text-white rounded transition-colors">+ 열 추가</button>
                  <button type="button" onClick={sgAddRow} disabled={sgCols.length === 0}
                    className="px-3 py-1.5 text-xs border border-[#303236] text-[#303236] hover:bg-[#303236] hover:text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed">+ 행 추가</button>
                  <span className="w-px h-5 bg-gray-200 mx-1" />
                  <input value={bulkColInput} onChange={(e) => setBulkColInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sgBulkAddColumns(); } }}
                    placeholder="XL, 2XL, 3XL (쉼표·공백 구분)"
                    className="w-48 border border-gray-200 px-2 py-1.5 text-xs rounded focus:outline-none focus:border-[#303236]" />
                  <button type="button" onClick={sgBulkAddColumns} disabled={!bulkColInput.trim()}
                    className="px-3 py-1.5 text-xs bg-[#303236] text-white rounded hover:bg-[#243d5e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">열 일괄 추가</button>
                  <span className="w-px h-5 bg-gray-200 mx-1" />
                  <input value={bulkRowInput} onChange={(e) => setBulkRowInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sgBulkAddRows(); } }}
                    placeholder="총장, 가슴, 어깨 (쉼표 구분)" disabled={sgCols.length === 0}
                    className="w-48 border border-gray-200 px-2 py-1.5 text-xs rounded focus:outline-none focus:border-[#303236] disabled:bg-gray-50 disabled:cursor-not-allowed" />
                  <button type="button" onClick={sgBulkAddRows} disabled={!bulkRowInput.trim() || sgCols.length === 0}
                    className="px-3 py-1.5 text-xs bg-[#303236] text-white rounded hover:bg-[#243d5e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">행 일괄 추가</button>
                  <span className="w-px h-5 bg-gray-200 mx-1" />
                  <button type="button" onClick={sgTranspose} disabled={sgCols.length === 0}
                    title="표의 행과 열을 서로 바꿉니다"
                    className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 hover:border-[#303236] hover:text-[#303236] rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed">⇄ 행/열 전환</button>
                </div>
                {sgCols.length === 0 ? (
                  <p className="text-xs text-gray-400">＋ 열 추가로 헤더(항목·S·M·L…)를 먼저 만들고, ＋ 행 추가로 값을 입력하세요.</p>
                ) : (
                  <div className="overflow-x-auto border border-gray-100 rounded">
                    <table className="text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="p-1.5 border-b border-r border-gray-100 w-8" />
                          {sgCols.map((c, ci) => (
                            <th key={ci} className="p-1.5 border-b border-r border-gray-100">
                              <div className="flex items-center gap-1">
                                <input value={c} onChange={(e) => sgSetColumn(ci, e.target.value)} placeholder={ci === 0 ? "항목" : "S"}
                                  className="w-20 border border-gray-200 px-1.5 py-1 rounded focus:outline-none focus:border-[#303236] font-semibold" />
                                <button type="button" onClick={() => sgRemoveColumn(ci)} className="text-gray-300 hover:text-red-500">×</button>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sgRows.map((r, ri) => (
                          <tr key={ri}>
                            <td className="p-1.5 border-r border-b border-gray-100 text-center">
                              <button type="button" onClick={() => sgRemoveRow(ri)} className="text-gray-300 hover:text-red-500" title="행 삭제">×</button>
                            </td>
                            {sgCols.map((_, ci) => (
                              <td key={ci} className="p-1.5 border-r border-b border-gray-100">
                                <input value={r.cells[ci] ?? ""} onChange={(e) => sgSetCell(ri, ci, e.target.value)}
                                  onBlur={(e) => sgCellBlur(ri, ci, e.target.value)} placeholder={ci === 0 ? "총장" : "69cm"}
                                  className="w-20 border border-gray-200 px-1.5 py-1 rounded focus:outline-none focus:border-[#303236]" />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1">안내 문구 <span className="text-red-400">*</span> <span className="text-gray-400 font-normal">비우면 기본 문구로 저장됩니다</span></label>
                  <input value={sg.note ?? ""} onChange={(e) => setSG({ note: e.target.value })} placeholder={SIZE_NOTE_DEFAULT}
                    className="w-full border border-gray-200 px-3 py-2 text-sm rounded focus:outline-none focus:border-[#303236]" />
                </div>
              </div>
            )}
            </div>
            )}
          </section>

          {/* ── 세부정보 (텍스트) — 기본 접힘 ── */}
          <section className="bg-white border border-gray-200 p-6 rounded-xl">
            <button type="button" onClick={() => setDetailInfoOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 text-left">
              <h2 className="text-xs font-bold text-[#303236] uppercase tracking-widest">세부정보</h2>
              <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${detailInfoOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {detailInfoOpen && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-end mb-5 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={diLoadDefaults}
                    className="px-3 py-1.5 text-xs border border-gray-300 text-gray-500 hover:border-[#303236] hover:text-[#303236] rounded transition-colors">기본 항목 불러오기</button>
                  <button type="button" onClick={diClearAll} disabled={form.detailInfo.length === 0}
                    className="px-3 py-1.5 text-[11px] border border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed">전체 삭제</button>
                  <button type="button" onClick={diAdd}
                    className="px-3 py-1.5 text-xs border border-[#303236] text-[#303236] hover:bg-[#303236] hover:text-white rounded transition-colors">+ 항목 추가</button>
                </div>
              </div>
              {form.detailInfo.length === 0 ? (
                <p className="text-xs text-gray-400">&quot;기본 항목 불러오기&quot;로 품명·소재·색상·제조국 등 기본 라벨을 채우거나 &quot;+ 항목 추가&quot;로 직접 추가하세요. 값이 빈 항목은 노출되지 않습니다.</p>
              ) : (
                <div className="space-y-2">
                  {form.detailInfo.map((it, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <input value={it.label} onChange={(e) => diSet(i, "label", e.target.value)} placeholder="항목명 (예: 소재)"
                        className="w-44 flex-shrink-0 border border-gray-200 px-3 py-2 text-sm rounded focus:outline-none focus:border-[#303236] font-medium" />
                      <textarea value={it.value} onChange={(e) => diSet(i, "value", e.target.value)} rows={1} placeholder="내용"
                        className="flex-1 border border-gray-200 px-3 py-2 text-sm rounded focus:outline-none focus:border-[#303236] resize-y" />
                      <button type="button" onClick={() => diRemove(i)}
                        className="flex-shrink-0 w-9 h-9 flex items-center justify-center text-gray-300 hover:text-red-500 border border-gray-200 rounded">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}
          </section>

          {/* ── 인스타 피드 (이 상품 관련 이미지/영상) — 기본 접힘 ── */}
          <section className="bg-white border border-gray-200 p-6 rounded-xl">
            <button type="button" onClick={() => setInstagramFeedOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 text-left">
              <h2 className="text-xs font-bold text-[#303236] uppercase tracking-widest">인스타 피드</h2>
              <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${instagramFeedOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {instagramFeedOpen && (
            <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-end mb-2 gap-2 flex-wrap">
              <button type="button" onClick={igAdd}
                className="px-3 py-1.5 text-xs border border-[#303236] text-[#303236] hover:bg-[#303236] hover:text-white rounded transition-colors">+ 항목 추가</button>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
              이 상품과 관련된 인스타 <b>이미지</b>를 올리면 <b>상세 정보 탭 상단</b>에 깔끔한 그리드로 노출됩니다. (인스타 게시물 <b>링크</b>를 함께 넣으면 클릭 시 인스타로 이동 · 릴스/영상 링크는 ▶ 배지 표시) 섹션 계정·열 수 등 공통 설정은 <a href="/admin/main/instagram" target="_blank" rel="noopener" className="text-[#303236] underline">인스타 피드 설정 ↗</a>에서.
            </p>
            {uploadError?.zone === "instagram" && <p className="text-xs text-red-500 mb-3">{uploadError.message}</p>}

            {form.instagramPosts.length === 0 ? (
              <p className="text-xs text-gray-400">등록된 항목이 없습니다. <b>+ 항목 추가</b>로 시작하세요. (미등록 시 상세페이지에 인스타 섹션이 표시되지 않습니다)</p>
            ) : (
              <div className="space-y-3">
                {form.instagramPosts.map((item, i) => {
                  const parsed = item.url ? parseInstagramUrl(item.url) : null;
                  const isVideo = parsed?.type === "reel" || parsed?.type === "tv";
                  return (
                    <div key={i} className="flex items-start gap-3 border border-gray-100 rounded-lg p-3">
                      <div className="flex flex-col items-center gap-1 pt-1">
                        <button type="button" onClick={() => igMove(i, -1)} disabled={i === 0}
                          className="text-gray-300 hover:text-[#303236] disabled:opacity-30 disabled:cursor-not-allowed leading-none">▲</button>
                        <span className="text-[11px] text-gray-400 font-mono">{i + 1}</span>
                        <button type="button" onClick={() => igMove(i, 1)} disabled={i === form.instagramPosts.length - 1}
                          className="text-gray-300 hover:text-[#303236] disabled:opacity-30 disabled:cursor-not-allowed leading-none">▼</button>
                      </div>

                      {/* 이미지 업로드/미리보기 (9:16 세로 — 실제 노출 비율) */}
                      <div className="w-[90px] h-[160px] flex-shrink-0 relative">
                        {item.image ? (
                          <div className="relative w-full h-full rounded overflow-hidden border border-gray-100 bg-[#fafafa]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.image} alt={`인스타 ${i + 1}`} className="w-full h-full object-cover" />
                            {isVideo && <span className="absolute top-1 right-1 text-white drop-shadow"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>}
                            <button type="button" onClick={() => igSetImage(i, "")}
                              className="absolute bottom-1 right-1 bg-black/60 text-white w-5 h-5 rounded-full text-[11px] leading-none">×</button>
                          </div>
                        ) : (
                          <label className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded cursor-pointer text-gray-400 hover:border-[#303236] hover:text-[#303236] transition-colors text-center">
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleIgImage(e, i)} disabled={uploadingIgIdx === i} />
                            <span className="text-[11px] leading-tight px-1">{uploadingIgIdx === i ? "업로드 중…" : "＋ 이미지"}</span>
                          </label>
                        )}
                      </div>

                      {/* 인스타 링크(선택) */}
                      <div className="flex-1 min-w-0">
                        <label className="block text-[11px] text-gray-500 mb-1">인스타 링크 <span className="text-gray-300">(선택 · 클릭 시 이동)</span></label>
                        <input value={item.url ?? ""} onChange={(e) => igSetUrl(i, e.target.value)}
                          placeholder="https://www.instagram.com/p/XXXXXXXX/"
                          className={`w-full border rounded px-3 py-2 text-sm font-mono focus:outline-none ${
                            (item.url ?? "").trim() === "" ? "border-gray-200 focus:border-[#303236]"
                              : parsed ? "border-green-300 focus:border-green-500 bg-green-50/40"
                              : "border-red-300 focus:border-red-500 bg-red-50/40"
                          }`} />
                        <p className="text-[11px] mt-1">
                          {(item.url ?? "").trim() === "" ? <span className="text-gray-400">비워두면 클릭 이동 없이 이미지만 노출됩니다.</span>
                            : parsed ? <span className="text-green-600">✓ 인식됨 ({parsed.type}){isVideo ? " · 영상 ▶" : ""}</span>
                            : <span className="text-red-500">✕ 올바른 인스타 게시물 URL이 아닙니다.</span>}
                        </p>
                      </div>

                      <button type="button" onClick={() => igRemove(i)} title="삭제"
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 border border-gray-200 rounded">×</button>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
            )}
          </section>

          {/* ── 카테고리 (최상단 박스) ── */}
          <section className="order-first bg-white border border-gray-200 p-7 rounded-xl">
            <div className="pt-1">
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  카테고리 <span className="text-red-400">*</span>
                  <span className="text-gray-400 font-normal ml-1.5">— 여러 카테고리에 동시 등록 가능, 첫 번째 = 대표</span>
                  <a href="/admin/main/categories" target="_blank" rel="noopener" className="ml-2 text-[#303236] hover:underline">관리 ↗</a>
                </label>

                {/* 선택된 카테고리 칩 */}
                {form.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {form.categories.map((cat, idx) => (
                      <span key={idx}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded font-medium ${
                          idx === 0
                            ? "bg-[#303236] text-white"
                            : "bg-gray-100 text-gray-700 border border-gray-200"
                        }`}>
                        {idx === 0 && (
                          <span className="text-[10px] bg-white/20 text-white px-1 py-0.5 rounded leading-none">대표</span>
                        )}
                        {cat.main} &gt; {cat.sub}
                        <button type="button" onClick={() => removeCategory(idx)}
                          className="hover:opacity-70 ml-0.5 leading-none">×</button>
                      </span>
                    ))}
                  </div>
                )}

                {/* 드릴다운 피커 */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* 브레드크럼 */}
                  <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 text-xs text-gray-500 flex items-center gap-1">
                    {pickerMain ? (
                      <>
                        <span className="font-medium text-[#303236]">{pickerMain}</span>
                        <span className="text-gray-300">&gt;</span>
                        {pickerSub
                          ? <span className="font-medium text-[#303236]">{pickerSub}</span>
                          : <span className="text-gray-400">소분류 선택</span>
                        }
                      </>
                    ) : (
                      <span>카테고리를 선택하세요</span>
                    )}
                  </div>

                  {/* 2단 선택 */}
                  <div className="flex" style={{ height: "180px" }}>
                    {/* 왼쪽: 대분류 */}
                    <div className="w-1/2 border-r border-gray-100 overflow-y-auto">
                      {dynMainCats.map((cat) => (
                        <button key={cat} type="button"
                          onClick={() => { setPickerMain(cat); setPickerSub(""); }}
                          className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors border-b border-gray-50 last:border-0 ${
                            pickerMain === cat
                              ? "bg-blue-50 text-[#303236] font-semibold"
                              : "hover:bg-gray-50 text-gray-700"
                          }`}>
                          <span>{cat}</span>
                          <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ))}
                    </div>

                    {/* 오른쪽: 소분류 */}
                    <div className="w-1/2 overflow-y-auto">
                      {pickerMain ? (
                        <>
                          {dynSubCats(pickerMain).map((sub) => (
                            <button key={sub} type="button"
                              onClick={() => setPickerSub(sub)}
                              className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors border-b border-gray-50 last:border-0 ${
                                pickerSub === sub
                                  ? "bg-blue-50 text-[#303236] font-semibold"
                                  : "hover:bg-gray-50 text-gray-700"
                              }`}>
                              <span>{sub}</span>
                              {pickerSub === sub && (
                                <svg className="w-4 h-4 text-[#303236]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          ))}
                          {dynSubCats(pickerMain).length === 0 && (
                            <p className="text-xs text-gray-400 px-4 py-4">소분류가 없습니다.</p>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-xs text-gray-400">왼쪽에서 대분류를 선택하세요</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 적용 버튼 */}
                  <div className="border-t border-gray-200 px-4 py-2.5 flex items-center justify-between bg-gray-50">
                    <p className="text-xs text-gray-400">
                      {pickerMain && pickerSub
                        ? `"${pickerMain} > ${pickerSub}" 추가 가능`
                        : "대분류와 소분류를 모두 선택하세요"}
                    </p>
                    <button type="button" onClick={addCategory}
                      disabled={!pickerMain || !pickerSub}
                      className="px-5 py-1.5 text-xs font-semibold bg-[#303236] text-white hover:bg-[#243d5e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded">
                      + 적용
                    </button>
                  </div>
                </div>
                {form.categories.length === 0 && (
                  <p className="text-xs text-red-400 mt-1">카테고리를 하나 이상 선택해 주세요.</p>
                )}
              </div>
          </section>


          {/* ── 5. 연관 상품 — 기본 접힘 ── */}
          <section className="bg-white border border-gray-200 p-6 rounded-xl">
            <button type="button" onClick={() => setRelatedOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 text-left">
              <h2 className="text-xs font-bold text-[#303236] uppercase tracking-widest">
                연관 상품{form.relatedIds.length > 0 ? ` (${form.relatedIds.length})` : ""}
              </h2>
              <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${relatedOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {relatedOpen && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex justify-end mb-4">
                <button type="button" onClick={() => setRelatedModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold border border-[#303236] text-[#303236] hover:bg-[#303236] hover:text-white rounded transition-colors">
                  + 연관 상품 추가
                </button>
              </div>
              {form.relatedIds.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {form.relatedIds.map((id) => {
                    const p = allProducts.find((ap) => ap.id === id);
                    return (
                      <span key={id} className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 text-xs bg-[#303236] text-white rounded">
                        <span className="w-5 h-5 bg-white/20 rounded overflow-hidden flex-shrink-0">
                          {p?.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.imageUrl} alt={p?.name ?? ""} className="w-full h-full object-cover" />
                          )}
                        </span>
                        {p?.name ?? id}
                        <button type="button" onClick={() => toggleRelated(id)} className="hover:opacity-70">×</button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400">아직 선택된 연관 상품이 없습니다. &quot;+ 연관 상품 추가&quot; 버튼으로 선택하세요.</p>
              )}
              <p className="text-xs text-gray-400 mt-3">
                {form.relatedIds.length > 0 ? `${form.relatedIds.length}개 선택됨 · ` : ""}
                제품 상세 페이지에 연관 상품으로 표시됩니다.
              </p>
            </div>
            )}
          </section>

          {/* 연관 상품 선택 모달 — 카테고리별 + 검색 */}
          {relatedModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
              onClick={() => setRelatedModalOpen(false)}>
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}>
                {/* 헤더 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">연관 상품 선택</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{form.relatedIds.length}개 선택됨</p>
                  </div>
                  <button type="button" onClick={() => setRelatedModalOpen(false)} className="text-gray-400 hover:text-gray-700 p-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* 검색 + 카테고리별 선택 */}
                <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0 space-y-2.5">
                  <div className="relative">
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input type="text" value={relatedSearch}
                      onChange={(e) => setRelatedSearch(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                      placeholder="상품명 검색..."
                      className="w-full border border-gray-200 pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-[#303236] rounded" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setRelatedCatFilter("")}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${relatedCatFilter === "" ? "bg-[#303236] text-white border-[#303236]" : "bg-white text-gray-600 border-gray-200 hover:border-[#303236]"}`}>
                      전체
                    </button>
                    {dynMainCats.map((c) => (
                      <button key={c} type="button" onClick={() => setRelatedCatFilter(c)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${relatedCatFilter === c ? "bg-[#303236] text-white border-[#303236]" : "bg-white text-gray-600 border-gray-200 hover:border-[#303236]"}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 상품 리스트 */}
                <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                  {filteredRelatedProducts.length === 0 ? (
                    <p className="text-xs text-gray-400 px-4 py-10 text-center">
                      {allProducts.length === 0 ? "등록된 상품이 없습니다." : "검색 결과가 없습니다."}
                    </p>
                  ) : (
                    filteredRelatedProducts.map((p) => (
                      <label key={p.id} className="flex items-center gap-3 px-6 py-2.5 hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={form.relatedIds.includes(p.id)} onChange={() => toggleRelated(p.id)}
                          className="w-4 h-4 accent-[#303236]" />
                        <span className="w-9 h-9 bg-[#f4f4f4] rounded overflow-hidden flex-shrink-0">
                          {p.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          )}
                        </span>
                        <span className="text-sm text-gray-800 flex-1">{p.name}</span>
                        <span className="text-xs text-gray-400 shrink-0">{p.category}</span>
                      </label>
                    ))
                  )}
                </div>

                {/* 푸터 */}
                <div className="px-6 py-3 border-t border-gray-200 flex justify-end flex-shrink-0">
                  <button type="button" onClick={() => setRelatedModalOpen(false)}
                    className="px-6 py-2 bg-[#303236] text-white text-sm font-semibold rounded hover:bg-[#243d5e] transition-colors">
                    완료 ({form.relatedIds.length})
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── 6. SEO — 기본 접힘 ── */}
          <section className="bg-white border border-gray-200 p-6 rounded-xl">
            <button type="button" onClick={() => setSeoOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 text-left">
              <h2 className="text-xs font-bold text-[#303236] uppercase tracking-widest">SEO</h2>
              <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${seoOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {seoOpen && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-end mb-5">
                <button type="button" onClick={autoGenSeo}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#303236] text-[#303236] hover:bg-[#303236] hover:text-white transition-colors rounded">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  자동 생성
                </button>
              </div>
              <div className="space-y-4">
                <Field label="메타 타이틀" hint="권장 60자 이내.">
                  <input value={form.metaTitle} onChange={(e) => set("metaTitle", e.target.value)}
                    className={INPUT_CLS} placeholder="예: 스트레치 카고 팬츠 | WORKUP 작업복" />
                  <div className="flex justify-end">
                    <span className={`text-xs mt-0.5 ${form.metaTitle.length > 60 ? "text-red-400" : "text-gray-400"}`}>
                      {form.metaTitle.length} / 60
                    </span>
                  </div>
                </Field>
                <Field label="메타 설명" hint="권장 80~160자.">
                  <textarea value={form.metaDesc} onChange={(e) => set("metaDesc", e.target.value)}
                    rows={3} className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#303236] resize-none rounded"
                    placeholder="예: 현장 작업자를 위한 스트레치 카고 팬츠. 11개 포켓, 무릎 이중 보강..." />
                  <div className="flex justify-end">
                    <span className={`text-xs ${form.metaDesc.length > 160 ? "text-red-400" : form.metaDesc.length < 80 && form.metaDesc.length > 0 ? "text-amber-400" : "text-gray-400"}`}>
                      {form.metaDesc.length} / 160
                    </span>
                  </div>
                </Field>
              </div>
            </div>
            )}
          </section>

          {/* ── 하단 저장 버튼 ── */}
          <div className="flex gap-3 pb-8">
            <SaveBar saving={saving} isEdit={isEdit} onCancel={() => router.back()} onPreview={handlePreview} status={form.status} onStatusChange={(s) => set("status", s)} />
          </div>

        </div>{/* end left col */}

        {/* ══════════ 오른쪽 컬럼 ══════════ */}
        <div className="space-y-6 sticky top-6">

          {/* ── 이미지 ── */}
          <section className="bg-white border border-gray-200 p-6 rounded-xl">
            <SectionTitle>제품 이미지</SectionTitle>

            {/* ── 대표 이미지 ── */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-700">
                  대표 이미지 <span className="text-red-400">*</span>
                </p>
                <span className="text-[11px] text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded font-mono">
                  1600 × 1600 px · 1:1 비율 권장 · 최대 4 MB
                </span>
              </div>
              {uploadError?.zone === "main" && <p className="text-xs text-red-500 mb-2">{uploadError.message}</p>}
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0">
                  {form.imageUrl ? (
                    <div className="relative w-28 h-28 border border-gray-200 rounded overflow-hidden">
                      <Image src={form.imageUrl} alt="대표 이미지" fill className="object-cover" />
                      <button type="button" onClick={() => set("imageUrl", "")}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600 rounded-full">×</button>
                    </div>
                  ) : (
                    <div className="w-28 h-28 bg-gray-100 flex items-center justify-center border border-dashed border-gray-300 rounded">
                      <span className="text-gray-300 text-xs">없음</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input ref={mainInputRef} type="file" accept="image/*" onChange={handleMainFile} className="hidden" id="main-img-r" />
                    <label htmlFor="main-img-r"
                      className={`inline-flex items-center gap-2 px-4 py-2 border text-sm cursor-pointer transition-colors rounded ${
                        uploadingMain ? "border-gray-200 text-gray-400 cursor-not-allowed" : "border-[#303236] text-[#303236] hover:bg-[#303236] hover:text-white"
                      }`}>
                      {uploadingMain ? <><span className="w-4 h-4 border-2 border-gray-300 border-t-[#303236] rounded-full animate-spin" />업로드 중...</> : "이미지 업로드"}
                    </label>

                    <input
                      ref={folderInputRef}
                      type="file"
                      className="hidden"
                      id="folder-upload"
                      onChange={handleFolderUpload}
                      {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                    />
                    <label htmlFor="folder-upload"
                      className={`inline-flex items-center gap-2 px-4 py-2 border text-sm cursor-pointer transition-colors rounded ${
                        uploadingFolder ? "border-gray-200 text-gray-400 cursor-not-allowed" : "border-[#303236] text-[#303236] hover:bg-[#303236] hover:text-white"
                      }`}>
                      {uploadingFolder ? <><span className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />업로드 중...</> : "폴더에서 일괄 업로드"}
                    </label>

                    <div className="relative">
                      <button type="button" onClick={() => setFolderHelpOpen((v) => !v)}
                        className="w-5 h-5 flex items-center justify-center rounded-full border border-gray-300 text-gray-400 text-[11px] font-bold hover:border-[#303236] hover:text-[#303236] transition-colors"
                        aria-label="폴더 일괄 업로드 규칙 안내">?</button>
                      {folderHelpOpen && (
                        <div className="absolute z-20 top-full left-0 mt-1.5 w-64 bg-white border border-gray-200 rounded shadow-lg p-3">
                          <p className="text-[11px] text-gray-500 leading-relaxed">
                            파일명에 model 또는 etc 포함(대표, 여러 개면 첫 번째만) · sub+숫자 포함(추가) · detail+숫자 포함(상세 블록, 등록된 순서에 매칭)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  {folderUploadResult && (
                    <p className="text-[11px] text-green-700 font-medium">{folderUploadResult}</p>
                  )}
                  {uploadError?.zone === "folder" && <p className="text-xs text-red-500">{uploadError.message}</p>}
                  <input type="url" value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)}
                    placeholder="또는 URL 직접 입력 (https://...)"
                    className="w-full border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:border-[#303236] rounded" />
                </div>
              </div>
            </div>

            {/* ── 추가 이미지 ── */}
            <div>
              {/* 헤더 — 타이틀 옆에 여러 장 한번에 선택 버튼 배치 */}
              <div className="flex items-center gap-2 flex-wrap justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-semibold text-gray-700">추가 이미지</p>
                  <input
                    ref={multiSubInputRef}
                    type="file" accept="image/*" multiple
                    onChange={handleMultiSubFiles}
                    className="hidden" id="multi-sub-img"
                    disabled={form.subImages.filter(Boolean).length >= 9}
                  />
                  <label htmlFor="multi-sub-img"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs transition-colors rounded cursor-pointer ${
                      uploadingMulti || form.subImages.filter(Boolean).length >= 9
                        ? "border-gray-200 text-gray-400 cursor-not-allowed pointer-events-none"
                        : "border-[#303236] text-[#303236] hover:bg-[#303236] hover:text-white"
                    }`}>
                    {uploadingMulti ? (
                      <><span className="w-3 h-3 border-2 border-gray-300 border-t-[#303236] rounded-full animate-spin" />업로드 중...</>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        여러 장 한번에 선택
                      </>
                    )}
                  </label>
                  <span className="text-[11px] text-gray-400">
                    {form.subImages.filter(Boolean).length} / 9장
                    {form.subImages.filter(Boolean).length > 0 && " · 이미지를 드래그해 순서 변경"}
                  </span>
                </div>
                <span className="text-[11px] text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded font-mono whitespace-nowrap">
                  960 × 960 px · 최대 9장 · 4 MB/장
                </span>
              </div>

              {/* 이미지 목록 (가로 스크롤 · 드래그 순서 변경 가능) — 5장 초과 시 옆으로 스크롤 */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {Array.from({ length: 9 }).map((_, idx) => {
                  const url = form.subImages[idx];
                  const isUploading = uploadingSubIdx === idx;
                  const isDragging  = dragSubIdx === idx;
                  const isDragOver  = dragOverSubIdx === idx && dragSubIdx !== null && dragSubIdx !== idx;

                  return (
                    <div key={idx} className="flex flex-col gap-1 select-none w-[80px] flex-shrink-0"
                      draggable={!!url}
                      onDragStart={() => url && handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}>
                      <div className={`relative aspect-square border rounded overflow-hidden transition-all duration-150 ${
                        isDragOver
                          ? "border-violet-400 ring-2 ring-violet-300 scale-105 bg-violet-50"
                          : isDragging
                            ? "opacity-40 border-dashed border-gray-400 scale-95"
                            : url
                              ? "border-gray-200 cursor-grab active:cursor-grabbing"
                              : "border-dashed border-gray-300"
                      }`}>
                        {url ? (
                          <>
                            <Image src={url} alt={`추가 ${idx + 1}`} fill className="object-cover pointer-events-none" sizes="80px" />
                            {/* 삭제 버튼 */}
                            <button type="button" onClick={() => removeSubImage(idx)}
                              className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center hover:bg-red-600 z-10 rounded-full">×</button>
                            {/* 드래그 핸들 힌트 */}
                            <div className="absolute bottom-0.5 left-0.5 text-[11px] text-white/70 pointer-events-none leading-none select-none">⠿</div>
                          </>
                        ) : isUploading ? (
                          <div className="w-full h-full flex items-center justify-center bg-gray-50">
                            <span className="w-4 h-4 border-2 border-gray-300 border-t-[#303236] rounded-full animate-spin" />
                          </div>
                        ) : (
                          <label htmlFor={`sub-img-r-${idx}`}
                            className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
                            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                            </svg>
                          </label>
                        )}
                        <input ref={(el) => { subInputRefs.current[idx] = el; }} id={`sub-img-r-${idx}`}
                          type="file" accept="image/*" onChange={(e) => handleSubFile(e, idx)} className="hidden" />
                      </div>
                      <span className={`text-[10px] text-center ${isDragOver ? "text-violet-500 font-semibold" : "text-gray-400"}`}>
                        {idx + 1}
                      </span>
                    </div>
                  );
                })}
              </div>

            </div>

            {uploadError?.zone === "sub" && <p className="text-xs text-red-500 mt-3">{uploadError.message}</p>}

            {/* ── 동영상 (선택) ── */}
            <div className="mt-5 pt-5 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-gray-700">동영상 URL (선택)</p>
                  <div className="relative">
                    <button type="button" onClick={() => setVideoHelpOpen((v) => !v)}
                      className="w-5 h-5 flex items-center justify-center rounded-full border border-gray-300 text-gray-400 text-[11px] font-bold hover:border-[#303236] hover:text-[#303236] transition-colors"
                      aria-label="동영상 URL 안내">?</button>
                    {videoHelpOpen && (
                      <div className="absolute z-20 top-full left-0 mt-1.5 w-64 bg-white border border-gray-200 rounded shadow-lg p-3">
                        <p className="text-[11px] text-gray-500 leading-relaxed">
                          등록하면 상세 갤러리 썸네일 맨 뒤에 <b className="text-[#303236]">▶ 영상</b>이 추가됩니다. (YouTube·Vimeo는 자동 임베드, mp4 등 직접 링크는 플레이어로 재생)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-gray-400">YouTube · Vimeo · mp4 링크</span>
              </div>
              <input type="url" value={form.videoUrl} onChange={(e) => set("videoUrl", e.target.value)}
                placeholder="예: https://youtu.be/abc123 또는 https://….mp4"
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#303236] rounded" />
            </div>

          </section>

          {/* ── 옵션 ── */}
          <section className="bg-white border border-gray-200 p-6 rounded-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-5">
              <h2 className="text-xs font-bold text-[#303236] uppercase tracking-widest">옵션</h2>
              <button type="button" onClick={() => { set("sizes", []); set("colors", []); }}
                disabled={form.sizes.length === 0 && form.colors.length === 0}
                className="px-3 py-1 text-[11px] border border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors">
                옵션 전체 해제
              </button>
            </div>
            <div className="mb-5">
              <Field label="기본 사이즈 (의류)">
                <div className="flex flex-wrap gap-2 mt-1">
                  {CLOTHING_SIZE_PRESETS.map((size) => {
                    const active = form.sizes.includes(size);
                    return (
                      <button key={size} type="button" onClick={() => toggleArr("sizes", size)}
                        className={`min-w-[48px] px-3 py-1.5 text-sm border font-semibold transition-colors rounded ${
                          active ? "bg-[#303236] text-white border-[#303236]" : "bg-white text-gray-300 border-gray-200 line-through"
                        }`}>
                        {size}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex gap-2">
                  <input value={form.customSizeInput} onChange={(e) => set("customSizeInput", e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSize(); } }}
                    placeholder="사이즈 입력 후 Enter 또는 추가 (예: 30,32,34,36,38,40)"
                    className="flex-1 border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#303236] rounded" />
                  {/* 빠른 템플릿 — 선택 시 해당 사이즈 세트로 교체 */}
                  <select
                    value=""
                    onChange={(e) => {
                      const t = SIZE_TEMPLATES.find((t) => t.label === e.target.value);
                      if (t) set("sizes", sortSizes(t.sizes));
                    }}
                    className="border border-gray-200 rounded px-2 py-2 text-sm text-gray-600 bg-white focus:outline-none focus:border-[#303236]">
                    <option value="">템플릿 선택</option>
                    {SIZE_TEMPLATES.map((t) => (
                      <option key={t.label} value={t.label}>{t.label}</option>
                    ))}
                  </select>
                  <button type="button" onClick={addCustomSize}
                    className="px-3 py-2 bg-[#303236] text-white text-xs hover:bg-[#243d5e] transition-colors rounded">추가</button>
                </div>
                {customSizes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {customSizes.map((size) => (
                      <div key={size} className="flex items-center gap-1.5 border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs rounded">
                        {size}
                        <button type="button" onClick={() => set("sizes", sortSizes(form.sizes.filter((s) => s !== size)))}
                          className="text-gray-400 hover:text-red-500">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {form.sizes.length > 0 && (
                <p className="text-xs text-gray-400 mt-3">선택된 사이즈 {form.sizes.length}개: {form.sizes.join(", ")}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">색상 옵션</label>
              <div className="flex flex-wrap gap-2 mb-3 items-start">
                {COLOR_PRESETS.map((preset) => {
                  const selected = form.colors.some((c) => c.name === preset.name);
                  return (
                    <button key={preset.name} type="button" onClick={() => toggleColor(preset)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 border text-xs transition-all rounded ${
                        selected ? "border-[#E5541B] bg-orange-50 font-semibold text-gray-800" : "border-gray-200 text-gray-600 hover:border-gray-400"
                      }`}>
                      <span className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: preset.hex }} />
                      {preset.name}
                      {selected && <span className="text-[#E5541B] font-bold">✓</span>}
                    </button>
                  );
                })}
                {colorDropdownOptions.length > 0 && (
                  <div className="relative flex-1 min-w-[140px]">
                    <button type="button" onClick={() => setColorDropdownOpen((v) => !v)}
                      className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 border border-gray-200 text-gray-600 text-xs rounded hover:border-gray-400 transition-colors">
                      자주 쓴 색상
                      <span className="text-gray-400">{colorDropdownOpen ? "▲" : "▼"}</span>
                    </button>
                    {colorDropdownOpen && (
                      <div className="absolute z-20 mt-1 left-0 w-full max-h-72 overflow-y-auto bg-white border border-gray-200 rounded shadow-lg">
                        {colorDropdownOptions.map((opt) => {
                          const selected = form.colors.some((c) => c.name === opt.name);
                          return (
                            <button key={opt.name} type="button" onClick={() => { toggleColor(opt); setColorDropdownOpen(false); }}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors border-b border-gray-50 last:border-0 ${
                                selected ? "bg-orange-50 font-semibold text-gray-800" : "text-gray-600 hover:bg-gray-50"
                              }`}>
                              <span className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: opt.hex }} />
                              <span className="flex-1">{opt.name}</span>
                              {selected && <span className="text-[#E5541B] font-bold">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2 items-center mt-2">
                <input value={form.colorName} onChange={(e) => set("colorName", e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); addCustomColor(); } }}
                  placeholder="커스텀 색상명 (예: 형광그린)"
                  className="flex-1 border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#303236] rounded" />
                <input type="color" value={form.colorHex} onChange={(e) => set("colorHex", e.target.value)}
                  className="w-10 h-9 border border-gray-200 cursor-pointer rounded p-0.5" />
                <button type="button" onClick={addCustomColor}
                  className="px-3 py-2 bg-[#303236] text-white text-xs hover:bg-[#243d5e] transition-colors rounded">추가</button>
              </div>
              {customColors.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {customColors.map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs rounded">
                      <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: c.hex }} />
                      {c.name}
                      <button type="button" onClick={() => set("colors", form.colors.filter((fc) => fc.name !== c.name))}
                        className="text-gray-400 hover:text-red-500 ml-0.5">×</button>
                    </div>
                  ))}
                </div>
              )}
              {form.colors.length > 0 && (
                <p className="text-xs text-gray-400 mt-2">선택된 색상 {form.colors.length}개: {form.colors.map((c) => c.name).join(", ")}</p>
              )}
            </div>
          </section>

          {/* ── 상세 설명 ── */}
          <section className="bg-white border border-gray-200 p-6 rounded-xl">
            <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-bold text-[#303236] uppercase tracking-widest">상세 설명</h2>
                <div className="relative">
                  <button type="button" onClick={() => setDetailBlocksHelpOpen((v) => !v)}
                    className="w-5 h-5 flex items-center justify-center rounded-full border border-gray-300 text-gray-400 text-[11px] font-bold hover:border-[#303236] hover:text-[#303236] transition-colors"
                    aria-label="상세 설명 안내">?</button>
                  {detailBlocksHelpOpen && (
                    <div className="absolute z-20 top-full left-0 mt-1.5 w-64 bg-white border border-gray-200 rounded shadow-lg p-3">
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        이미지를 올리면 <b className="text-[#303236]">위→아래 순서</b>대로 상세페이지에 표시됩니다. 카드를 드래그해 순서를 바꾸세요.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* 여러 장 업로드 — 선택한 이미지들이 각각 블록으로 추가 (이미지 중심 에디터) */}
                <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded cursor-pointer transition-colors ${uploadingBlocksMulti ? "bg-gray-200 text-gray-400 pointer-events-none" : "bg-[#303236] text-white hover:bg-[#243d5e]"}`}>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleBlocksMultiUpload} disabled={uploadingBlocksMulti} />
                  {uploadingBlocksMulti ? <><span className="w-3 h-3 border-2 border-gray-300 border-t-white rounded-full animate-spin" />업로드 중…</> : "+ 여러 장 업로드"}
                </label>
              </div>
            </div>
            {uploadError?.zone === "detail" && <p className="text-xs text-red-500 mb-2">{uploadError.message}</p>}
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {form.detailBlocks.map((block, idx) => (
                <div key={block.id} draggable
                  onDragStart={() => setDragBlockIdx(idx)}
                  onDragOver={(e) => onBlockDragOver(e, idx)} onDrop={(e) => onBlockDrop(e, idx)} onDragEnd={onBlockDragEnd}
                  title="드래그해 순서 변경"
                  className={`relative aspect-[3/5] rounded-lg overflow-hidden border cursor-grab active:cursor-grabbing transition-all ${
                    dragOverBlockIdx === idx && dragBlockIdx !== null && dragBlockIdx !== idx
                      ? "border-violet-400 ring-2 ring-violet-300"
                      : dragBlockIdx === idx ? "border-dashed border-gray-400 opacity-50" : "border-gray-200"
                  }`}>
                  {block.imageUrl ? (
                    <Image src={block.imageUrl} alt={`상세 ${idx + 1}`} fill className="object-cover pointer-events-none" sizes="160px" />
                  ) : uploadingBlockIdx === idx ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                      <span className="w-5 h-5 border-2 border-gray-300 border-t-[#303236] rounded-full animate-spin" />
                    </div>
                  ) : (
                    <label htmlFor={`block-img-r-${idx}`}
                      className="w-full h-full flex flex-col items-center justify-center cursor-pointer bg-gray-50 text-gray-300 hover:text-[#303236]">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                      <span className="text-[10px] mt-1">이미지 업로드</span>
                    </label>
                  )}
                  <input ref={(el) => { blockImgRefs.current[idx] = el; }} id={`block-img-r-${idx}`}
                    type="file" accept="image/*" onChange={(e) => handleBlockImgFile(e, idx)} className="hidden" />
                  <span className="absolute top-1 left-1 bg-black/55 text-white text-[10px] px-1.5 py-0.5 rounded leading-none">{idx + 1}</span>
                  <button type="button" onClick={() => removeBlock(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[11px] flex items-center justify-center hover:bg-red-600 rounded-full leading-none">×</button>
                </div>
              ))}
              {/* 이미지 추가 카드 (여러 장 선택) */}
              <label className="aspect-[3/5] rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer text-gray-300 hover:text-[#303236] hover:border-[#303236] transition-colors">
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleBlocksMultiUpload} disabled={uploadingBlocksMulti} />
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                <span className="text-[10px] mt-1">이미지 추가</span>
              </label>
            </div>
          </section>


        </div>{/* end right col */}
      </div>{/* end grid */}

      {/* 브랜드 즉시 추가 팝업 */}
      {brandModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setBrandModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#303236] mb-1">새 브랜드 추가</h3>
            <p className="text-xs text-gray-400 mb-4">등록하면 이 상품에 바로 선택됩니다.</p>
            <input autoFocus value={newBrandName}
              onChange={(e) => { setNewBrandName(e.target.value); setBrandError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createBrand(); } }}
              placeholder="브랜드명 (예: 워크업)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#303236]" />
            {brandError && <p className="text-xs text-red-500 mt-2">{brandError}</p>}
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setBrandModalOpen(false)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
              <button type="button" onClick={createBrand} disabled={brandSaving || !newBrandName.trim()}
                className="px-4 py-2 text-sm bg-[#303236] text-white rounded-lg hover:bg-[#243d5e] transition-colors disabled:opacity-50">
                {brandSaving ? "등록 중..." : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
