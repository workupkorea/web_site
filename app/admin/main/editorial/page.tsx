"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ── 타입 정의 ──────────────────────────────────────────────
// 기획전 상세페이지의 "카드형" 제품 위젯(이미지 페이징+컬러+사이즈+아코디언) 전용 데이터.
// 실제 상품 DB(색상/사이즈/상세정보)와는 별개 — 기획전 배너마다 다른 이미지·문구를 자유롭게 넣기 위함.
type ProductCardColor = { id: string; name: string; hex: string; imageIndexes: number[]; soldOut?: boolean };
type ProductCardSize = { id: string; label: string; soldOut?: boolean };
type ProductCardDetail = {
  images: string[];
  colors: ProductCardColor[];
  sizes: ProductCardSize[];
  styleNo?: string;
  detailText: string;
  materialText: string;
  essentialText: string;
};

type ProductItem = {
  id: string;
  product_id: string;
  name: string;
  price: string;
  image_url: string;
  bg: string;
  card_detail?: ProductCardDetail;
};

type HeroTag = {
  id: string;
  x: number;
  y: number;
  pc_x?: number;
  pc_y?: number;
  name: string;
  price: string;
  product_id: string;
  image_url: string;
  bg: string;
};

type Banner = {
  title: string;
  desc: string;
  label?: string;     // 상세페이지 상단 라벨 (배너별 기획전명) — 예: "그대 이름은 바람 바람 바람"
  section_bg: string;
  image_url: string;
  card_type?: "product" | "image"; // "image" = 통이미지 카드 (제목/설명/썸네일 없이 이미지 한 장)
  link?: string;      // 통이미지 카드 클릭 시 이동할 링크 (PR 소식 등)
  items: ProductItem[];
  detail_items?: ProductItem[];  // 상세페이지 전용 추가 상품 (메인 items 뒤에 노출)
  tags?: HeroTag[];   // 섹션 이미지 위 상품 핫스팟 (단일 x/y 좌표 사용)
};

type EditorialBlock = {
  id: string;
  sort_order: number;
  is_visible: boolean;
  reversed: boolean;
  type: "image" | "product";
  hero: {
    title: string;
    subtitle: string;
    hero_subtitle: string;
    desc: string;
    image_url: string;
    image_position?: string;
    image_position_mobile?: string;
    image_scale?: number;
    image_scale_mobile?: number;
    bg_color: string;
    tags: HeroTag[];
  };
  banner1: Banner;
  banner2: Banner;
  banner3: Banner;
  banner4: Banner;
};

type SearchProduct = { id: string; name: string; price: string; imageUrl?: string };

