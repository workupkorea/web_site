"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

// ── 타입 ─────────────────────────────────────────────────────
type ProductItem = { id: string; product_id: string; name: string; price: string; image_url: string; bg: string };
type HeroTag = { id: string; x: number; y: number; pc_x?: number; pc_y?: number; name: string; price: string; product_id: string; image_url: string; bg: string };
type Banner = { title: string; desc: string; section_bg: string; image_url: string; items: ProductItem[]; tags?: HeroTag[] };
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
    bg_color: string;
    tags: HeroTag[];
  };
  banner1: Banner;
  banner2: Banner;
  banner3?: Banner;
  banner4?: Banner;
};

// ── 헬퍼 ─────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10); }
function emptyItem(): ProductItem { return { id: uid(), product_id: "", name: "", price: "", image_url: "", bg: "#e5e7eb" }; }
function emptyBanner(): Banner { return { title: "", desc: "", section_bg: "#303236", image_url: "", items: [emptyItem(), emptyItem(), emptyItem()], tags: [] }; }

// ── 개별 카드 ─────────────────────────────────────────────────
function BlockCard({
  block, index, total, isSaving, isDragOver, isDragging,
  onToggleVisible, onDelete, onDuplicate, onMoveUp, onMoveDown,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: {
  block: EditorialBlock;
  index: number;
  total: number;
  isSaving: boolean;
  isDragOver: boolean;
  isDragging: boolean;
  onToggleVisible: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const banners = [block.banner1, block.banner2, block.banner3, block.banner4].filter(Boolean) as Banner[];
  const totalTagCount = block.hero.tags?.length ?? 0;
  const totalItemCount = banners.reduce((acc, b) => acc + (b.items?.filter(i => i.name).length ?? 0), 0);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`flex items-stretch gap-0 bg-white border rounded-xl overflow-hidden transition-all select-none ${
        isDragging
          ? "opacity-40 scale-[0.99] shadow-none border-gray-200"
          : isDragOver
          ? "border-[#303236] shadow-lg ring-2 ring-[#303236]/20"
          : isSaving
          ? "opacity-60 border-gray-200"
          : "border-gray-200 hover:border-[#303236]/20 hover:shadow-sm"
      }`}
    >
      {/* 드래그 핸들 + 순서 번호 + 이동 버튼 */}
      <div className="flex flex-col items-center justify-center w-12 bg-gray-50 border-r border-gray-100 flex-shrink-0 gap-1 cursor-grab active:cursor-grabbing py-3">
        {/* 드래그 핸들 아이콘 */}
        <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 110 4 2 2 0 010-4zm6 0a2 2 0 110 4 2 2 0 010-4zM7 8a2 2 0 110 4 2 2 0 010-4zm6 0a2 2 0 110 4 2 2 0 010-4zM7 14a2 2 0 110 4 2 2 0 010-4zm6 0a2 2 0 110 4 2 2 0 010-4z" />
        </svg>
        {/* 순서 번호 */}
        <span className="text-[11px] font-bold text-gray-400 leading-none">{index + 1}</span>
        {/* ▲▼ 버튼 */}
        <div className="flex flex-col gap-0.5 mt-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0 || isSaving}
            className="w-5 h-4 flex items-center justify-center rounded hover:bg-gray-200 disabled:opacity-20 text-gray-400 text-[10px] transition-colors"
            title="위로"
          >▲</button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1 || isSaving}
            className="w-5 h-4 flex items-center justify-center rounded hover:bg-gray-200 disabled:opacity-20 text-gray-400 text-[10px] transition-colors"
            title="아래로"
          >▼</button>
        </div>
      </div>

      {/* 대표 이미지 썸네일 */}
      <div className="flex-shrink-0" style={{ width: "80px" }}>
        <div
          className="w-full h-full relative overflow-hidden"
          style={{ aspectRatio: "3/4", background: block.hero.bg_color || "#e5e7eb" }}
        >
          {block.hero.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.hero.image_url}
              alt={block.hero.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* 정보 영역 */}
      <div className="flex-1 min-w-0 px-5 py-4 flex flex-col justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              block.is_visible ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}>
              {block.is_visible ? "노출 중" : "비노출"}
            </span>
            <span className="text-[11px] text-gray-400">{block.reversed ? "우측 메인" : "좌측 메인"}</span>
          </div>
          <p className="mt-1.5 text-base font-bold text-gray-900 truncate">{block.hero.title || "제목 없음"}</p>
          {block.hero.subtitle && (
            <p className="text-sm text-gray-500 truncate mt-0.5">{block.hero.subtitle}</p>
          )}
        </div>

        {/* 배너 썸네일 + 통계 */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5">
            {banners.map((banner, i) => (
              <div
                key={i}
                className="relative rounded overflow-hidden border border-gray-200 flex-shrink-0"
                style={{ width: "28px", aspectRatio: "3/4", background: banner.section_bg || "#e5e7eb" }}
              >
                {banner.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={banner.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/30 flex justify-center py-0.5">
                  <span className="text-[6px] text-white font-medium">B{i + 1}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            {totalTagCount > 0 && <span>🏷 태그 {totalTagCount}개</span>}
            {totalItemCount > 0 && <span>📦 상품 {totalItemCount}개</span>}
          </div>
        </div>
      </div>

      {/* 액션 영역 */}
      <div className="flex flex-col items-center justify-center gap-2 px-4 border-l border-gray-100 flex-shrink-0">
        {/* 노출 토글 */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={onToggleVisible}
            disabled={isSaving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
              block.is_visible ? "bg-[#303236]" : "bg-gray-300"
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              block.is_visible ? "translate-x-[22px]" : "translate-x-1"
            }`} />
          </button>
          <span className="text-[9px] text-gray-400">{block.is_visible ? "노출" : "비노출"}</span>
        </div>

        {/* 버튼 */}
        <div className="flex flex-col gap-1 mt-1">
          <Link
            href="/admin/main/home?tab=editorial"
            className="flex items-center justify-center gap-1 px-3 py-1.5 text-[11px] font-medium text-[#303236] bg-[#f5f7ff] border border-[#303236]/20 rounded-lg hover:bg-[#e8ecf9] transition-colors whitespace-nowrap"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
            수정
          </Link>
          <button
            onClick={onDuplicate}
            disabled={isSaving}
            className="flex items-center justify-center gap-1 px-3 py-1.5 text-[11px] font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
            </svg>
            복제
          </button>
          <button
            onClick={onDelete}
            disabled={isSaving}
            className="flex items-center justify-center gap-1 px-3 py-1.5 text-[11px] font-medium text-red-500 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────
export default function AdminEditorialListPage() {
  const [blocks, setBlocks] = useState<EditorialBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<"ok" | "err" | null>(null);

  // 드래그 상태
  const draggingIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/site-settings/editorial_blocks")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
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

  async function persist(updated: EditorialBlock[]) {
    const res = await fetch("/api/admin/site-settings/editorial_blocks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks: updated }),
    });
    setToast(res.ok ? "ok" : "err");
    setTimeout(() => setToast(null), 2000);
  }

  async function toggleVisible(id: string) {
    setSavingId(id);
    const updated = blocks.map(b => b.id === id ? { ...b, is_visible: !b.is_visible } : b);
    setBlocks(updated);
    await persist(updated);
    setSavingId(null);
  }

  async function deleteBlock(id: string) {
    if (!confirm("이 기획전 블록을 삭제하시겠습니까?")) return;
    setSavingId(id);
    const updated = blocks.filter(b => b.id !== id).map((b, i) => ({ ...b, sort_order: i }));
    setBlocks(updated);
    await persist(updated);
    setSavingId(null);
  }

  async function duplicateBlock(id: string) {
    setSavingId(id);
    const src = blocks.find(b => b.id === id);
    if (!src) { setSavingId(null); return; }
    const copy: EditorialBlock = {
      ...src,
      id: uid(),
      sort_order: blocks.length,
      hero: { ...src.hero, title: src.hero.title + " (복사본)" },
    };
    const updated = [...blocks, copy];
    setBlocks(updated);
    await persist(updated);
    setSavingId(null);
  }

  async function moveBlock(from: number, to: number) {
    if (from === to) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const updated = next.map((b, i) => ({ ...b, sort_order: i }));
    setBlocks(updated);
    await persist(updated);
  }

  // ── 드래그 핸들러 ─────────────────────────────────────────
  function handleDragStart(idx: number, id: string) {
    draggingIdx.current = idx;
    setDraggingId(id);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (draggingIdx.current !== null && draggingIdx.current !== idx) {
      setDragOverIdx(idx);
    }
  }

  function handleDrop(toIdx: number) {
    if (draggingIdx.current !== null && draggingIdx.current !== toIdx) {
      moveBlock(draggingIdx.current, toIdx);
    }
    draggingIdx.current = null;
    setDraggingId(null);
    setDragOverIdx(null);
  }

  function handleDragEnd() {
    draggingIdx.current = null;
    setDraggingId(null);
    setDragOverIdx(null);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">불러오는 중...</div>;
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">기획전 목록</h1>
          <p className="text-base text-gray-400 mt-1">
            총 {blocks.length}개 블록 · 노출 {blocks.filter(b => b.is_visible).length}개
            <span className="ml-2 text-gray-300">· 드래그 또는 ▲▼ 버튼으로 순서 변경</span>
          </p>
        </div>
        <Link
          href="/admin/main/home?tab=editorial"
          className="px-6 py-2.5 bg-[#303236] text-white text-sm font-semibold rounded hover:bg-[#243d6a] transition-colors"
        >
          편집 모드
        </Link>
      </div>

      {/* 토스트 */}
      {toast === "ok" && (
        <div className="mb-4 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          저장되었습니다.
        </div>
      )}
      {toast === "err" && (
        <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          저장에 실패했습니다.
        </div>
      )}

      {/* 목록 */}
      {blocks.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
          <p className="mb-4">등록된 기획전 블록이 없습니다.</p>
          <Link href="/admin/main/home?tab=editorial"
            className="inline-block px-6 py-2.5 bg-[#303236] text-white text-sm font-semibold rounded hover:bg-[#243d6a] transition-colors">
            편집 모드에서 추가하기
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {blocks.map((block, index) => (
            <BlockCard
              key={block.id}
              block={block}
              index={index}
              total={blocks.length}
              isSaving={savingId === block.id}
              isDragging={draggingId === block.id}
              isDragOver={dragOverIdx === index}
              onToggleVisible={() => toggleVisible(block.id)}
              onDelete={() => deleteBlock(block.id)}
              onDuplicate={() => duplicateBlock(block.id)}
              onMoveUp={() => moveBlock(index, index - 1)}
              onMoveDown={() => moveBlock(index, index + 1)}
              onDragStart={() => handleDragStart(index, block.id)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}
