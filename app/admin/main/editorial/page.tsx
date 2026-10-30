"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { HERO_PANEL_WIDTH_RATIO, heroPanelHeight } from "@/lib/heroPanel";
import {
  type Banner, type HeroTag, type ProductItem, type SearchProduct,
  emptyBanner, uid,
  ProductPicker, ImageField, Field, BannerEditor,
} from "@/components/admin/editorial/BannerEditor";


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
    image_url_pc?: string;   // 없으면 image_url을 PC에서도 그대로 사용 (하위호환)
    image_position?: string;
    image_position_mobile?: string;
    image_scale?: number;
    image_scale_mobile?: number;
    bg_color: string;
    tags: HeroTag[];
    detail?: Banner;   // 메인 기획전 상세페이지(서브 배너와 같은 구조) — 이미지에 태그한 제품들
  };
  banner1: Banner;
  banner2: Banner;
  banner3: Banner;
  banner4: Banner;
};


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


// ── 서브 컴포넌트: 메인 기획전 에디터 ──────────────────────
// 확대/축소 기능은 제거했다(공개 렌더러도 스케일은 애초에 반영하지 않았다).
// 이미지 위치(크롭 기준점) 드래그 조정만 남기고 미리보기를 크게 키웠다. 제품 태그는 HeroTagEditor가 담당.
function HeroEditor({ hero, onChange, products }: {
  hero: EditorialBlock["hero"];
  onChange: (patch: Partial<EditorialBlock["hero"]>) => void;
  products: SearchProduct[];
}) {
  const [posView, setPosView] = useState<"pc" | "mobile">("pc");
  // 실제 PC 히어로 패널은 "화면 폭의 약 절반 × 화면 높이"(FeatureHeroLayout)라 object-cover로 아래가 잘린다.
  // 미리보기도 현재 브라우저 창 기준 같은 비율로 맞춰, 보이는 그대로 노출 위치를 조정하게 한다.
  const [pcPanelRatio, setPcPanelRatio] = useState("1/1");
  const [pcRatioNum, setPcRatioNum] = useState(1);
  useEffect(() => {
    const update = () => {
      const w = document.documentElement.clientWidth;
      const pw = w * HERO_PANEL_WIDTH_RATIO;
      const ph = heroPanelHeight(w, window.innerHeight);
      setPcPanelRatio(`${pw} / ${ph}`);
      setPcRatioNum(pw / ph);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  // 미리보기 편집 모드: 이미지 위치(드래그로 크롭 이동) / 제품 태그(클릭 추가·드래그 이동)
  const [editMode, setEditMode] = useState<"position" | "tag">("position");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const wasDraggingRef = useRef(false);
  const tags = hero.tags ?? [];
  const setTags = (next: HeroTag[]) => onChange({ tags: next });
  const tagXY = (t: HeroTag) => (posView === "pc" ? { x: t.pc_x ?? t.x, y: t.pc_y ?? t.y } : { x: t.x, y: t.y });
  // PC 태그 좌표는 사이트(PcTagLayer)와 같이 "이미지 자체" 기준 %다. 미리보기는 크롭(cover)된 박스라
  // 박스 % ↔ 이미지 % 를 환산한다. (모바일은 3:4 박스에 이미지가 꽉 차므로 환산 불필요)
  const pcImageUrl = hero.image_url_pc || hero.image_url;
  const [pcNat, setPcNat] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!pcImageUrl) { setPcNat(null); return; }
    const img = new window.Image();
    img.onload = () => setPcNat({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = pcImageUrl;
  }, [pcImageUrl]);
  // 박스를 너비 1 × 높이 1/ratio 로 정규화한 cover 배치
  const pcGeom = () => {
    if (!pcNat || !pcNat.w) return null;
    const bh = 1 / pcRatioNum;
    const scale = Math.max(1 / pcNat.w, bh / pcNat.h);
    const rw = pcNat.w * scale, rh = pcNat.h * scale;
    return { bh, rw, rh, offX: (1 - rw) * (pcPx / 100), offY: (bh - rh) * (pcPy / 100) };
  };
  const imgToBox = (x: number, y: number) => {
    const g = posView === "pc" ? pcGeom() : null;
    if (!g) return { x, y };
    return { x: ((g.offX + (g.rw * x) / 100) / 1) * 100, y: ((g.offY + (g.rh * y) / 100) / g.bh) * 100 };
  };
  const boxToImg = (bx: number, by: number) => {
    const g = posView === "pc" ? pcGeom() : null;
    if (!g) return { x: bx, y: by };
    return { x: ((bx / 100 - g.offX) / g.rw) * 100, y: ((by / 100) * g.bh - g.offY) / g.rh * 100 };
  };
  const pctOf = (e: { clientX: number; clientY: number }, min: number, max: number) => {
    const rect = posPreviewRef.current!.getBoundingClientRect();
    const b = boxToImg(((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100);
    return {
      x: Math.round(Math.min(max, Math.max(min, b.x))),
      y: Math.round(Math.min(max, Math.max(min, b.y))),
    };
  };
  const updateTag = (idx: number, patch: Partial<HeroTag>) => setTags(tags.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  function handleTagAreaClick(e: React.MouseEvent<HTMLDivElement>) {
    if (editMode !== "tag" || !hero.image_url) return;
    if (wasDraggingRef.current) { wasDraggingRef.current = false; return; }
    const { x, y } = pctOf(e, 0, 100);
    const next = [...tags, { id: uid(), x, y, pc_x: x, pc_y: y, name: "", price: "", product_id: "", image_url: "", bg: "#303236" }];
    setTags(next);
    setSelectedIdx(next.length - 1);
  }
  function handleTagMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (draggingIdx === null || !posPreviewRef.current) return;
    wasDraggingRef.current = true;
    const { x, y } = pctOf(e, 1, 99);
    updateTag(draggingIdx, posView === "pc" ? { pc_x: x, pc_y: y } : { x, y });
  }
  const selectedTag = selectedIdx !== null ? tags[selectedIdx] : null;
  const [isDraggingPos, setIsDraggingPos] = useState(false);
  const posPreviewRef = useRef<HTMLDivElement>(null);
  const posDragRef = useRef<{ startX: number; startY: number; startPx: number; startPy: number } | null>(null);

  const pcPos = (hero.image_position ?? "50% 0%").split(" ");
  const pcPx = parseInt(pcPos[0]) || 50;
  const pcPy = parseInt(pcPos[1]) || 0;
  const mobilePos = (hero.image_position_mobile ?? "50% 50%").split(" ");
  const mobilePx = parseInt(mobilePos[0]) || 50;
  const mobilePy = parseInt(mobilePos[1]) || 50;
  const currPx = posView === "pc" ? pcPx : mobilePx;
  const currPy = posView === "pc" ? pcPy : mobilePy;

  function handlePosDragStart(e: React.PointerEvent<HTMLDivElement>) {
    if (!hero.image_url || editMode !== "position") return;
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
    <div className="flex gap-4 items-start">

      {/* 이미지 업로드 */}
      <div className="flex-shrink-0 space-y-2" style={{ width: "180px" }}>
        <ImageField
          label="모바일 이미지"
          hint="950 × 1280px (3:4)"
          value={hero.image_url}
          onChange={(url) => onChange({ image_url: url })}
          compact
        />
        <label className="flex items-center gap-1.5 text-[10px] text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={!!hero.image_url_pc}
            onChange={(e) => onChange({ image_url_pc: e.target.checked ? (hero.image_url_pc || hero.image_url) : "" })}
          />
          PC 이미지 다르게 등록
        </label>
        <p className="text-[10px] text-gray-400 leading-snug">
          PC 화면은 가로형 패널(약 10:11~8:9)이라 모바일용 3:4 세로 이미지를 쓰면 위·아래가 잘립니다.
          안 잘리게 하려면 PC 이미지를 <b className="text-gray-600">1600 × 1800px (8:9)</b>로 따로 등록하세요.
        </p>
        {!!hero.image_url_pc && (
          <ImageField
            label="PC 이미지"
            hint="1600 × 1800px (8:9) 권장 — 인물 전신은 하단 여백을 두고 중앙에 배치"
            value={hero.image_url_pc}
            onChange={(url) => onChange({ image_url_pc: url })}
            compact
          />
        )}
      </div>

      {/* 이미지 위치 조정 */}
      {!hero.image_url && (
        <div className="flex-1 flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-[12px] text-gray-400" style={{ minHeight: "260px" }}>
          이미지를 업로드하면 위치 조절 가능
        </div>
      )}
      {hero.image_url && (
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {(["pc", "mobile"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setPosView(v)}
                  className={`text-[11px] font-semibold px-3 py-1 rounded border transition-colors ${
                    posView === v
                      ? (v === "pc" ? "bg-indigo-600 text-white border-indigo-600" : "bg-[#303236] text-white border-[#303236]")
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                  }`}>
                  {v === "pc" ? "🖥️ PC" : "📱 모바일"}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {([["position", "↔ 이미지 위치"], ["tag", "📍 제품 태그"]] as const).map(([m, label]) => (
                <button key={m} type="button" onClick={() => setEditMode(m)}
                  className={`text-[11px] font-semibold px-3 py-1 rounded border transition-colors ${
                    editMode === m ? "bg-[#E5541B] text-white border-[#E5541B]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                  }`}>{label}</button>
              ))}
            </div>
            {editMode === "position" ? (
              <button type="button"
                onClick={() => {
                  if (posView === "pc") onChange({ image_position: "50% 0%" });
                  else onChange({ image_position_mobile: "50% 50%" });
                }}
                className="text-[11px] text-gray-400 hover:text-gray-600">위치 초기화</button>
            ) : (
              tags.length > 0 ? (
                <button type="button" onClick={() => { setTags([]); setSelectedIdx(null); }}
                  className="text-[11px] text-red-400 hover:text-red-600">태그 전체 삭제</button>
              ) : <span />
            )}
          </div>
          <p className="text-[10px] text-gray-400">
            {editMode === "position"
              ? "이미지를 드래그해 노출 위치를 조정합니다."
              : posView === "pc"
              ? "이미지를 클릭하면 태그가 추가되고, 드래그하면 위치가 이동합니다. (PC 전용 위치)"
              : "모바일·태블릿은 태그가 이미지 오른쪽 아래에 목록으로 자동 정렬됩니다. 위치 조정 없이 PC에서 추가한 태그 순서대로 나옵니다."}
          </p>
          <div
            ref={posPreviewRef}
            onPointerDown={handlePosDragStart}
            onPointerMove={handlePosDragMove}
            onPointerUp={handlePosDragEnd}
            onClick={handleTagAreaClick}
            className="relative overflow-hidden rounded-lg border border-gray-200 select-none mx-auto"
            style={{
              aspectRatio: posView === "pc" ? pcPanelRatio : "3/4",
              maxWidth: posView === "pc" ? 480 : 380,
              cursor: editMode === "tag" ? "crosshair" : (isDraggingPos ? "grabbing" : "grab"),
              touchAction: "none",
            }}
          >
            <img
              src={posView === "pc" ? (hero.image_url_pc || hero.image_url) : hero.image_url} alt=""
              draggable={false}
              className={`absolute inset-0 w-full h-full pointer-events-none select-none ${editMode === "tag" && posView === "mobile" ? "object-contain" : "object-cover"}`}
              style={{ objectPosition: `${currPx}% ${currPy}%` }}
            />
            {editMode === "tag" && tags.map((tag, idx) => {
              const t0 = tagXY(tag);
              const { x, y } = imgToBox(t0.x, t0.y);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation(); e.preventDefault();
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    wasDraggingRef.current = false;
                    setDraggingIdx(idx); setSelectedIdx(idx);
                  }}
                  onPointerMove={handleTagMove}
                  onPointerUp={() => setDraggingIdx(null)}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute"
                  style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", cursor: draggingIdx === idx ? "grabbing" : "grab", touchAction: "none" }}
                  title={tag.name || `태그 ${idx + 1}`}
                >
                  <span className={`flex items-center justify-center rounded-full ${
                    selectedIdx === idx ? "w-7 h-7 bg-[#E5541B]/90 border-2 border-white shadow-lg" : "w-6 h-6 bg-white/85 border-2 border-white shadow-md"
                  }`}>
                    <span className="text-[10px] font-bold text-[#303236]">{idx + 1}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* 태그 편집 — 선택한 태그의 제품 지정 */}
          {editMode === "tag" && (
            <div className="space-y-2">
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag, idx) => (
                    <button key={tag.id} type="button" onClick={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
                      className={`px-2.5 py-1 rounded-full text-[11px] transition-colors ${
                        selectedIdx === idx ? "bg-[#E5541B] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}>{idx + 1}. {tag.name || "제품 미선택"}</button>
                  ))}
                </div>
              )}
              {selectedTag && selectedIdx !== null && (
                <div className="border-2 border-[#E5541B]/30 rounded-xl p-3 bg-orange-50/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#E5541B]">태그 {selectedIdx + 1} 제품 선택 <span className="text-gray-400 font-normal">(브랜드·제품명 자동 표시)</span></span>
                    <button type="button" onClick={() => { setTags(tags.filter((_, i) => i !== selectedIdx)); setSelectedIdx(null); }}
                      className="text-[11px] text-red-500 hover:text-red-700 font-medium">삭제</button>
                  </div>
                  <ProductPicker products={products} value={selectedTag.name}
                    onSelect={(p) => updateTag(selectedIdx, { item_id: p.id, product_id: "", name: p.name, price: p.price, image_url: p.imageUrl ?? "" })} />
                  {products.length === 0 && (
                    <p className="text-[11px] text-red-500">메인 상세 또는 우측 배너 1~4에 등록된 제품이 없습니다. 제품을 먼저 추가하세요.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
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

  type BannerKey = "banner1" | "banner2" | "banner3" | "banner4";
  const BANNER_KEYS: BannerKey[] = ["banner1", "banner2", "banner3", "banner4"];

  // 메인 이미지 태그 후보 — 우측 배너 1~4에 입력한 제품(메인+추가)만. 기존 제품 DB 목록은 쓰지 않는다.
  // 후보 id는 배너 제품 id(ProductItem.id)이며, 태그 클릭 시 해당 배너 제품탭으로 이동한다.
  const bannerProducts: SearchProduct[] = [];
  const productSources: (Banner | undefined)[] = [block.hero.detail, ...BANNER_KEYS.map((k) => block[k])];
  for (const src of productSources) {
    for (const it of [...(src?.items ?? []), ...(src?.detail_items ?? [])]) {
      if (!it.name.trim()) continue;
      const brand = it.card_detail?.brand;
      bannerProducts.push({ id: it.id, name: it.name, brand, price: it.price, imageUrl: it.card_detail?.images?.[0] || it.image_url || undefined });
    }
  }

  // 배너 위치 변경 — 배너 내용 전체가 함께 이동하고, 선택된 탭도 따라간다
  function moveBanner(from: BannerKey, to: BannerKey) {
    if (from === to) return;
    const list = BANNER_KEYS.map((k) => block[k]);
    const [moved] = list.splice(BANNER_KEYS.indexOf(from), 1);
    list.splice(BANNER_KEYS.indexOf(to), 0, moved);
    onUpdate({ banner1: list[0], banner2: list[1], banner3: list[2], banner4: list[3] });
    if (tab === from) setTab(to);
    else if (tab !== "hero") {
      const fi = BANNER_KEYS.indexOf(from), ti = BANNER_KEYS.indexOf(to), ci = BANNER_KEYS.indexOf(tab as BannerKey);
      if (fi < ti && ci > fi && ci <= ti) setTab(BANNER_KEYS[ci - 1]);
      else if (fi > ti && ci >= ti && ci < fi) setTab(BANNER_KEYS[ci + 1]);
    }
  }

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
            {/* 카드 타입 — 선택된 배너 탭 기준 (메인 기획전 탭에서는 숨김) */}
            {tab !== "hero" && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-500">카드 타입</span>
                <div className="flex rounded-lg overflow-hidden border border-gray-200">
                  {(["product", "image"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onUpdate({ [tab]: { ...block[tab], card_type: t } })}
                      className={`text-xs px-3 py-1.5 transition-colors ${
                        (block[tab].card_type ?? "product") === t ? "bg-[#303236] text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {t === "product" ? "상품형 (기본)" : "통이미지형"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 탭 */}
          <div className="flex border-b border-gray-100">
            {TABS.map((t) => {
              const isBanner = t.key !== "hero";
              return (
                <div
                  key={t.key}
                  className="relative flex-1 flex"
                  draggable={isBanner}
                  onDragStart={(e) => { if (isBanner) e.dataTransfer.setData("text/plain", t.key); }}
                  onDragOver={(e) => { if (isBanner) e.preventDefault(); }}
                  onDrop={(e) => {
                    if (!isBanner) return;
                    e.preventDefault();
                    const from = e.dataTransfer.getData("text/plain");
                    if (BANNER_KEYS.includes(from as BannerKey)) moveBanner(from as BannerKey, t.key as BannerKey);
                  }}
                >
                  <button
                    onClick={() => setTab(t.key)}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${isBanner ? "cursor-grab" : ""} ${
                      tab === t.key
                        ? "text-[#303236] border-b-2 border-[#303236]"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {t.label}
                    {t.key !== "hero" && block[t.key].label && (
                      <span className={`ml-1.5 text-xs font-normal ${tab === t.key ? "text-gray-500" : "text-gray-400"}`}>
                        · {block[t.key].label}
                      </span>
                    )}
                  </button>
                  {isBanner && tab === t.key && (
                    <div className="absolute right-1 top-1 flex gap-0.5">
                      <button type="button" title="앞으로" disabled={t.key === "banner1"}
                        onClick={() => moveBanner(t.key as BannerKey, BANNER_KEYS[BANNER_KEYS.indexOf(t.key as BannerKey) - 1])}
                        className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-500 text-[10px] leading-none disabled:opacity-30">◀</button>
                      <button type="button" title="뒤로" disabled={t.key === "banner4"}
                        onClick={() => moveBanner(t.key as BannerKey, BANNER_KEYS[BANNER_KEYS.indexOf(t.key as BannerKey) + 1])}
                        className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-500 text-[10px] leading-none disabled:opacity-30">▶</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 탭 콘텐츠 */}
          <div className="p-5">
            {tab === "hero" && (
              <HeroEditor
                hero={block.hero}
                products={bannerProducts}
                onChange={(patch) => onUpdate({ hero: { ...block.hero, ...patch } })}
              />
            )}
            {tab === "hero" && (
              <div className="mt-8 pt-6 border-t-2 border-gray-200 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-gray-800">메인 상세페이지 (제품 여러 개)</h4>
                  <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">
                    서브 배너 상세페이지와 같은 화면입니다. 여기에 넣은 제품을 위 메인 이미지 태그에서 고르면, 태그 클릭 시 이 상세페이지의 해당 제품 탭이 열립니다.
                    제목·설명·이미지를 비워 두면 메인 기획전 값을 씁니다. 주소: <code>/products/feature/{block.id}/main</code>
                  </p>
                </div>
                <BannerEditor
                  label="메인 상세"
                  banner={block.hero.detail ?? emptyBanner()}
                  onChange={(patch) => onUpdate({ hero: { ...block.hero, detail: { ...(block.hero.detail ?? emptyBanner()), ...patch } } })}
                  products={products}
                />
              </div>
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