// ── 기본값 ──────────────────────────────────────────────────
function emptyBanner(): Banner {
  return {
    title: "",
    desc: "",
    section_bg: "#303236",
    image_url: "",
    items: [emptyItem(), emptyItem(), emptyItem()],
    tags: [],
  };
}
function emptyItem(): ProductItem {
  return { id: uid(), product_id: "", name: "", price: "", image_url: "", bg: "#e5e7eb" };
}
function emptyBlock(order: number, reversed = false): EditorialBlock {
  return {
    id: uid(),
    sort_order: order,
    is_visible: true,
    reversed,
    type: "product",
    hero: {
      title: "",
      subtitle: "",
      hero_subtitle: "",
      desc: "",
      image_url: "",
      bg_color: "#303236",
      tags: [],
    },
    banner1: emptyBanner(),
    banner2: emptyBanner(),
    banner3: emptyBanner(),
    banner4: emptyBanner(),
  };
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── 제품 검색 피커 ─────────────────────────────────────────
function ProductPicker({ products, value, onSelect }: {
  products: SearchProduct[];
  value: string;
  onSelect: (p: SearchProduct) => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!open) setQuery(value); }, [value, open]);

  const MAX_RESULTS = 50;
  const q = query.trim().toLowerCase();
  const matched = q
    ? products.filter((p) => p.name.toLowerCase().includes(q))
    : products;
  const results = matched.slice(0, MAX_RESULTS);
  const overflow = matched.length - results.length;

  // 아래 공간이 부족하면 위로 펼침 — 페이지 하단에서 목록이 화면 밖으로 잘리는 문제 방지
  const DROPDOWN_MAX = 280; // max-h-64(256) + 여유
  function openDropdown() {
    const el = wrapRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setDropUp(spaceBelow < DROPDOWN_MAX && spaceAbove > spaceBelow);
    }
    setOpen(true);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); openDropdown(); }}
          onFocus={openDropdown}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="제품명으로 검색..."
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-[#303236]/30"
        />
        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      {open && results.length > 0 && (
        <div className={`absolute z-50 left-0 right-0 ${dropUp ? "bottom-full mb-1" : "top-full mt-1"} border border-gray-200 rounded-lg bg-white shadow-lg max-h-64 overflow-y-auto`}>
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(p);
                setQuery(p.name);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0"
            >
              {p.imageUrl ? (
                <img src={p.imageUrl} alt="" className="w-8 h-8 object-cover rounded flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 bg-gray-100 rounded flex-shrink-0 flex items-center justify-center">
                  <span className="text-[8px] text-gray-400 font-bold">WU</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-gray-800 truncate">{p.name}</p>
                <p className="text-[11px] text-gray-500">{p.price}</p>
              </div>
            </button>
          ))}
          {overflow > 0 && (
            <p className="px-3 py-2 text-[11px] text-gray-400 bg-gray-50 sticky bottom-0 border-t border-gray-100">
              외 {overflow}개 더 있음 — 검색어를 입력해 좁혀보세요
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function createDefaultBlocks(): EditorialBlock[] {
  const di = (name: string, price: string, pid: string, bg: string): ProductItem =>
    ({ id: uid(), product_id: pid, name, price, image_url: "", bg });
  const tag = (x: number, y: number, name: string, price: string, pid: string, bg: string): HeroTag =>
    ({ id: uid(), x, y, name, price, product_id: pid, image_url: "", bg });

  return [
    // ── 블록 1: 좌측 메인 — UV 대책 특집 ──────────────────
    {
      id: uid(), sort_order: 0, is_visible: true, reversed: false, type: "product",
      hero: {
        title: "UV 대책 특집",
        subtitle: "자외선 차단 + 흡한속건",
        hero_subtitle: "여름 현장 필수 아이템",
        desc: "UPF 인증 소재로 자외선을 막고, 땀은 날려버립니다. 강렬한 여름 햇볕 아래 현장에서도 쾌적함을 유지하는 기능성 라인업.",
        image_url: "", bg_color: "#7C3400",
        tags: [
          tag(32, 22, "쿨링 반팔 티셔츠", "19,000원", "cooling-short-sleeve", "#2d4f72"),
          tag(58, 45, "흡한속건 긴팔 티셔츠", "25,000원", "quick-dry-long-sleeve", "#243d5e"),
          tag(42, 68, "스트레치 카고 팬츠", "39,000원", "stretch-cargo-pants", "#303236"),
        ],
      },
      banner1: {
        title: "자외선을 막는 기능성 상의",
        desc: "UPF 40+ 인증 소재로 강렬한 자외선을 차단하면서도 흡한속건 기능으로 쾌적함을 유지합니다.",
        section_bg: "#4a7fa5", image_url: "",
        items: [
          di("쿨링 반팔 티셔츠", "19,000원", "cooling-short-sleeve", "#2d4f72"),
          di("흡한속건 긴팔 티셔츠", "25,000원", "quick-dry-long-sleeve", "#243d5e"),
          di("워크 롤업 셔츠", "35,000원", "work-rollup-shirt", "#4d4d4d"),
        ],
      },
      banner2: {
        title: "현장을 버티는 하의",
        desc: "움직임이 많은 현장 환경에서도 불편함 없이 착용 가능한 스트레치 소재 하의 라인업입니다.",
        section_bg: "#303236", image_url: "",
        items: [
          di("스트레치 카고 팬츠", "39,000원", "stretch-cargo-pants", "#303236"),
          di("워크 치노 팬츠", "45,000원", "work-chino-pants", "#3D3D3D"),
          di("멀티포켓 조끼", "35,000원", "multi-pocket-vest", "#5a5a5a"),
        ],
      },
      banner3: {
        title: "UV 차단 액세서리 모음",
        desc: "자외선을 막는 것은 옷만이 아닙니다. 모자, 팔토시, 넥게이터까지 빈틈 없이 자외선을 차단하세요.",
        section_bg: "#6b9cb0", image_url: "",
        items: [
          di("UV 차단 팔토시", "12,000원", "cooling-short-sleeve", "#4a7fa5"),
          di("넥게이터", "9,000원", "quick-dry-long-sleeve", "#2d4f72"),
          di("챙넓은 작업 모자", "18,000원", "work-rollup-shirt", "#3a5a7a"),
        ],
      },
      banner4: {
        title: "여성 UV 케어 라인",
        desc: "여성 작업자를 위한 UV 차단 전용 라인. 슬림 핏으로 작업 효율과 스타일을 동시에 잡았습니다.",
        section_bg: "#2e4a6a", image_url: "",
        items: [
          di("여성 UV 슬림 팬츠", "42,000원", "stretch-cargo-pants", "#303236"),
          di("여성 쿨링 상의", "22,000원", "cooling-short-sleeve", "#2d4f72"),
          di("여성 기능 조끼", "33,000원", "multi-pocket-vest", "#3a5a6a"),
        ],
      },
    },

    // ── 블록 2: 우측 메인 — 건설현장 필수템 ──────────────
    {
      id: uid(), sort_order: 1, is_visible: true, reversed: true, type: "product",
      hero: {
        title: "건설현장 필수템",
        subtitle: "내구성과 안전을 동시에",
        hero_subtitle: "현장 작업자가 직접 선택한",
        desc: "15년 경력자도 인정한 현장 최강 라인업. 1,000회 내구성 테스트와 KC 인증 안전 소재로 어떤 현장에서도 믿을 수 있습니다.",
        image_url: "", image_scale: 1.0, image_scale_mobile: 1.0, bg_color: "#303236",
        tags: [
          tag(30, 28, "반사띠 안전 자켓", "79,000원", "reflective-safety-jacket", "#303236"),
          tag(52, 48, "스트레치 카고 팬츠", "39,000원", "stretch-cargo-pants", "#303236"),
          tag(38, 70, "쿨링 반팔 티셔츠", "19,000원", "cooling-short-sleeve", "#2d4f72"),
        ],
      },
      banner1: {
        title: "내구성 검증 작업복",
        desc: "1,000회 내구성 테스트를 통과한 소재. 현장의 거친 환경에서도 형태를 유지하는 워크업 SITE 라인입니다.",
        section_bg: "#243d5e", image_url: "",
        items: [
          di("스트레치 카고 팬츠", "39,000원", "stretch-cargo-pants", "#303236"),
          di("쿨링 반팔 티셔츠", "19,000원", "cooling-short-sleeve", "#2d4f72"),
          di("멀티포켓 조끼", "35,000원", "multi-pocket-vest", "#5a5a5a"),
        ],
      },
      banner2: {
        title: "안전 인증 보호구",
        desc: "KC 인증을 받은 반사 소재와 형광 원단으로 어두운 현장에서도 내 존재를 알립니다.",
        section_bg: "#2e3d28", image_url: "",
        items: [
          di("반사띠 안전 자켓", "79,000원", "reflective-safety-jacket", "#303236"),
          di("경량 방풍 자켓", "59,000원", "lightweight-windproof-jacket", "#243d5e"),
          di("흡한속건 긴팔 티셔츠", "25,000원", "quick-dry-long-sleeve", "#243d5e"),
        ],
      },
      banner3: {
        title: "현장 방호 & 보호 용품",
        desc: "장갑, 안전모, 안전화까지. 전신을 지키는 워크업 안전 보호구 풀 라인업입니다.",
        section_bg: "#1a2e4a", image_url: "",
        items: [
          di("고시인성 안전 조끼", "45,000원", "reflective-safety-jacket", "#2d4a2a"),
          di("방호 카고 팬츠", "55,000원", "stretch-cargo-pants", "#303236"),
          di("안전 멀티포켓 조끼", "39,000원", "multi-pocket-vest", "#3a3a5a"),
        ],
      },
      banner4: {
        title: "현장 작업 잡화",
        desc: "현장에서 매일 쓰는 공구함, 허리쌕, 장갑까지. 워크업 현장 잡화로 작업 효율을 높이세요.",
        section_bg: "#3a3a2e", image_url: "",
        items: [
          di("작업용 장갑 (6매)", "8,000원", "cooling-short-sleeve", "#4a3a2a"),
          di("현장 허리쌕", "28,000원", "quick-dry-long-sleeve", "#3a4a2a"),
          di("공구 파우치", "15,000원", "work-rollup-shirt", "#4a4a3a"),
        ],
      },
    },

    // ── 블록 3: 좌측 메인 — 아웃도어 특집 ────────────────
    {
      id: uid(), sort_order: 2, is_visible: true, reversed: false, type: "product",
      hero: {
        title: "아웃도어 특집",
        subtitle: "방풍·방수 퍼포먼스",
        hero_subtitle: "날씨를 이기는 기어",
        desc: "산에서도, 현장에서도. 날씨를 이기는 기어. 방풍·방수 가공과 360g 초경량 설계로 어떤 환경도 거뜬합니다.",
        image_url: "", bg_color: "#1E3A20",
        tags: [
          tag(35, 25, "경량 방풍 자켓", "59,000원", "lightweight-windproof-jacket", "#243d5e"),
          tag(55, 50, "방풍 후드 집업", "65,000원", "windproof-hoodie-zip", "#3D3D3D"),
          tag(40, 72, "스트레치 카고 팬츠", "39,000원", "stretch-cargo-pants", "#303236"),
        ],
      },
      banner1: {
        title: "바람과 비를 막는 아우터",
        desc: "방풍·방수 가공으로 거친 날씨에도 체온을 지켜주는 아우터 라인입니다. 360g의 초경량 설계로 움직임도 자유롭습니다.",
        section_bg: "#2d5a30", image_url: "",
        items: [
          di("경량 방풍 자켓", "59,000원", "lightweight-windproof-jacket", "#243d5e"),
          di("방풍 후드 집업", "65,000원", "windproof-hoodie-zip", "#3D3D3D"),
          di("멀티포켓 조끼", "35,000원", "multi-pocket-vest", "#5a5a5a"),
        ],
      },
      banner2: {
        title: "아웃도어를 완성하는 하의",
        desc: "험한 지형에서도 자유로운 움직임을 보장하는 스트레치 하의. 다용도 포켓으로 편의성을 높였습니다.",
        section_bg: "#3d5c3f", image_url: "",
        items: [
          di("스트레치 카고 팬츠", "39,000원", "stretch-cargo-pants", "#303236"),
          di("워크 치노 팬츠", "45,000원", "work-chino-pants", "#3D3D3D"),
          di("흡한속건 긴팔 티셔츠", "25,000원", "quick-dry-long-sleeve", "#243d5e"),
        ],
      },
      banner3: {
        title: "아웃도어 베이스레이어",
        desc: "피부에 직접 닿는 베이스레이어는 소재가 핵심입니다. 흡습속건·항균 기능으로 장시간 착용에도 쾌적합니다.",
        section_bg: "#1e4022", image_url: "",
        items: [
          di("흡습속건 베이스 티셔츠", "21,000원", "cooling-short-sleeve", "#2d4f72"),
          di("베이스레이어 긴팔", "27,000원", "quick-dry-long-sleeve", "#243d5e"),
          di("항균 기능 셔츠", "37,000원", "work-rollup-shirt", "#3d5c3f"),
        ],
      },
      banner4: {
        title: "아웃도어 전용 액세서리",
        desc: "장갑, 모자, 넥게이터. 작은 디테일이 모여 완벽한 아웃도어 착장이 됩니다.",
        section_bg: "#2a4a2c", image_url: "",
        items: [
          di("경량 멀티포켓 조끼", "37,000원", "multi-pocket-vest", "#4a6a4c"),
          di("아웃도어 레깅스 팬츠", "41,000원", "stretch-cargo-pants", "#2d4a30"),
          di("산행 치노 쇼츠", "33,000원", "work-chino-pants", "#3D3D3D"),
        ],
      },
    },

    // ── 블록 4: 우측 메인 — 현장 to 일상 ─────────────────
    {
      id: uid(), sort_order: 3, is_visible: true, reversed: true, type: "product",
      hero: {
        title: "현장 to 일상",
        subtitle: "출근도 퇴근도 이 한 벌로",
        hero_subtitle: "현장과 일상 사이, 어색하지 않게",
        desc: "현장 실용성 + 일상 감각. DAILY 라인 전체 모음. 오전엔 공장, 오후엔 바이어 미팅. 스트레치 소재와 세련된 실루엣으로 어느 자리에서도 어색함이 없습니다.",
        image_url: "", bg_color: "#2D2D2D",
        tags: [
          tag(36, 24, "헤비 크루넥 스웻셔츠", "49,000원", "heavy-crewneck-sweatshirt", "#4d4d4d"),
          tag(55, 52, "워크 치노 팬츠", "45,000원", "work-chino-pants", "#3D3D3D"),
          tag(40, 74, "방풍 후드 집업", "65,000원", "windproof-hoodie-zip", "#3D3D3D"),
        ],
      },
      banner1: {
        title: "일상을 완성하는 상의",
        desc: "퇴근 후 카페, 주말 나들이. 현장 작업복에서 일상복으로 자연스럽게 이어지는 DAILY 상의 라인입니다.",
        section_bg: "#4d4d4d", image_url: "",
        items: [
          di("헤비 크루넥 스웻셔츠", "49,000원", "heavy-crewneck-sweatshirt", "#4d4d4d"),
          di("워크 롤업 셔츠", "35,000원", "work-rollup-shirt", "#4d4d4d"),
          di("방풍 후드 집업", "65,000원", "windproof-hoodie-zip", "#3D3D3D"),
        ],
      },
      banner2: {
        title: "현장도 일상도 맞는 하의",
        desc: "오전엔 공장, 오후엔 바이어 미팅. 스트레치 소재와 세련된 실루엣으로 어느 자리에서도 어색함이 없습니다.",
        section_bg: "#3D3D3D", image_url: "",
        items: [
          di("워크 치노 팬츠", "45,000원", "work-chino-pants", "#3D3D3D"),
          di("스트레치 카고 팬츠", "39,000원", "stretch-cargo-pants", "#303236"),
          di("멀티포켓 조끼", "35,000원", "multi-pocket-vest", "#5a5a5a"),
        ],
      },
      banner3: {
        title: "워크데일리 코디 세트",
        desc: "상의와 하의를 함께 구매하면 더 저렴하게. 워크업이 제안하는 데일리 코디 세트를 만나보세요.",
        section_bg: "#5a5a5a", image_url: "",
        items: [
          di("크루넥 + 치노 세트", "85,000원", "heavy-crewneck-sweatshirt", "#4d4d4d"),
          di("집업 + 카고 세트", "95,000원", "windproof-hoodie-zip", "#3D3D3D"),
          di("롤업셔츠 + 치노 세트", "72,000원", "work-rollup-shirt", "#5a5a5a"),
        ],
      },
      banner4: {
        title: "커스텀 오더 라인",
        desc: "회사 로고, 이름, 부서명까지. 나만의 작업복을 맞춤 주문하세요. 10벌 이상 단체 주문 시 특별 할인.",
        section_bg: "#2D2D2D", image_url: "",
        items: [
          di("커스텀 반팔 티셔츠", "24,000원~", "cooling-short-sleeve", "#3a3a3a"),
          di("커스텀 조끼", "42,000원~", "multi-pocket-vest", "#4a4a4a"),
          di("커스텀 카고 팬츠", "47,000원~", "stretch-cargo-pants", "#1a2a3a"),
        ],
      },
    },
  ];
}

// ── 이미지 업로드 헬퍼 ─────────────────────────────────────
async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body: form });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "업로드 실패");
  return json.url as string;
}

