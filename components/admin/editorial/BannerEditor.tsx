"use client";
import { useState, useEffect, useRef } from "react";
import { BRANDS } from "@/lib/brands-data";

// 기획전 서브 배너 편집기 공용 모듈 — /admin/main/editorial(서브 배너)과 /admin/main/visual(메인 슬라이드 상세)이 함께 쓴다.

// ── 타입 정의 ──────────────────────────────────────────────
// 기획전 상세페이지의 "카드형" 제품 위젯(이미지 페이징+컬러+사이즈+아코디언) 전용 데이터.
// 실제 상품 DB(색상/사이즈/상세정보)와는 별개 — 기획전 배너마다 다른 이미지·문구를 자유롭게 넣기 위함.
export type ProductCardColor = { id: string; name: string; hex: string; imageIndexes: number[]; soldOut?: boolean };
export type ProductCardSize = { id: string; label: string; soldOut?: boolean };
export type ProductCardDetail = {
  images: string[];
  colors: ProductCardColor[];
  sizes: ProductCardSize[];
  styleNo?: string;
  brand?: string;
  detailText: string;
  materialText: string;
  essentialText: string;
};

export type ProductItem = {
  id: string;
  product_id: string;
  name: string;
  price: string;
  image_url: string;
  bg: string;
  card_detail?: ProductCardDetail;
};

export type HeroTag = {
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
  item_id?: string;   // 연결된 배너 제품(ProductItem.id) — 메인 이미지 태그는 배너 제품 기준
};

export type Banner = {
  title: string;
  desc: string;
  label?: string;     // 상세페이지 상단 라벨 (배너별 기획전명) — 예: "그대 이름은 바람 바람 바람"
  section_bg: string;
  image_url: string;
  image_urls?: string[];  // 랜덤 로테이션용 추가 이미지 (대표 image_url과 번갈아 노출)
  card_type?: "product" | "image"; // "image" = 통이미지 카드 (제목/설명/썸네일 없이 이미지 한 장)
  link?: string;      // 통이미지 카드 클릭 시 이동할 링크 (PR 소식 등)
  items: ProductItem[];
  detail_items?: ProductItem[];  // 상세페이지 전용 추가 상품 (메인 items 뒤에 노출)
  tags?: HeroTag[];   // 섹션 이미지 위 상품 핫스팟 (단일 x/y 좌표 사용)
};

export type SearchProduct = { id: string; name: string; price: string; imageUrl?: string; brand?: string };

// ── 기본값 ──────────────────────────────────────────────────
export function emptyBanner(): Banner {
  return {
    title: "",
    desc: "",
    section_bg: "#303236",
    image_url: "",
    items: [emptyItem(), emptyItem(), emptyItem()],
    tags: [],
  };
}
export function emptyItem(): ProductItem {
  return { id: uid(), product_id: "", name: "", price: "", image_url: "", bg: "#e5e7eb" };
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── 제품 검색 피커 ─────────────────────────────────────────
export function ProductPicker({ products, value, onSelect }: {
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
                <p className="text-[12px] font-medium text-gray-800 truncate">{p.brand ? `[${p.brand}] ` : ""}{p.name}</p>
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

// ── 이미지 업로드 헬퍼 ─────────────────────────────────────
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body: form });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "업로드 실패");
  return json.url as string;
}

// 업로드 전 자동 리사이징 (최장변 1800px 이하로 축소, 비율 유지)
export async function resizeImage(file: File, maxPx = 1800): Promise<File> {
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
export function ImageField({
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
export function Field({
  label, value, onChange, placeholder = "", multiline = false, showCount = false, rows = 3,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; showCount?: boolean; rows?: number;
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
          placeholder={placeholder} rows={rows} className={cls} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} className={cls} />
      )}
    </div>
  );
}

// ── 서브 컴포넌트: 색상 입력 ───────────────────────────────
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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

export function emptyCardDetail(): ProductCardDetail {
  return { images: [], colors: [], sizes: [], styleNo: "", detailText: "", materialText: "", essentialText: "" };
}

// ── 서브 컴포넌트: 품번(Style No.) 입력 — 입고 스케쥴 상품코드 자동완성 ──
export function StyleNoField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
      <label className="block text-xs font-medium text-gray-600 mb-1.5">품번 (Style No.)</label>
      <input
        list="arrival-style-no-list"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="입고 스케쥴에서 검색하거나 직접 입력"
        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#303236]/30"
      />
      <datalist id="arrival-style-no-list">
        {codes.map((c) => (
          <option key={c.code} value={c.code}>{c.name}</option>
        ))}
      </datalist>
    </div>
  );
}