// 업로드 전 자동 리사이징 (최장변 1800px 이하로 축소, 비율 유지)
async function resizeImage(file: File, maxPx = 1800): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const max = Math.max(img.width, img.height);
      if (max <= maxPx) { resolve(file); return; }
      const ratio = maxPx / max;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(blob
          ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" })
          : file),
        "image/jpeg", 0.92
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(file); };
    img.src = objUrl;
  });
}

// ── 서브 컴포넌트: 이미지 업로드 필드 (드래그 & 드롭 지원) ──
function ImageField({
  label,
  hint,
  value,
  onChange,
  compact = false,
  aspectRatio,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (url: string) => void;
  compact?: boolean;
  aspectRatio?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr]             = useState("");
  const [dragging, setDragging]   = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) { setErr("이미지 파일만 업로드 가능합니다."); return; }
    setErr(""); setUploading(true);
    try {
      const resized = await resizeImage(file);
      const url = await uploadImage(resized);
      onChange(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "업로드 실패");
    } finally { setUploading(false); }
  }

  function onDragOver(e: React.DragEvent)  { e.preventDefault(); setDragging(true); }
  function onDragEnter(e: React.DragEvent) { e.preventDefault(); setDragging(true); }
  function onDragLeave(e: React.DragEvent) { e.preventDefault(); setDragging(false); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  if (compact) {
    return (
      <div>
        <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">{label}</label>
        <div
          onDragOver={onDragOver} onDragEnter={onDragEnter}
          onDragLeave={onDragLeave} onDrop={onDrop}
          onClick={() => !uploading && ref.current?.click()}
          className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
            dragging ? "border-[#E5541B] bg-orange-50" :
            value ? "border-gray-200 hover:border-gray-300" :
                    "border-dashed border-gray-300 hover:border-[#303236]"
          }`}
          style={{ aspectRatio: aspectRatio ?? "3/4" }}
        >
          <input ref={ref} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
          {value ? (
            <img src={value} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none">
              <svg className={`w-6 h-6 ${dragging ? "text-[#E5541B]" : "text-gray-300"}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-[10px] text-gray-400 text-center leading-snug px-2">클릭 또는<br/>드래그</p>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <span className="w-4 h-4 border-2 border-[#E5541B] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        {value && (
          <div className="mt-1.5 space-y-0.5">
            <p className="text-[10px] text-gray-500 truncate">{value.split("/").pop()}</p>
            <p className="text-[10px] text-gray-400 leading-snug">{hint}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <button type="button" onClick={(e) => { e.stopPropagation(); ref.current?.click(); }}
                className="text-[11px] text-[#303236] hover:underline">이미지 변경</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); onChange(""); }}
                className="text-[11px] text-red-400 hover:text-red-600">제거</button>
            </div>
          </div>
        )}
        {!value && <p className="text-[10px] text-gray-400 mt-1 leading-snug">{hint}</p>}
        {err && <p className="text-[11px] text-red-500 mt-1">{err}</p>}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      <div
        onDragOver={onDragOver} onDragEnter={onDragEnter}
        onDragLeave={onDragLeave} onDrop={onDrop}
        onClick={() => !uploading && ref.current?.click()}
        className={`relative rounded-xl border-2 transition-all cursor-pointer ${
          dragging ? "border-[#E5541B] bg-orange-50 scale-[1.01]" :
          value     ? "border-gray-200 hover:border-gray-300" :
                      "border-dashed border-gray-300 hover:border-[#303236]"
        }`}
      >
        <input ref={ref} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />

        {value ? (
          <div className="flex items-center gap-3 p-3" onClick={e => e.stopPropagation()}>
            <img src={value} alt="" className="w-20 h-14 object-cover rounded-lg flex-shrink-0 border border-gray-100" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-gray-600 truncate">{value.split("/").pop()}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>
              <button
                onClick={(e) => { e.stopPropagation(); ref.current?.click(); }}
                className="text-[11px] text-[#303236] hover:underline mt-1"
              >이미지 변경</button>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="flex-shrink-0 text-[11px] text-red-400 hover:text-red-600 border border-red-100 px-2 py-1 rounded hover:bg-red-50"
            >제거</button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-5 px-4 text-center pointer-events-none">
            <svg className={`w-7 h-7 transition-colors ${dragging ? "text-[#E5541B]" : "text-gray-300"}`}
              fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className={`text-[13px] font-medium transition-colors ${dragging ? "text-[#E5541B]" : "text-gray-500"}`}>
              {dragging ? "여기에 이미지를 놓으세요" : "클릭하거나 이미지를 드래그"}
            </p>
            <p className="text-[11px] text-gray-400">{hint}</p>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
            <div className="flex items-center gap-2 text-[13px] text-gray-600">
              <span className="w-4 h-4 border-2 border-[#E5541B] border-t-transparent rounded-full animate-spin" />
              업로드 중...
            </div>
          </div>
        )}
      </div>
      {err && <p className="text-[11px] text-red-500 mt-1">{err}</p>}
    </div>
  );
}

// ── 서브 컴포넌트: 텍스트 입력 ─────────────────────────────
function Field({
  label, value, onChange, placeholder = "", multiline = false, showCount = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; showCount?: boolean;
}) {
  const cls = "w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#303236]/30";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-medium text-gray-600">{label}</label>
        {showCount && (
          <span className="text-[11px] text-gray-400 tabular-nums">{value.length}자 <span className="text-gray-300">(공백 포함)</span></span>
        )}
      </div>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} rows={3} className={cls} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} className={cls} />
      )}
    </div>
  );
}

// ── 서브 컴포넌트: 색상 입력 ───────────────────────────────
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-lg border border-gray-300 cursor-pointer flex-shrink-0" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#303236]/30"
          placeholder="#303236" />
      </div>
    </div>
  );
}

function emptyCardDetail(): ProductCardDetail {
  return { images: [], colors: [], sizes: [], styleNo: "", detailText: "", materialText: "", essentialText: "" };
}

// ── 서브 컴포넌트: 품번(Style No.) 입력 — 입고 스케쥴 상품코드 자동완성 ──
function StyleNoField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [codes, setCodes] = useState<{ code: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/admin/arrival")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { productCode?: string; productName?: string }[]) => {
        if (!Array.isArray(data)) return;
        const seen = new Set<string>();
        const list = data
          .filter((p) => p.productCode && !seen.has(p.productCode) && seen.add(p.productCode))
          .map((p) => ({ code: p.productCode!, name: p.productName ?? "" }));
        setCodes(list);
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">품번 (Style No.)</label>
      <input
        list="arrival-style-no-list"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="입고 스케쥴에서 검색하거나 직접 입력"
        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#303236]/30"
      />
      <datalist id="arrival-style-no-list">
        {codes.map((c) => (
          <option key={c.code} value={c.code}>{c.name}</option>
        ))}
      </datalist>
    </div>
  );
}

// ── 서브 컴포넌트: 카드형 상세(이미지 페이징+컬러+사이즈+아코디언 내용) 편집 ──
function CardDetailEditor({ detail, onChange }: {
  detail: ProductCardDetail | undefined;
  onChange: (detail: ProductCardDetail) => void;
}) {
  const [open, setOpen] = useState(true);
  const [sizeCsv, setSizeCsv] = useState("");
  // 예전 저장분(단일 imageIndex)을 배열로 자동 이관 — 저장된 데이터가 없어도 항상 배열을 보장한다.
  const raw = detail ?? emptyCardDetail();
  const d: ProductCardDetail = {
    ...raw,
    colors: raw.colors.map((c) => ({
      ...c,
      imageIndexes: c.imageIndexes ?? (typeof (c as { imageIndex?: number }).imageIndex === "number" ? [(c as { imageIndex?: number }).imageIndex!] : []),
    })),
  };
  const set = <K extends keyof ProductCardDetail>(k: K, v: ProductCardDetail[K]) => onChange({ ...d, [k]: v });

  async function addImage(file: File) {
    const resized = await resizeImage(file);
    const url = await uploadImage(resized);
    set("images", [...d.images, url]);
  }
  function removeImage(idx: number) {
    const nextImages = d.images.filter((_, i) => i !== idx);
    // 삭제된 이미지 번호는 목록에서 빼고, 그 뒤 번호들은 한 칸씩 당긴다.
    const nextColors = d.colors.map((c) => ({
      ...c,
      imageIndexes: c.imageIndexes.filter((n) => n !== idx).map((n) => (n > idx ? n - 1 : n)),
    }));
    onChange({ ...d, images: nextImages, colors: nextColors });
  }
  function addColor() {
    set("colors", [...d.colors, { id: uid(), name: "", hex: "#303236", imageIndexes: [] }]);
  }
  function toggleColorImage(idx: number, imageIdx: number) {
    const c = d.colors[idx];
    const has = c.imageIndexes.includes(imageIdx);
    updateColor(idx, { imageIndexes: has ? c.imageIndexes.filter((n) => n !== imageIdx) : [...c.imageIndexes, imageIdx].sort((a, b) => a - b) });
  }
  function updateColor(idx: number, patch: Partial<ProductCardColor>) {
    set("colors", d.colors.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function removeColor(idx: number) {
    set("colors", d.colors.filter((_, i) => i !== idx));
  }
  function addSize() {
    set("sizes", [...d.sizes, { id: uid(), label: "" }]);
  }
  // "S,M,L,XL" 형태로 한 번에 입력하면 콤마 기준으로 나눠 그만큼 사이즈를 만든다.
  function addSizesFromCsv(text: string) {
    const labels = text.split(",").map((t) => t.trim()).filter(Boolean);
    if (labels.length === 0) return;
    set("sizes", [...d.sizes, ...labels.map((label) => ({ id: uid(), label }))]);
  }
  function updateSize(idx: number, patch: Partial<ProductCardSize>) {
    set("sizes", d.sizes.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function removeSize(idx: number) {
    set("sizes", d.sizes.filter((_, i) => i !== idx));
  }

  return (
    <div className="mt-3 border-t border-gray-200 pt-3">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-[#303236] hover:opacity-70">
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        카드 상세 편집 (이미지 페이징 · 컬러 · 사이즈 · 아코디언)
      </button>

      {open && (
        <div className="mt-3 space-y-4 bg-white border border-gray-200 rounded-xl p-3">
          {/* 이미지 그리드 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">이미지 (등록한 순서대로 2열 그리드에 이어서 노출)</label>
            <div className="flex flex-wrap gap-2">
              {d.images.map((url, i) => (
                <div key={i} className="relative w-16 h-16 flex-shrink-0">
                  <img src={url} alt="" className="w-full h-full object-cover rounded border border-gray-200" />
                  <span className="absolute top-0.5 left-0.5 bg-black/60 text-white text-[9px] px-1 rounded">{i}</span>
                  <button type="button" onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] leading-none flex items-center justify-center">×</button>
                </div>
              ))}
              <label className="w-16 h-16 flex-shrink-0 border-2 border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer hover:border-[#303236] text-gray-400 text-xl">
                +
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) addImage(f); e.target.value = ""; }} />
              </label>
            </div>
          </div>

          {/* 컬러 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-600">컬러 (선택 시 체크한 이미지들만 표시 — 여러 장 가능)</label>
              <button type="button" onClick={addColor} className="text-[11px] text-[#303236] hover:underline">+ 컬러 추가</button>
            </div>
            <div className="space-y-2">
              {d.colors.map((c, i) => (
                <div key={c.id} className="bg-gray-50 border border-gray-200 rounded-lg p-1.5 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input type="color" value={c.hex} onChange={(e) => updateColor(i, { hex: e.target.value })}
                      className="w-7 h-7 rounded border border-gray-300 cursor-pointer flex-shrink-0" />
                    <input type="text" value={c.name} onChange={(e) => updateColor(i, { name: e.target.value })}
                      placeholder="색상명" className="w-20 text-xs border border-gray-300 rounded px-2 py-1.5" />
                    <label className="flex items-center gap-1 text-[10px] text-gray-500 flex-shrink-0">
                      <input type="checkbox" checked={!!c.soldOut} onChange={(e) => updateColor(i, { soldOut: e.target.checked })} className="w-3 h-3" />
                      품절
                    </label>
                    <button type="button" onClick={() => removeColor(i)} className="ml-auto text-[11px] text-red-400 hover:text-red-600 flex-shrink-0">삭제</button>
                  </div>
                  {d.images.length === 0 ? (
                    <p className="text-[10px] text-gray-400 pl-1">위에 이미지를 먼저 등록하세요.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 pl-1">
                      {d.images.map((url, imgIdx) => {
                        const checked = c.imageIndexes.includes(imgIdx);
                        return (
                          <button
                            key={imgIdx}
                            type="button"
                            onClick={() => toggleColorImage(i, imgIdx)}
                            className={`relative w-10 h-10 flex-shrink-0 rounded border-2 overflow-hidden ${checked ? "border-[#303236]" : "border-transparent opacity-50"}`}
                            title={`이미지 ${imgIdx}`}
                          >
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            {checked && (
                              <span className="absolute inset-0 bg-black/30 flex items-center justify-center text-white text-xs font-bold">✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 사이즈 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-600">사이즈</label>
              <button type="button" onClick={addSize} className="text-[11px] text-[#303236] hover:underline">+ 사이즈 추가</button>
            </div>
            <div className="flex items-center gap-1.5 mb-2">
              <input
                type="text"
                value={sizeCsv}
                onChange={(e) => setSizeCsv(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  addSizesFromCsv(sizeCsv);
                  setSizeCsv("");
                }}
                placeholder="S,M,L,XL 처럼 콤마로 구분해 한 번에 입력"
                className="flex-1 text-xs border border-gray-300 rounded-lg px-2.5 py-1.5"
              />
              <button
                type="button"
                onClick={() => { addSizesFromCsv(sizeCsv); setSizeCsv(""); }}
                className="text-[11px] font-medium text-white bg-[#303236] hover:bg-[#26385c] px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
              >
                일괄 추가
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {d.sizes.map((s, i) => (
                <div key={s.id} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-1">
                  <input type="text" value={s.label} onChange={(e) => updateSize(i, { label: e.target.value })}
                    placeholder="S" className="w-12 text-xs border border-gray-300 rounded px-1.5 py-1 text-center" />
                  <label className="flex items-center gap-0.5 text-[10px] text-gray-500">
                    <input type="checkbox" checked={!!s.soldOut} onChange={(e) => updateSize(i, { soldOut: e.target.checked })} className="w-3 h-3" />
                    품절
                  </label>
                  <button type="button" onClick={() => removeSize(i)} className="text-[10px] text-red-400 hover:text-red-600">×</button>
                </div>
              ))}
            </div>
          </div>

          {/* 품번 — 입고 스케쥴에서 검색해 가져오거나 직접 입력 */}
          <StyleNoField value={d.styleNo ?? ""} onChange={(v) => set("styleNo", v)} />

          {/* 아코디언 내용 */}
          <Field label="상품 상세정보" value={d.detailText} onChange={(v) => set("detailText", v)} multiline placeholder="제품 상세 설명을 입력하세요." />
          <Field label="소재" value={d.materialText} onChange={(v) => set("materialText", v)} multiline placeholder="예: 폴리에스터 100%" />
          <Field label="상품 필수 정보" value={d.essentialText} onChange={(v) => set("essentialText", v)} multiline placeholder="제조사, 취급주의, 원산지 등" />
        </div>
      )}
    </div>
  );
}

// ── 서브 컴포넌트: 배너 섹션 이미지 상품 태그 에디터 ───────
// 프런트(WhiteBox)와 동일하게 8:9 object-contain → 단일 x/y 좌표로 PC·모바일 공용
function BannerTagEditor({ tags, imageUrl, onChange, products }: {
  tags: HeroTag[];
  imageUrl: string;
  onChange: (tags: HeroTag[]) => void;
  products: SearchProduct[];
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const imgAreaRef = useRef<HTMLDivElement>(null);
  const wasDraggingRef = useRef(false);

  function updateTag(idx: number, patch: Partial<HeroTag>) {
    const next = [...tags];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }
  function deleteTag(idx: number) {
    onChange(tags.filter((_, i) => i !== idx));
    setSelectedIdx(null);
  }

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (wasDraggingRef.current) { wasDraggingRef.current = false; return; }
    if (!imageUrl) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    const next = [...tags, { id: uid(), x, y, name: "", price: "", product_id: "", image_url: "", bg: "#303236" }];
    onChange(next);
    setSelectedIdx(next.length - 1);
  }
  function onTagDown(e: React.PointerEvent<HTMLButtonElement>, idx: number) {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    wasDraggingRef.current = false;
    setDraggingIdx(idx);
    setSelectedIdx(idx);
  }
  function onTagMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (draggingIdx === null || !imgAreaRef.current) return;
    wasDraggingRef.current = true;
    const rect = imgAreaRef.current.getBoundingClientRect();
    const x = Math.round(Math.min(99, Math.max(1, ((e.clientX - rect.left) / rect.width) * 100)));
    const y = Math.round(Math.min(99, Math.max(1, ((e.clientY - rect.top) / rect.height) * 100)));
    updateTag(draggingIdx, { x, y });
  }

  const selectedTag = selectedIdx !== null ? tags[selectedIdx] : null;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-[11px] font-semibold text-gray-700">📍 이미지 상품 태그 ({tags.length}개)</label>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {imageUrl ? "이미지 클릭 → 태그 추가 · 드래그 → 위치 이동 · 클릭 → 편집" : "섹션 이미지를 먼저 등록하세요"}
          </p>
        </div>
        {tags.length > 0 && (
          <button onClick={() => { onChange([]); setSelectedIdx(null); }}
            className="text-[11px] text-red-400 hover:text-red-600">전체 삭제</button>
        )}
      </div>

      <div className="flex gap-3">
        {/* 클릭 영역 — 프런트와 동일 8:9 object-contain */}
        <div
          ref={imgAreaRef}
          onClick={handleImageClick}
          className="relative flex-shrink-0 rounded-xl overflow-hidden select-none border border-gray-200 bg-gray-200"
          style={{ width: "150px", aspectRatio: "440 / 495", cursor: draggingIdx !== null ? "grabbing" : (imageUrl ? "crosshair" : "default") }}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" draggable={false}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">이미지 없음</div>
          )}
          {tags.map((tag, idx) => (
            <button
              key={tag.id}
              onPointerDown={(e) => onTagDown(e, idx)}
              onPointerMove={onTagMove}
              onPointerUp={() => setDraggingIdx(null)}
              onClick={(e) => { e.stopPropagation(); if (!wasDraggingRef.current) setSelectedIdx(selectedIdx === idx ? null : idx); }}
              className="absolute"
              style={{ left: `${tag.x}%`, top: `${tag.y}%`, transform: "translate(-50%,-50%)", cursor: draggingIdx === idx ? "grabbing" : "grab", touchAction: "none" }}
              title={tag.name || `태그 ${idx + 1}`}
            >
              <span className={`flex items-center justify-center rounded-full transition-all ${
                selectedIdx === idx ? "w-5 h-5 bg-[#E5541B]/90 border-2 border-white shadow-lg" : "w-4 h-4 bg-white/80 border-2 border-white shadow-md"
              }`}>
                <span className="text-[8px] font-bold text-[#303236]">{idx + 1}</span>
              </span>
            </button>
          ))}
          <div className="absolute inset-0 pointer-events-none opacity-10"
            style={{ backgroundImage: "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)", backgroundSize: "25% 25%" }} />
        </div>

        {/* 칩 + 선택 태그 편집 */}
        <div className="flex-1 min-w-0 space-y-2.5">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag, idx) => (
                <button key={tag.id} onClick={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-colors ${
                    selectedIdx === idx ? "bg-[#E5541B] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                  <span className="w-3.5 h-3.5 rounded-full bg-current opacity-30 flex items-center justify-center text-[9px] font-bold">{idx + 1}</span>
                  {tag.name || "이름 미입력"}
                </button>
              ))}
            </div>
          )}

          {selectedTag !== null && selectedIdx !== null ? (
            <div className="border-2 border-[#E5541B]/30 rounded-xl p-3 bg-orange-50/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#E5541B]">태그 {selectedIdx + 1} 편집</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-400">{selectedTag.x}%, {selectedTag.y}%</span>
                  <button onClick={() => deleteTag(selectedIdx)} className="text-[11px] text-red-500 hover:text-red-700 font-medium">삭제</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">제품 검색</label>
                <ProductPicker products={products} value={selectedTag.name}
                  onSelect={(p) => updateTag(selectedIdx, { product_id: p.id, name: p.name, price: p.price, image_url: p.imageUrl ?? "" })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="상품명" value={selectedTag.name} onChange={(v) => updateTag(selectedIdx, { name: v })} placeholder="쿨링 반팔 티셔츠" />
                <Field label="가격" value={selectedTag.price} onChange={(v) => updateTag(selectedIdx, { price: v })} placeholder="19,000원" />
              </div>
            </div>
          ) : (
            imageUrl && tags.length === 0 && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-blue-400 text-lg">👆</span>
                <p className="text-[12px] text-blue-600">왼쪽 이미지를 클릭하면 태그가 추가됩니다.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── 서브 컴포넌트: 연결상품 슬롯 에디터 (탭 내부) ───────────
function SlotItemEditor({ item, onChange }: {
  item: ProductItem;
  onChange: (patch: Partial<ProductItem>) => void;
}) {
  return (
    <div>
      <div className="flex gap-4">
        {/* 상품 대표 이미지 */}
        <div className="flex-shrink-0" style={{ width: "110px" }}>
          <ImageField
            label="대표 이미지"
            hint=""
            value={item.image_url}
            onChange={(url) => onChange({ image_url: url })}
            compact
            aspectRatio="1/1"
          />
        </div>

        {/* 필드 */}
        <div className="flex-1 min-w-0 space-y-3">
          <Field label="상품명" value={item.name} onChange={(v) => onChange({ name: v })} placeholder="쿨링 반팔 티셔츠" />
        </div>
      </div>

      <CardDetailEditor
        detail={item.card_detail}
        onChange={(card_detail) => onChange({ card_detail })}
      />
    </div>
  );
}

// ── 서브 컴포넌트: 배너 에디터 (배너1/배너2 공용) ─────────
function BannerEditor({ banner, label, onChange, products }: {
  banner: Banner;
  label: string;
  onChange: (patch: Partial<Banner>) => void;
  products: SearchProduct[];
}) {
  const [itemTab, setItemTab] = useState(0);

  // 항상 3개 슬롯 고정
  const items3: ProductItem[] = [0, 1, 2].map((i) => banner.items[i] ?? emptyItem());

  function updateItem(idx: number, patch: Partial<ProductItem>) {
    const next = items3.map((item, i) => (i === idx ? { ...item, ...patch } : item));
    onChange({ items: next });
  }

  return (
    <div className="space-y-4">
      {/* 카드 타입 — 상품형(기본) / 통이미지형 */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[13px] font-semibold text-[#303236]">카드 타입</span>
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          {(["product", "image"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ card_type: t })}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                (banner.card_type ?? "product") === t ? "bg-[#303236] text-white" : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              {t === "product" ? "상품형 (기본)" : "통이미지형"}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-gray-400">
          {(banner.card_type ?? "product") === "image"
            ? "제목·설명·썸네일 없이 이미지 한 장으로 노출 (PR 소식 등)"
            : "상단이미지 + 제목 + 설명 + 썸네일"}
        </span>
      </div>

      {(banner.card_type ?? "product") === "image" ? (
        /* ── 통이미지형 — 이미지 한 장 + 링크 ── */
        <div className="flex gap-4 items-start">
          <div className="flex-shrink-0" style={{ width: "160px" }}>
            <ImageField
              label="통이미지"
              hint="세로형 · 약 900×1800px"
              value={banner.image_url}
              onChange={(url) => onChange({ image_url: url })}
              compact
              aspectRatio="1/2"
            />
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <Field
              label="클릭 시 이동 링크 (선택)"
              value={banner.link ?? ""}
              onChange={(v) => onChange({ link: v })}
              placeholder="/notice/123 또는 https://..."
            />
            <p className="text-[12px] text-gray-500 leading-relaxed">
              통이미지 한 장으로 노출됩니다. 제목·설명·썸네일은 표시되지 않습니다.<br />
              <b>권장 사이즈: 세로형 약 900×1800px (폭:높이 ≈ 1:2).</b> 옆 카드 높이에 맞춰 가운데 기준으로 채워지므로(잘릴 수 있음) 중요한 요소는 가운데에 배치하세요.<br />
              링크를 입력하면 이미지 클릭 시 해당 주소로 이동합니다. (외부 주소는 새 탭)
            </p>
          </div>
        </div>
      ) : (
      <>
      {/* 상단 라벨 (상세페이지 상단 기획전명 — 배너별로 개별 노출) */}
      <Field
        label="상단 라벨 (상세페이지 기획전명)"
        value={banner.label ?? ""}
        onChange={(v) => onChange({ label: v })}
        placeholder="그대 이름은 바람 바람 바람"
      />

      {/* 타이틀 + 설명 한 줄 (single-line inputs) */}
      <div className="flex gap-3 items-end">
        <div className="flex-shrink-0" style={{ width: "220px" }}>
          <Field label="타이틀" value={banner.title} onChange={(v) => onChange({ title: v })}
            placeholder="자외선을 막는 기능성 상의" />
        </div>
        <div className="flex-1 min-w-0">
          <Field label="설명" value={banner.desc} onChange={(v) => onChange({ desc: v })}
            placeholder="섹션 설명을 입력하세요" showCount />
        </div>
      </div>

      {/* 섹션 이미지 + 연결상품 탭 — 한 줄 배치 */}
      <div className="flex gap-4 items-start">
        {/* 좌: 섹션 이미지 — 8:9 비율. 태블릿·PC 등 큰 화면에서도 흐려지지 않도록 실제 노출 크기(440×495px)의 2배 이상 권장 */}
        <div className="flex-shrink-0" style={{ width: "160px" }}>
          <ImageField
            label="섹션 이미지"
            hint="880 × 990px 이상 권장"
            value={banner.image_url}
            onChange={(url) => onChange({ image_url: url })}
            compact
            aspectRatio="8/9"
          />
          <p className="mt-2 text-[11px] text-gray-500 leading-relaxed">
            이미지 배치 후 ChatGPT로 기획 이미지 생성
          </p>
        </div>

        {/* 우: 연결상품 3개 탭 */}
        <div className="flex-1 min-w-0">
          {/* 탭 바 — 좌측 정렬, 자연 너비 */}
          <div className="flex border border-gray-200 rounded-t-xl overflow-hidden">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                onClick={() => setItemTab(i)}
                className={`px-5 py-2.5 text-sm font-semibold transition-colors border-r last:border-r-0 border-gray-200 text-left whitespace-nowrap ${
                  itemTab === i
                    ? "bg-[#303236] text-white"
                    : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                }`}
              >
                상품{i + 1}
                {items3[i].name && (
                  <span className={`ml-1.5 text-[10px] font-normal ${itemTab === i ? "text-white/70" : "text-gray-400"}`}>
                    · {items3[i].name}
                  </span>
                )}
              </button>
            ))}
          </div>
          {/* 탭 콘텐츠 */}
          <div className="border border-t-0 border-gray-200 rounded-b-xl p-4">
            <SlotItemEditor
              key={itemTab}
              item={items3[itemTab]}
              onChange={(patch) => updateItem(itemTab, patch)}
            />
          </div>
        </div>
      </div>

      </>
      )}
    </div>
  );
}


// ── 서브 컴포넌트: 메인 기획전 에디터 ──────────────────────
function HeroEditor({ hero, onChange, products }: {
  hero: EditorialBlock["hero"];
  onChange: (patch: Partial<EditorialBlock["hero"]>) => void;
  products: SearchProduct[];
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [posView, setPosView] = useState<"pc" | "mobile">("pc");
  const [isDraggingPos, setIsDraggingPos] = useState(false);
  const imgAreaRef = useRef<HTMLDivElement>(null);
  const posPreviewRef = useRef<HTMLDivElement>(null);
  const wasDraggingRef = useRef(false);
  const posDragRef = useRef<{ startX: number; startY: number; startPx: number; startPy: number } | null>(null);

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (wasDraggingRef.current) { wasDraggingRef.current = false; return; }
    if (!hero.image_url) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    if (posView === "mobile") {
      const newTag: HeroTag = { id: uid(), x, y, name: "", price: "", product_id: "", image_url: "", bg: "#303236" };
      const next = [...hero.tags, newTag];
      onChange({ tags: next });
      setSelectedIdx(next.length - 1);
    } else {
      // PC 뷰: 선택된 태그(없으면 마지막)의 PC 좌표 업데이트
      const idx = selectedIdx !== null ? selectedIdx : hero.tags.length - 1;
      if (idx >= 0) updateTag(idx, { pc_x: x, pc_y: y });
    }
  }

  function handleTagPointerDown(e: React.PointerEvent<HTMLButtonElement>, idx: number) {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    wasDraggingRef.current = false;
    setDraggingIdx(idx);
    setSelectedIdx(idx);
  }

  function handleTagPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (draggingIdx === null || !imgAreaRef.current) return;
    wasDraggingRef.current = true;
    const rect = imgAreaRef.current.getBoundingClientRect();
    const x = Math.round(Math.min(99, Math.max(1, ((e.clientX - rect.left) / rect.width) * 100)));
    const y = Math.round(Math.min(99, Math.max(1, ((e.clientY - rect.top) / rect.height) * 100)));
    if (posView === "mobile") {
      updateTag(draggingIdx, { x, y });
    } else {
      updateTag(draggingIdx, { pc_x: x, pc_y: y });
    }
  }

  function handleTagPointerUp() {
    setDraggingIdx(null);
  }

  function updateTag(idx: number, patch: Partial<HeroTag>) {
    const next = [...hero.tags];
    next[idx] = { ...next[idx], ...patch };
    onChange({ tags: next });
  }

  function deleteTag(idx: number) {
    onChange({ tags: hero.tags.filter((_, i) => i !== idx) });
    setSelectedIdx(null);
  }

  const selectedTag = selectedIdx !== null ? hero.tags[selectedIdx] : null;

  // ── 이미지 위치/스케일 파싱 ──────────────────────────────────
  const pcPos = (hero.image_position ?? "50% 0%").split(" ");
  const pcPx = parseInt(pcPos[0]) || 50;
  const pcPy = parseInt(pcPos[1]) || 0;
  const mobilePos = (hero.image_position_mobile ?? "50% 50%").split(" ");
  const mobilePx = parseInt(mobilePos[0]) || 50;
  const mobilePy = parseInt(mobilePos[1]) || 50;
  const pcScale = hero.image_scale ?? 1.0;
  const mobileScale = hero.image_scale_mobile ?? 1.0;
  const currPx = posView === "pc" ? pcPx : mobilePx;
  const currPy = posView === "pc" ? pcPy : mobilePy;
  const currScale = posView === "pc" ? pcScale : mobileScale;

  function handlePosDragStart(e: React.PointerEvent<HTMLDivElement>) {
    if (!hero.image_url) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    posDragRef.current = { startX: e.clientX, startY: e.clientY, startPx: currPx, startPy: currPy };
    setIsDraggingPos(true);
  }

  function handlePosDragMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!posDragRef.current || !posPreviewRef.current) return;
    const rect = posPreviewRef.current.getBoundingClientRect();
    const dx = e.clientX - posDragRef.current.startX;
    const dy = e.clientY - posDragRef.current.startY;
    const newPx = Math.round(Math.min(100, Math.max(0, posDragRef.current.startPx - (dx / rect.width) * 100)));
    const newPy = Math.round(Math.min(100, Math.max(0, posDragRef.current.startPy - (dy / rect.height) * 100)));
    const posStr = `${newPx}% ${newPy}%`;
    if (posView === "pc") onChange({ image_position: posStr });
    else onChange({ image_position_mobile: posStr });
  }

  function handlePosDragEnd() {
    setIsDraggingPos(false);
    posDragRef.current = null;
  }

  return (
    <div className="space-y-4">
      {/* ── 3-column (대표이미지 | 위치·크기 | 상품태그) ── */}
      <div className="flex gap-3 items-start">

        {/* Col 1: 대표 이미지 (compact, 3:4) */}
        <div className="flex-shrink-0" style={{ width: "130px" }}>
          <ImageField
            label="대표 이미지 (모바일 · 3:4)"
            hint="모바일용: 950 × 1280px (3:4) — PC는 패널 전체를 채우도록 크롭"
            value={hero.image_url}
            onChange={(url) => { onChange({ image_url: url }); setSelectedIdx(null); }}
            compact
          />
        </div>

        {/* Col 2: 이미지 위치 / 스케일 컨트롤 */}
        {!hero.image_url && (
          <div className="flex-shrink-0 flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-[11px] text-gray-400" style={{ width: "200px", minHeight: "200px" }}>
            이미지를 업로드하면<br/>위치·크기 조절 가능
          </div>
        )}
        {hero.image_url && (
          <div className="flex-shrink-0 space-y-2" style={{ width: "200px" }}>
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-gray-700">이미지 위치·크기</label>
              <button type="button"
                onClick={() => {
                  if (posView === "pc") onChange({ image_position: "50% 0%", image_scale: 1.0 });
                  else onChange({ image_position_mobile: "50% 50%", image_scale_mobile: 1.0 });
                }}
                className="text-[10px] text-gray-400 hover:text-gray-600">초기화</button>
            </div>
            {/* PC / 모바일 탭 */}
            <div className="flex gap-1">
              {(["pc", "mobile"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setPosView(v)}
                  className={`flex-1 text-[10px] font-semibold py-1 rounded border transition-colors ${
                    posView === v
                      ? (v === "pc" ? "bg-indigo-600 text-white border-indigo-600" : "bg-[#303236] text-white border-[#303236]")
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                  }`}>
                  {v === "pc" ? "🖥️ PC" : "📱 모바일"}
                </button>
              ))}
            </div>
            {/* 드래그 미리보기 */}
            <div
              ref={posPreviewRef}
              onPointerDown={handlePosDragStart}
              onPointerMove={handlePosDragMove}
              onPointerUp={handlePosDragEnd}
              className="relative overflow-hidden rounded-lg border border-gray-200 select-none"
              style={{
                aspectRatio: posView === "pc" ? "8/9" : "3/4",
                cursor: isDraggingPos ? "grabbing" : "grab",
                touchAction: "none",
              }}
            >
              <img
                src={hero.image_url} alt=""
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                style={{
                  objectPosition: `${currPx}% ${currPy}%`,
                  ...(currScale !== 1.0 ? { transform: `scale(${currScale})`, transformOrigin: `${currPx}% ${currPy}%` } : {}),
                }}
              />
              {/* 태그 도트 오버레이 — 실시간 반영 */}
              {hero.tags.map((tag) => {
                const tx = posView === "mobile" ? tag.x : (tag.pc_x ?? tag.x);
                const ty = posView === "mobile" ? tag.y : (tag.pc_y ?? tag.y);
                return (
                  <div key={tag.id}
                    className="absolute rounded-full bg-white/80 border-2 border-orange-400 pointer-events-none"
                    style={{ width: "10px", height: "10px", left: `${tx}%`, top: `${ty}%`, transform: "translate(-50%,-50%)" }} />
                );
              })}
              <div className="absolute bottom-1 left-1 text-[7px] text-white bg-black/40 px-1 rounded pointer-events-none">드래그로 이동</div>
              <div className="absolute top-1 right-1 text-[7px] text-white bg-black/40 px-1 rounded pointer-events-none">{currPx}%·{currPy}%</div>
            </div>
            {/* 스케일 슬라이더 */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] text-gray-500">확대/축소</span>
                <span className="text-[11px] text-gray-400 font-mono">{Math.round(currScale * 100)}%</span>
              </div>
              <input type="range" min={80} max={200} step={5}
                value={Math.round(currScale * 100)}
                onChange={(e) => {
                  const scale = parseInt(e.target.value) / 100;
                  if (posView === "pc") onChange({ image_scale: scale });
                  else onChange({ image_scale_mobile: scale });
                }}
                className="w-full h-1.5 accent-[#303236] cursor-pointer" />
              <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                <span>80%</span><span>원본</span><span>200%</span>
              </div>
            </div>
          </div>
        )}

        {/* Col 3: 상품 태그 에디터 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <label className="text-xs font-medium text-gray-700">상품 태그 ({hero.tags.length}개)</label>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {hero.image_url ? "이미지 클릭 → 태그 추가 · 드래그 → 위치 이동" : "이미지 업로드 후 클릭으로 태그 추가"}
              </p>
            </div>
            {hero.tags.length > 0 && (
              <button
                onClick={() => { onChange({ tags: [] }); setSelectedIdx(null); }}
                className="text-[11px] text-red-400 hover:text-red-600"
              >전체 삭제</button>
            )}
          </div>

          <div className="flex gap-3">
            {/* 태그 이미지 클릭 영역 */}
            <div className="flex-shrink-0" style={{ width: "200px" }}>
            <div
              ref={imgAreaRef}
              onClick={handleImageClick}
              className="relative rounded-xl overflow-hidden select-none border border-gray-200"
              style={{
                width: "200px",
                aspectRatio: posView === "mobile" ? "3 / 4" : "8 / 9",
                background: "#d1d5db",
                cursor: draggingIdx !== null ? "grabbing" : (hero.image_url ? "crosshair" : "default"),
              }}
            >
              {hero.image_url && (
                <img
                  src={hero.image_url}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                  style={posView === "pc"
                    ? { objectPosition: `${pcPx}% ${pcPy}%`, ...(pcScale !== 1.0 ? { transform: `scale(${pcScale})`, transformOrigin: `${pcPx}% ${pcPy}%` } : {}) }
                    : { objectPosition: `${mobilePx}% ${mobilePy}%`, ...(mobileScale !== 1.0 ? { transform: `scale(${mobileScale})`, transformOrigin: `${mobilePx}% ${mobilePy}%` } : {}) }
                  }
                />
              )}

              {!hero.image_url && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                  <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" />
                  </svg>
                  <p className="text-white/50 text-xs text-center px-3 leading-snug">이미지 업로드 후<br/>클릭하여 태그 추가</p>
                </div>
              )}

              {hero.tags.map((tag, idx) => {
                const tagX = posView === "mobile" ? tag.x : (tag.pc_x ?? tag.x);
                const tagY = posView === "mobile" ? tag.y : (tag.pc_y ?? tag.y);
                return (
                  <button
                    key={tag.id}
                    onPointerDown={(e) => handleTagPointerDown(e, idx)}
                    onPointerMove={handleTagPointerMove}
                    onPointerUp={handleTagPointerUp}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!wasDraggingRef.current) setSelectedIdx(selectedIdx === idx ? null : idx);
                    }}
                    className="absolute"
                    style={{
                      left: `${tagX}%`, top: `${tagY}%`, transform: "translate(-50%, -50%)",
                      cursor: draggingIdx === idx ? "grabbing" : "grab",
                      touchAction: "none",
                    }}
                    title={tag.name || `태그 ${idx + 1} (드래그로 이동)`}
                  >
                    <span className={`flex items-center justify-center rounded-full transition-all duration-150 ${
                      selectedIdx === idx
                        ? "w-6 h-6 bg-[#E5541B]/90 border-2 border-white shadow-lg"
                        : "w-4 h-4 bg-white/80 border-2 border-white shadow-md hover:w-5 hover:h-5"
                    }`}>
                      <span className="text-[8px] font-bold text-[#303236]">{idx + 1}</span>
                    </span>
                  </button>
                );
              })}

              <div className="absolute inset-0 pointer-events-none opacity-10"
                style={{ backgroundImage: "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)", backgroundSize: "25% 25%" }} />
            </div>
            {posView === "pc" && hero.image_url && (
              <p className="text-[10px] text-indigo-500 mt-1.5 leading-snug">
                클릭: 선택된 태그의 PC 위치 설정<br/>태그가 없으면 모바일 탭에서 먼저 추가하세요
              </p>
            )}
          </div>

          {/* 오른쪽: 태그 칩 + 선택된 태그 편집 */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* 태그 칩 목록 */}
            {hero.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {hero.tags.map((tag, idx) => (
                  <button
                    key={tag.id}
                    onClick={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-colors ${
                      selectedIdx === idx
                        ? "bg-[#E5541B] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: "currentColor", opacity: 0.3 }}>{idx + 1}</span>
                    {tag.name || "이름 미입력"}
                  </button>
                ))}
              </div>
            )}

            {/* 선택된 태그 편집 */}
            {selectedTag !== null && selectedIdx !== null && (
              <div className="border-2 border-[#E5541B]/30 rounded-xl p-3 bg-orange-50/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#E5541B]">태그 {selectedIdx + 1} 편집</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-400">
                      📱 {selectedTag.x}%,{selectedTag.y}%
                      {(selectedTag.pc_x !== undefined || selectedTag.pc_y !== undefined) && (
                        <> · 🖥️ {selectedTag.pc_x ?? selectedTag.x}%,{selectedTag.pc_y ?? selectedTag.y}%</>
                      )}
                    </span>
                    <button onClick={() => deleteTag(selectedIdx)}
                      className="text-[11px] text-red-500 hover:text-red-700 font-medium">삭제</button>
                  </div>
                </div>
                {/* 제품 검색 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">제품 검색</label>
                  <ProductPicker
                    products={products}
                    value={selectedTag.name}
                    onSelect={(p) => updateTag(selectedIdx, {
                      product_id: p.id, name: p.name, price: p.price, image_url: p.imageUrl ?? "",
                    })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="상품명 (직접 수정)" value={selectedTag.name}
                    onChange={(v) => updateTag(selectedIdx, { name: v })} placeholder="쿨링 반팔 티셔츠" />
                  <Field label="가격" value={selectedTag.price}
                    onChange={(v) => updateTag(selectedIdx, { price: v })} placeholder="19,000원" />
                  {selectedTag.image_url && (
                    <div className="col-span-2 flex items-center gap-2">
                      <img src={selectedTag.image_url} alt="" className="w-10 h-10 object-cover rounded border border-orange-200 flex-shrink-0" />
                      <span className="text-[10px] text-gray-400 truncate">선택된 이미지</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 태그가 없고 이미지도 없을 때 */}
            {!hero.image_url && hero.tags.length === 0 && (
              <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-[12px] text-gray-400"
                style={{ minHeight: "120px" }}>
                이미지를 업로드하면<br />클릭으로 태그 추가 가능
              </div>
            )}

            {/* 이미지는 있지만 태그가 없을 때 */}
            {hero.image_url && hero.tags.length === 0 && !selectedTag && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-blue-400 text-lg">👆</span>
                <p className="text-[12px] text-blue-600">왼쪽 이미지를 클릭하면 태그가 추가됩니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}

// ── 서브 컴포넌트: 블록 카드 ────────────────────────────────
function BlockCard({
  block, index, total, products,
  onUpdate, onDelete, onMove, alwaysOpen,
}: {
  block: EditorialBlock;
  index: number;
  total: number;
  products: SearchProduct[];
  onUpdate: (patch: Partial<EditorialBlock>) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  alwaysOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"hero" | "banner1" | "banner2" | "banner3" | "banner4">("hero");
  const isOpen = alwaysOpen || open;

  const TABS = [
    { key: "hero" as const,    label: "메인 기획전" },
    { key: "banner1" as const, label: "배너 1" },
    { key: "banner2" as const, label: "배너 2" },
    { key: "banner3" as const, label: "배너 3" },
    { key: "banner4" as const, label: "배너 4" },
  ];

  return (
    <div className={`border rounded-xl overflow-hidden ${isOpen ? "border-[#303236]/30 shadow-sm" : "border-gray-200"}`}>
      {/* 블록 헤더 — 아코디언 모드에서만 표시 */}
      {!alwaysOpen && (
      <div className={`flex items-center gap-3 px-5 py-4 ${isOpen ? "bg-[#f5f7ff] border-b border-[#303236]/10" : "bg-white hover:bg-gray-50"} transition-colors`}>
        {/* 순서 이동 */}
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button onClick={() => onMove(-1)} disabled={index === 0}
            className="w-5 h-4 flex items-center justify-center rounded hover:bg-gray-200 disabled:opacity-30 text-gray-500 text-[10px]">▲</button>
          <button onClick={() => onMove(1)} disabled={index === total - 1}
            className="w-5 h-4 flex items-center justify-center rounded hover:bg-gray-200 disabled:opacity-30 text-gray-500 text-[10px]">▼</button>
        </div>

        {/* 번호 */}
        <span className="text-xs font-bold text-gray-400 w-5 flex-shrink-0">#{index + 1}</span>

        {/* 제목 */}
        <button className="flex-1 text-left min-w-0" onClick={() => setOpen((v) => !v)}>
          <p className="text-sm font-semibold text-[#303236] truncate">
            {block.hero.title || "제목 없음"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {block.reversed ? "우측 메인 기획전" : "좌측 메인 기획전"} · {block.type === "image" ? "이미지형" : "상품형"}
          </p>
        </button>

        {/* 이미지 미리보기 썸네일 */}
        <div className="flex gap-1.5 flex-shrink-0">
          {[
            { url: block.hero.image_url,    label: "메인",  bg: block.hero.bg_color },
            { url: block.banner1.image_url, label: "B1", bg: block.banner1.section_bg },
            { url: block.banner2.image_url, label: "B2", bg: block.banner2.section_bg },
            { url: block.banner3.image_url, label: "B3", bg: block.banner3.section_bg },
            { url: block.banner4.image_url, label: "B4", bg: block.banner4.section_bg },
          ].map(({ url, label, bg }) => (
            <div
              key={label}
              className="relative rounded-lg overflow-hidden flex-shrink-0 border border-gray-200"
              style={{ width: "34px", aspectRatio: "3/4", background: bg }}
            >
              {url && (
                <img src={url} alt={label} draggable={false}
                  className="absolute inset-0 w-full h-full object-cover" />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-black/30 flex justify-center py-0.5">
                <span className="text-[7px] text-white font-medium leading-none">{label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 노출 토글 */}
        <button
          onClick={() => onUpdate({ is_visible: !block.is_visible })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
            block.is_visible ? "bg-[#303236]" : "bg-gray-300"
          }`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            block.is_visible ? "translate-x-[18px]" : "translate-x-0.5"
          }`} />
        </button>

        {/* 삭제 */}
        <button onClick={onDelete}
          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 열기/닫기 화살표 */}
        <button onClick={() => setOpen((v) => !v)}
          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-lg flex-shrink-0">
          <svg className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      )}

      {/* 편집 패널 */}
      {isOpen && (
        <div className="bg-white">
          {/* 기본 설정 바 */}
          <div className="flex items-center gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100">
            {/* 레이아웃 */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-gray-500">레이아웃</span>
              <div className="flex rounded-lg overflow-hidden border border-gray-200">
                {(["normal", "reversed"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => onUpdate({ reversed: v === "reversed" })}
                    className={`text-xs px-3 py-1.5 transition-colors ${
                      (v === "reversed") === block.reversed
                        ? "bg-[#303236] text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {v === "normal" ? "좌측 메인" : "우측 메인"}
                  </button>
                ))}
              </div>
            </div>
            {/* 제목 */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-xs text-gray-500 flex-shrink-0">제목</span>
              <input
                type="text"
                value={block.hero.title}
                onChange={(e) => onUpdate({ hero: { ...block.hero, title: e.target.value } })}
                placeholder="UV 대책 특집"
                className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-[#303236]"
              />
            </div>
            {/* 부제목 */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-xs text-gray-500 flex-shrink-0">부제목</span>
              <input
                type="text"
                value={block.hero.subtitle}
                onChange={(e) => onUpdate({ hero: { ...block.hero, subtitle: e.target.value, hero_subtitle: e.target.value } })}
                placeholder="이미지 위 작은 문구"
                className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-[#303236]"
              />
            </div>
          </div>

          {/* 탭 */}
          <div className="flex border-b border-gray-100">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? "text-[#303236] border-b-2 border-[#303236]"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 탭 콘텐츠 */}
          <div className="p-5">
            {tab === "hero" && (
              <HeroEditor
                hero={block.hero}
                onChange={(patch) => onUpdate({ hero: { ...block.hero, ...patch } })}
                products={products}
              />
            )}
            {tab === "banner1" && (
              <BannerEditor
                label="우측 배너 1"
                banner={block.banner1}
                onChange={(patch) => onUpdate({ banner1: { ...block.banner1, ...patch } })}
                products={products}
              />
            )}
            {tab === "banner2" && (
              <BannerEditor
                label="우측 배너 2"
                banner={block.banner2}
                onChange={(patch) => onUpdate({ banner2: { ...block.banner2, ...patch } })}
                products={products}
              />
            )}
            {tab === "banner3" && (
              <BannerEditor
                label="우측 배너 3"
                banner={block.banner3}
                onChange={(patch) => onUpdate({ banner3: { ...block.banner3, ...patch } })}
                products={products}
              />
            )}
            {tab === "banner4" && (
              <BannerEditor
                label="우측 배너 4"
                banner={block.banner4}
                onChange={(patch) => onUpdate({ banner4: { ...block.banner4, ...patch } })}
                products={products}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────
export default function AdminMainEditorialPage() {
  const [blocks, setBlocks] = useState<EditorialBlock[]>(createDefaultBlocks);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<"ok" | "err" | null>(null);
  const [dbError, setDbError] = useState(false);
  const [products, setProducts] = useState<SearchProduct[]>([]);

  // 제품 목록 1회 로드
  useEffect(() => {
    fetch("/api/admin/products")
      .then((r) => r.ok ? r.json() : [])
      .then((data: { id: string; name: string; price: string; imageUrl?: string }[]) => {
        if (Array.isArray(data)) {
          setProducts(data.map((p) => ({ id: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl })));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/admin/site-settings/editorial_blocks")
      .then((r) => {
        if (!r.ok) { setDbError(true); return null; }
        return r.json();
      })
      .then((data) => {
        if (data?.blocks?.length) {
          setBlocks(data.blocks.map((b: EditorialBlock) => ({
            ...b,
            banner3: b.banner3 ?? emptyBanner(),
            banner4: b.banner4 ?? emptyBanner(),
          })));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setSaveMsg(null);
    const res = await fetch("/api/admin/site-settings/editorial_blocks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });
    setSaving(false);
    setSaveMsg(res.ok ? "ok" : "err");
    setTimeout(() => setSaveMsg(null), 2500);
  }

  function updateBlock(id: string, patch: Partial<EditorialBlock>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }
  function deleteBlock(id: string) {
    if (!confirm("이 블록을 삭제하시겠습니까?")) return;
    setBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      setActiveIdx((i) => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
  }
  function moveBlock(index: number, dir: -1 | 1) {
    const next = [...blocks];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next.map((b, i) => ({ ...b, sort_order: i })));
  }
  function addBlock() {
    const b = emptyBlock(blocks.length);
    setBlocks((prev) => { setActiveIdx(prev.length); return [...prev, b]; });
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">불러오는 중...</div>;
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">기획전 영역</h1>
          <p className="text-base text-gray-400 mt-1">
            메인 에디토리얼 블록을 관리합니다. 블록은 순서대로 메인에 표시됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/main/editorial/list"
            className="px-5 py-2.5 border border-gray-300 text-gray-600 text-sm font-semibold rounded hover:bg-gray-50 transition-colors"
          >
            목록 보기
          </Link>
          <button
            onClick={save}
            disabled={saving}
            className="px-6 py-2.5 bg-[#303236] text-white text-sm font-semibold rounded hover:bg-[#243d6a] disabled:opacity-50 transition-colors"
          >
            {saving ? "저장 중..." : "전체 저장"}
          </button>
        </div>
      </div>

      {saveMsg === "ok" && (
        <div className="mb-4 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          저장되었습니다.
        </div>
      )}
      {saveMsg === "err" && (
        <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          저장에 실패했습니다. 다시 시도해 주세요.
        </div>
      )}

      {/* 블록 탭 */}
      {blocks.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl mb-4">
          등록된 기획전 블록이 없습니다.
        </div>
      ) : (
        <>
          {/* 탭 바 */}
          <div className="flex items-stretch gap-0 border-b border-gray-200 mb-0 overflow-x-auto">
            {blocks.map((block, index) => (
              <div key={block.id} className="relative flex-shrink-0 group flex items-stretch">
                <button
                  onClick={() => setActiveIdx(index)}
                  className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeIdx === index
                      ? "text-[#303236] border-[#303236] bg-[#f5f7ff]"
                      : "text-gray-500 border-transparent hover:text-[#303236] hover:bg-gray-50"
                  }`}
                >
                  <span className="text-[10px] text-gray-400 mr-1">#{index + 1}</span>
                  {block.hero.title || "제목 없음"}
                  {/* 노출 상태 dot */}
                  <span className={`ml-1.5 inline-block w-1.5 h-1.5 rounded-full ${block.is_visible ? "bg-green-400" : "bg-gray-300"}`} />
                </button>
                {/* 탭 내 삭제 버튼 */}
                <button
                  onClick={() => deleteBlock(block.id)}
                  className="opacity-0 group-hover:opacity-100 self-center -ml-2 mr-1 w-4 h-4 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all text-[10px] flex-shrink-0"
                  title="블록 삭제"
                >×</button>
              </div>
            ))}
            {/* + 추가 버튼 */}
            <button
              onClick={addBlock}
              className="px-4 py-3 text-sm text-gray-400 hover:text-[#303236] border-b-2 border-transparent hover:border-[#303236] transition-colors flex-shrink-0 whitespace-nowrap"
            >+ 추가</button>
          </div>

          {/* 선택된 블록 에디터 */}
          {blocks[activeIdx] && (
            <BlockCard
              key={blocks[activeIdx].id}
              products={products}
              block={blocks[activeIdx]}
              index={activeIdx}
              total={blocks.length}
              onUpdate={(patch) => updateBlock(blocks[activeIdx].id, patch)}
              onDelete={() => deleteBlock(blocks[activeIdx].id)}
              onMove={(dir) => moveBlock(activeIdx, dir)}
              alwaysOpen
            />
          )}
        </>
      )}

      {/* DB 오류 안내 */}
      {dbError && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ Supabase 설정 필요</p>
          <p className="text-xs text-amber-700">
            저장 기능을 사용하려면 <code className="bg-amber-100 px-1 rounded">site_settings</code> 테이블이 필요합니다.
          </p>
        </div>
      )}
    </div>
  );
}