// ── 서브 컴포넌트: 컬러별 이미지 선택 — 번호 배지만 클릭해 토글 (표시는 1부터, 저장은 0부터) ──
export function ColorImageNumbers({ indexes, total, onChange }: {
  indexes: number[];
  total: number;
  onChange: (next: number[]) => void;
}) {
  function toggle(idx: number) {
    onChange(indexes.includes(idx) ? indexes.filter((n) => n !== idx) : [...indexes, idx].sort((a, b) => a - b));
  }

  return (
    <div className="flex flex-wrap items-center gap-1 pl-1 flex-1 min-w-0">
      {Array.from({ length: total }, (_, idx) => {
        const checked = indexes.includes(idx);
        return (
          <button
            key={idx}
            type="button"
            onClick={() => toggle(idx)}
            className={`w-7 h-7 flex-shrink-0 rounded text-xs font-semibold border transition-colors ${
              checked ? "bg-[#303236] text-white border-[#303236]" : "bg-white text-gray-400 border-gray-300 hover:border-gray-400"
            }`}
            title={`이미지 ${idx + 1}`}
          >
            {idx + 1}
          </button>
        );
      })}
    </div>
  );
}

// ── 서브 컴포넌트: 카드형 상세(이미지 페이징+컬러+사이즈+아코디언 내용) 편집 ──
export function CardDetailEditor({ detail, onChange }: {
  detail: ProductCardDetail | undefined;
  onChange: (detail: ProductCardDetail) => void;
}) {
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

  // 여러 장을 한 번에 선택 가능 — 선택 순서(파일명 순)대로 업로드 후 한 번에 반영
  async function addImages(files: File[]) {
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const urls: string[] = [];
    for (const f of sorted) {
      urls.push(await uploadImage(await resizeImage(f)));
    }
    set("images", [...d.images, ...urls]);
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
  // 이미지 순서 변경 — 컬러에 체크된 이미지 번호도 함께 따라가도록 재매핑
  function moveImage(from: number, to: number) {
    if (from === to || to < 0 || to >= d.images.length) return;
    const nextImages = [...d.images];
    const [moved] = nextImages.splice(from, 1);
    nextImages.splice(to, 0, moved);
    const remap = (n: number) => {
      if (n === from) return to;
      if (from < to && n > from && n <= to) return n - 1;
      if (from > to && n >= to && n < from) return n + 1;
      return n;
    };
    const nextColors = d.colors.map((c) => ({ ...c, imageIndexes: c.imageIndexes.map(remap).sort((a, b) => a - b) }));
    onChange({ ...d, images: nextImages, colors: nextColors });
  }
  function addColor() {
    set("colors", [...d.colors, { id: uid(), name: "", hex: "#303236", imageIndexes: [] }]);
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
      <div className="space-y-4 bg-white border border-gray-200 rounded-xl p-3">
          {/* 이미지 그리드 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">이미지 (등록한 순서대로 2열 그리드에 이어서 노출)</label>
            <p className="text-[11px] text-gray-400 mb-1.5">드래그하거나 ◀ ▶로 순서 변경 · 1:1 정사각형으로 노출 (가운데 기준 잘림) · 권장 1200×1200px (최소 800×800px) · 2열 그리드에서는 한 장이 약 270px로 보임</p>
            <div className="flex flex-wrap gap-2">
              {d.images.map((url, i) => (
                <div key={i} className="relative w-16 h-16 flex-shrink-0 cursor-grab"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); moveImage(Number(e.dataTransfer.getData("text/plain")), i); }}>
                  <img src={url} alt="" draggable={false} className="w-full h-full object-cover rounded border border-gray-200" />
                  <span className="absolute top-0.5 left-0.5 bg-black/60 text-white text-[9px] px-1 rounded">{i + 1}</span>
                  <div className="absolute bottom-0.5 inset-x-0.5 flex justify-between">
                    <button type="button" disabled={i === 0} onClick={() => moveImage(i, i - 1)}
                      className="w-4 h-4 bg-black/60 text-white rounded text-[9px] leading-none disabled:opacity-30" title="앞으로">◀</button>
                    <button type="button" disabled={i === d.images.length - 1} onClick={() => moveImage(i, i + 1)}
                      className="w-4 h-4 bg-black/60 text-white rounded text-[9px] leading-none disabled:opacity-30" title="뒤로">▶</button>
                  </div>
                  <button type="button" onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] leading-none flex items-center justify-center">×</button>
                </div>
              ))}
              <label className="w-16 h-16 flex-shrink-0 border-2 border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer hover:border-[#303236] text-gray-400 text-xl">
                +
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) addImages(fs); e.target.value = ""; }} />
              </label>
            </div>
          </div>

          {/* 컬러 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-600">컬러 (선택 시 번호를 체크한 이미지만 표시 — 여러 장 가능)</label>
              <button type="button" onClick={addColor} className="text-[11px] text-[#303236] hover:underline">+ 컬러 추가</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {d.colors.map((c, i) => (
                <div key={c.id} className="bg-gray-50 border border-gray-200 rounded-lg p-1.5 flex items-start gap-1.5 min-w-0">
                    <input type="color" value={c.hex} onChange={(e) => updateColor(i, { hex: e.target.value })}
                      className="w-7 h-7 rounded border border-gray-300 cursor-pointer flex-shrink-0" />
                    <input type="text" value={c.name} onChange={(e) => updateColor(i, { name: e.target.value })}
                      placeholder="색상명" className="w-24 flex-shrink-0 text-xs border border-gray-300 rounded px-2 py-1.5" />
                  {d.images.length === 0 ? (
                    <p className="text-[10px] text-gray-400 pl-1 flex-1">위에 이미지를 먼저 등록하세요.</p>
                  ) : (
                    <ColorImageNumbers
                      indexes={c.imageIndexes}
                      total={d.images.length}
                      onChange={(next) => updateColor(i, { imageIndexes: next })}
                    />
                  )}
                  <button type="button" onClick={() => removeColor(i)} className="text-[11px] text-red-400 hover:text-red-600 flex-shrink-0">삭제</button>
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
            <div className="flex items-center gap-2 overflow-x-auto">
              <div className="flex items-center gap-1.5 flex-shrink-0 w-72">
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
              {d.sizes.map((s, i) => (
                <div key={s.id} className="flex items-center gap-1 flex-shrink-0 bg-gray-50 border border-gray-200 rounded-lg p-1">
                  <input type="text" value={s.label} onChange={(e) => updateSize(i, { label: e.target.value })}
                    placeholder="S" className="w-12 text-xs border border-gray-300 rounded px-1.5 py-1 text-center" />
                  <button type="button" onClick={() => removeSize(i)} className="text-[10px] text-red-400 hover:text-red-600">×</button>
                </div>
              ))}
            </div>
          </div>

          {/* 아코디언 내용 */}
          <Field label="상품 상세정보" value={d.detailText} onChange={(v) => set("detailText", v)} multiline rows={10} placeholder="제품 상세 설명을 입력하세요." />
      </div>
    </div>
  );
}


// ── 서브 컴포넌트: 연결상품 슬롯 에디터 (탭 내부) ───────────
export function SlotItemEditor({ item, onChange }: {
  item: ProductItem;
  onChange: (patch: Partial<ProductItem>) => void;
}) {
  // 입고 스케쥴에 등록된 브랜드만 노출 (중복 제거). 불러오기 실패 시 정적 BRANDS로 대체
  const [brandNames, setBrandNames] = useState<string[]>(BRANDS.map((b) => b.name));
  useEffect(() => {
    fetch("/api/admin/arrival")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;
        const names = [...new Set(data.map((p: { brand?: string }) => (p.brand ?? "").trim()).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b));
        if (names.length) setBrandNames(names);
      })
      .catch(() => {});
  }, []);
  const currentBrand = item.card_detail?.brand;

  return (
    <div>
      {/* 브랜드(제품명 위에 표시) + 품번 + 상품명 한 줄 */}
      <div className="flex gap-3 items-end">
        <div className="w-40 flex-shrink-0">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">브랜드</label>
          <select
            value={item.card_detail?.brand ?? ""}
            onChange={(e) => onChange({ card_detail: { ...(item.card_detail ?? emptyCardDetail()), brand: e.target.value || undefined } })}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 bg-white"
          >
            <option value="">선택 안 함</option>
            {brandNames.map((n) => <option key={n} value={n}>{n}</option>)}
            {currentBrand && !brandNames.includes(currentBrand) && <option value={currentBrand}>{currentBrand}</option>}
          </select>
        </div>
        <div className="w-48 flex-shrink-0">
          <StyleNoField
            value={item.card_detail?.styleNo ?? ""}
            onChange={(v) => onChange({ card_detail: { ...(item.card_detail ?? emptyCardDetail()), styleNo: v } })}
          />
        </div>
        <div className="flex-1 min-w-0">
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
export function BannerEditor({ banner, label, onChange, products }: {
  banner: Banner;
  label: string;
  onChange: (patch: Partial<Banner>) => void;
  products: SearchProduct[];
}) {
  const [itemTab, setItemTab] = useState(0);

  // 앞 3개는 메인 카드 슬롯(고정), 4번째부터는 상세페이지 전용 추가 상품(detail_items)
  const items3: ProductItem[] = [0, 1, 2].map((i) => banner.items[i] ?? emptyItem());
  const extraItems = banner.detail_items ?? [];
  const allItems: ProductItem[] = [...items3, ...extraItems];

  function updateItem(idx: number, patch: Partial<ProductItem>) {
    if (idx < 3) {
      onChange({ items: items3.map((item, i) => (i === idx ? { ...item, ...patch } : item)) });
    } else {
      onChange({ detail_items: extraItems.map((item, i) => (i === idx - 3 ? { ...item, ...patch } : item)) });
    }
  }
  function addExtraItem() {
    onChange({ detail_items: [...extraItems, emptyItem()] });
    setItemTab(allItems.length);
  }
  function removeExtraItem(idx: number) {
    onChange({ detail_items: extraItems.filter((_, i) => i !== idx - 3) });
    setItemTab(idx - 1);
  }

  return (
    <div className="space-y-4">
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
      {/* 라벨 + 타이틀 + 설명 한 줄 (single-line inputs) */}
      <div className="flex gap-3 items-end">
        <div className="flex-shrink-0" style={{ width: "200px" }}>
          <Field
            label="상단 라벨 (관리용 · 미노출)"
            value={banner.label ?? ""}
            onChange={(v) => onChange({ label: v })}
            placeholder="그대 이름은 바람 바람 바람"
          />
        </div>
        <div className="flex-shrink-0" style={{ width: "200px" }}>
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
          {/* 랜덤 로테이션 — 추가 이미지를 등록하면 대표 이미지와 함께 접속할 때마다 랜덤·8초 간격으로 교체 노출 */}
          <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
            <p className="text-[11px] font-semibold text-gray-700">
              랜덤 이미지 ({1 + (banner.image_urls?.length ?? 0)}장)
            </p>
            {(banner.image_urls ?? []).map((url, i) => (
              <div key={`${url}-${i}`} className="relative rounded-lg overflow-hidden border border-gray-200" style={{ aspectRatio: "8/9" }}>
                <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <button
                  type="button"
                  aria-label="랜덤 이미지 삭제"
                  onClick={() => onChange({ image_urls: (banner.image_urls ?? []).filter((_, j) => j !== i) })}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs leading-none hover:bg-black/80"
                >
                  ✕
                </button>
              </div>
            ))}
            <ImageField
              label="추가"
              hint="880 × 990px 이상 권장"
              value=""
              onChange={(url) => onChange({ image_urls: [...(banner.image_urls ?? []), url] })}
              compact
              aspectRatio="8/9"
            />
            <p className="text-[10px] text-gray-400 leading-snug">대표 이미지 + 추가 이미지가 번갈아 노출됩니다. (2장 이상일 때)</p>
          </div>
        </div>

        {/* 우: 연결상품 3개 탭 */}
        <div className="flex-1 min-w-0">
          {/* 탭 바 — 좌측 정렬, 자연 너비 */}
          <div className="flex flex-wrap border border-gray-200 rounded-t-xl overflow-hidden">
            {allItems.map((_, i) => (
              <button
                key={i}
                onClick={() => setItemTab(i)}
                className={`px-5 py-2.5 text-sm font-semibold transition-colors border-r last:border-r-0 border-gray-200 text-left whitespace-nowrap ${
                  itemTab === i
                    ? "bg-[#303236] text-white"
                    : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                }`}
              >
                {i + 1}
                {allItems[i].name && (
                  <span className={`ml-1.5 text-xs font-normal ${itemTab === i ? "text-white/70" : "text-gray-400"}`}>
                    · {allItems[i].name}
                  </span>
                )}
              </button>
            ))}
            <button type="button" onClick={addExtraItem}
              className="px-4 py-2.5 text-sm font-semibold text-[#303236] bg-white hover:bg-gray-50 whitespace-nowrap">
              + 상품 추가
            </button>
          </div>
          {/* 탭 콘텐츠 */}
          <div className="border border-t-0 border-gray-200 rounded-b-xl p-4">
            {itemTab >= 3 && (
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] text-gray-400">상세페이지 전용 상품 (메인 카드에는 노출되지 않음)</span>
                <button type="button" onClick={() => removeExtraItem(itemTab)}
                  className="text-[11px] text-red-500 hover:text-red-700 font-medium">이 상품 삭제</button>
              </div>
            )}
            <SlotItemEditor
              key={itemTab}
              item={allItems[itemTab] ?? allItems[0]}
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

