"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import type { ArrivalProduct, ArrivalStatus } from "@/lib/arrival";

// ─── 유틸 ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  if (!iso || iso === "미정") return iso || "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function fmtPrice(n: number) {
  return n > 0 ? "₩" + n.toLocaleString("ko-KR") : "—";
}

const STATUS_OPTIONS: ArrivalStatus[] = ["입고예정", "입고완료", "입고지연", "일정미정", "대기", "일정미표기"];

const STATUS_CLS: Record<ArrivalStatus, string> = {
  입고완료:   "bg-gray-100 text-gray-400",
  입고예정:   "bg-[#1a1a1a] text-white",
  입고지연:   "bg-amber-100 text-amber-700",
  일정미정:   "bg-gray-200 text-gray-500",
  대기:       "bg-blue-50 text-blue-600",
  일정미표기: "bg-gray-100 text-gray-400",
};

// ─── 동기화 히스토리 타입 ──────────────────────────────────────────────────────
interface ProductSnapshot {
  brand: string;
  category: string;
  arrivalDate: string;
  status: string;
  price: number;
  quantity: number;
  note: string;
}
interface SyncDiffItem {
  productCode: string;
  productName: string;
  type: "added" | "removed" | "changed";
  snapshot?: ProductSnapshot;           // 추가/삭제된 제품의 전체 정보
  changes?: { field: string; before: string; after: string }[];
}
interface SyncHistoryEntry {
  id: string;
  syncedAt: string;
  durationSec: number;
  total: number;
  byStatus: Record<string, number>;
  diff: SyncDiffItem[];
  actor?: string;
  error?: string;
}

function toSnapshot(p: ArrivalProduct): ProductSnapshot {
  return {
    brand: p.brand,
    category: p.category,
    arrivalDate: p.arrivalDate || "—",
    status: p.status,
    price: p.price,
    quantity: p.quantity ?? 0,
    note: p.note,
  };
}

function calcSyncDiff(before: ArrivalProduct[], after: ArrivalProduct[]): SyncDiffItem[] {
  const beforeMap = new Map(before.map(p => [`${p.productCode}::${p.arrivalDate}`, p]));
  const afterMap  = new Map(after.map(p => [`${p.productCode}::${p.arrivalDate}`, p]));
  const diff: SyncDiffItem[] = [];

  for (const [key, p] of afterMap) {
    if (!beforeMap.has(key)) diff.push({ productCode: p.productCode, productName: p.productName, type: "added", snapshot: toSnapshot(p) });
  }
  for (const [key, p] of beforeMap) {
    if (!afterMap.has(key)) diff.push({ productCode: p.productCode, productName: p.productName, type: "removed", snapshot: toSnapshot(p) });
  }
  for (const [key, b] of beforeMap) {
    const a = afterMap.get(key);
    if (!a) continue;
    const changes: { field: string; before: string; after: string }[] = [];
    if (b.productName  !== a.productName)  changes.push({ field: "상품명", before: b.productName,      after: a.productName });
    if (b.brand        !== a.brand)        changes.push({ field: "브랜드", before: b.brand,            after: a.brand });
    if (b.category     !== a.category)     changes.push({ field: "카테고리", before: b.category,       after: a.category });
    if (b.arrivalDate  !== a.arrivalDate)  changes.push({ field: "입고일", before: b.arrivalDate || "—", after: a.arrivalDate || "—" });
    if (b.status       !== a.status)       changes.push({ field: "상태",   before: b.status,           after: a.status });
    if (b.price        !== a.price)        changes.push({ field: "판매가", before: `₩${b.price.toLocaleString()}`, after: `₩${a.price.toLocaleString()}` });
    if ((b.quantity??0) !== (a.quantity??0)) changes.push({ field: "수량", before: String(b.quantity??0), after: String(a.quantity??0) });
    if (b.note         !== a.note)         changes.push({ field: "비고",   before: b.note || "—",      after: a.note || "—" });
    if (changes.length > 0) diff.push({ productCode: a.productCode, productName: a.productName, type: "changed", snapshot: toSnapshot(a), changes });
  }
  return diff;
}

function fmtElapsed(sec: number) {
  if (sec < 60) return `${sec.toFixed(1)}초`;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}분 ${String(s).padStart(2,"0")}초`;
}

const CSV_HEADERS = [
  "productCode","productName","brand","category","color",
  "supplyPrice","price","quantity","arrivalDate","status","description","note",
];

// ─── 단일 수정 모달 ───────────────────────────────────────────────────────────
function EditModal({
  product,
  onClose,
  onSaved,
}: {
  product: ArrivalProduct;
  onClose: () => void;
  onSaved: (updated: Partial<ArrivalProduct>) => void;
}) {
  const [date,      setDate]      = useState(product.arrivalDate || "");
  const [status,    setStatus]    = useState<ArrivalStatus>(product.status);
  // 이미지 목록: 콤마 구분 문자열 → 배열로 관리
  const [images,    setImages]    = useState<string[]>(
    () => (product.image || "").split(",").map(s => s.trim()).filter(Boolean)
  );
  const [reason,    setReason]    = useState("");
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  // 드래그 리오더
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const onImgDragStart = (idx: number) => setDragIdx(idx);
  const onImgDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const onImgDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setImages(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragIdx(null); setDragOverIdx(null);
  };
  const onImgDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  // 저장 시 배열 → 콤마 문자열로 변환
  const imageStr = images.join(",");

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setUploadProgress({ done: 0, total: files.length });
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("files", file);
        const res = await fetch("/api/admin/arrival/images", { method: "POST", body: fd });
        const json = await res.json();
        if (json.saved?.[0]) setImages(prev => [...prev, json.saved[0]]);
        setUploadProgress(p => ({ ...p, done: p.done + 1 }));
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const dateChanged = product.arrivalDate !== date;
  const history = product.changeHistory ?? [];

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        productCode: product.productCode,
        originalArrivalDate: product.arrivalDate, // 복합키 생성용 원래 입고일
        arrivalDate: date,
        status,
        image: imageStr || null,
      };
      if (reason.trim()) body.reason = reason.trim();
      const res = await fetch("/api/admin/arrival", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaved(true);
        onSaved({ arrivalDate: date, status, image: imageStr || null });
        setTimeout(onClose, 700);
      }
    } finally {
      setSaving(false);
    }
  };

  const clearHistory = async () => {
    if (!confirm("변경이력을 모두 삭제하시겠습니까?")) return;
    await fetch("/api/admin/arrival", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productCode: product.productCode,
        originalArrivalDate: product.arrivalDate,
        clearHistory: true,
      }),
    });
    onSaved({ changeHistory: [] });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[11px] tracking-widest text-gray-400 uppercase">{product.brand}</p>
            <h3 className="text-lg font-bold text-[#1a1a1a] mt-0.5">{product.productName}</h3>
            <p className="text-[12px] font-mono text-gray-400 mt-0.5">{product.productCode}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] tracking-widest text-gray-500 uppercase block mb-1.5">입고일</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="flex-1 border border-gray-200 px-3 py-2 text-[14px] rounded-lg focus:outline-none focus:border-[#1a1a1a]"
              />
              {dateChanged && (
                <div className="text-[11px] text-gray-400 shrink-0">
                  <span className="line-through">{product.arrivalDate || "—"}</span>
                  <span className="text-amber-600 ml-1 font-semibold">→ {date}</span>
                </div>
              )}
            </div>
            {dateChanged && (
              <div className="mt-2">
                <input
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="변경 사유 (이력에 기록됩니다)"
                  className="w-full border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] rounded-lg focus:outline-none focus:border-amber-400 placeholder:text-amber-300"
                />
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] tracking-widest text-gray-500 uppercase block mb-1.5">입고상태</label>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 text-[12px] font-bold rounded-full border transition-all ${
                    status === s
                      ? STATUS_CLS[s] + " border-transparent"
                      : "border-gray-200 text-gray-400 hover:border-gray-400"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] tracking-widest text-gray-500 uppercase block mb-1.5">
              이미지 {images.length > 0 && <span className="text-gray-300 font-normal">({images.length}장)</span>}
            </label>
            {/* 이미지 사이즈 가이드 */}
            <div className="flex gap-2 mb-2">
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">이미지 리스트·캘린더 1:1</span>
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">상세 모달 3:4</span>
              <span className="text-[10px] bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full font-medium">권장 1200×1600px</span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {images.map((src, idx) => (
                  <div
                    key={src + idx}
                    draggable
                    onDragStart={() => onImgDragStart(idx)}
                    onDragOver={(e) => onImgDragOver(e, idx)}
                    onDrop={(e) => onImgDrop(e, idx)}
                    onDragEnd={onImgDragEnd}
                    className={`relative group aspect-square rounded-lg overflow-hidden border bg-gray-50 cursor-grab active:cursor-grabbing transition-all ${
                      dragOverIdx === idx && dragIdx !== idx ? "border-blue-400 ring-2 ring-blue-300" :
                      dragIdx === idx ? "opacity-40 border-dashed border-gray-300" : "border-gray-200"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="w-full h-full object-cover pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500 text-white text-[11px] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                    {idx === 0 ? (
                      <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded font-semibold">대표</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setImages(prev => [prev[idx], ...prev.filter((_, i) => i !== idx)])}
                        className="absolute bottom-1 left-1 text-[9px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-semibold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-600"
                      >
                        대표로 설정
                      </button>
                    )}
                    {/* 순서 번호 */}
                    <span className="absolute top-1 left-1 text-[9px] bg-black/40 text-white px-1 py-0.5 rounded leading-none">{idx + 1}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full border-2 border-dashed border-gray-200 hover:border-[#1a1a1a] rounded-lg py-3 text-[13px] text-gray-400 hover:text-[#1a1a1a] transition-colors disabled:opacity-40"
            >
              {uploading
                ? `업로드 중... (${uploadProgress.done}/${uploadProgress.total})`
                : `+ 이미지 추가 (여러 장 선택 가능)`}
            </button>
          </div>

          {history.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] tracking-widest text-gray-400 uppercase">변경 이력</p>
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-[11px] text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-full px-2 py-0.5 transition-colors"
                >
                  이력 삭제
                </button>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {history.slice().reverse().map((h, i) => (
                  <div key={i} className="text-[12px] bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 text-gray-500">
                      <span className="line-through text-gray-300">{h.previousDate}</span>
                      <span className="text-gray-300">→</span>
                      <span className="font-semibold text-[#1a1a1a]">{h.newDate}</span>
                    </div>
                    <p className="text-gray-400 mt-0.5">{h.reason}</p>
                    <p className="text-[10px] text-gray-300 mt-0.5">{new Date(h.changedAt).toLocaleString("ko-KR")}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={save}
            disabled={saving || saved}
            className="flex-1 py-2.5 bg-[#1a1a1a] text-white text-[14px] font-bold rounded-xl disabled:opacity-50 hover:bg-[#333]"
          >
            {saved ? "✓ 저장됨" : saving ? "저장 중..." : "저장"}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-gray-200 text-[14px] text-gray-500 rounded-xl hover:border-gray-400"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 일괄 수정 패널 ───────────────────────────────────────────────────────────
function BulkPanel({
  selected,
  onSaved,
  onClose,
}: {
  selected: string[];
  onSaved: (codes: string[], data: Partial<ArrivalProduct>) => void;
  onClose: () => void;
}) {
  const [date,   setDate]   = useState("");
  const [status, setStatus] = useState<ArrivalStatus | "">("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const save = async () => {
    const payload: Record<string, unknown> = { productCodes: selected };
    if (date)         payload.arrivalDate = date;
    if (status)       payload.status      = status;
    if (reason.trim() && date) payload.reason = reason.trim();
    if (!date && !status) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/arrival", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSaved(true);
        onSaved(selected, { ...(date ? { arrivalDate: date } : {}), ...(status ? { status } : {}) });
        setTimeout(onClose, 800);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 w-[520px] max-w-[92vw]">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[14px] font-bold text-[#1a1a1a]">{selected.length}개 상품 일괄 수정</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
      </div>
      <div className="flex gap-3 items-end mb-3">
        <div className="flex-1">
          <p className="text-[11px] text-gray-400 mb-1">입고일 변경</p>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full border border-gray-200 px-3 py-2 text-[14px] rounded-lg focus:outline-none focus:border-[#1a1a1a]" />
        </div>
        <div className="flex-1">
          <p className="text-[11px] text-gray-400 mb-1">상태 변경</p>
          <select value={status} onChange={e => setStatus(e.target.value as ArrivalStatus | "")}
            className="w-full border border-gray-200 px-3 py-2 text-[14px] rounded-lg bg-white focus:outline-none focus:border-[#1a1a1a]">
            <option value="">변경 안 함</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={save} disabled={saving || saved || (!date && !status)}
          className="px-5 py-2 bg-[#1a1a1a] text-white text-[14px] font-bold rounded-xl disabled:opacity-40 hover:bg-[#333] whitespace-nowrap">
          {saved ? "✓" : saving ? "..." : "적용"}
        </button>
      </div>
      {date && (
        <input type="text" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="날짜 변경 사유 (이력에 기록됩니다)"
          className="w-full border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] rounded-lg focus:outline-none focus:border-amber-400 placeholder:text-amber-300" />
      )}
    </div>
  );
}

// ─── 개별 입고 등록 모달 ─────────────────────────────────────────────────────
function AddProductModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (p: ArrivalProduct) => void;
}) {
  const blank: ArrivalProduct = {
    productCode: "", productName: "", brand: "", category: "",
    color: "", price: 0, arrivalDate: "", status: "입고예정",
    description: "", note: "", image: null, detailUrl: null, changeHistory: [],
  };
  const [form,   setForm]   = useState<ArrivalProduct>(blank);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const set = (k: keyof ArrivalProduct, v: string | number) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.productCode.trim()) { setError("상품코드는 필수입니다."); return; }
    if (!form.productName.trim()) { setError("상품명은 필수입니다."); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/admin/arrival", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "저장 실패"); return; }
      onAdded({ ...form });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof ArrivalProduct, type = "text", placeholder = "") => (
    <div>
      <label className="text-[11px] tracking-widest text-gray-500 uppercase block mb-1">{label}</label>
      <input
        type={type}
        value={String(form[key] ?? "")}
        onChange={e => set(key, type === "number" ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 px-3 py-2 text-[13px] rounded-lg focus:outline-none focus:border-[#1a1a1a]"
      />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-[#1a1a1a]">개별 입고 등록</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {field("상품코드 *", "productCode", "text", "EX-001")}
          {field("브랜드 *", "brand", "text", "BRAND")}
          <div className="col-span-2">
            {field("상품명 *", "productName", "text", "상품명 입력")}
          </div>
          {field("카테고리", "category", "text", "상의")}
          {field("컬러", "color", "text", "블랙")}
          {field("가격", "price", "number", "50000")}
          {field("입고일", "arrivalDate", "date", "")}
        </div>

        <div className="mt-3">
          <label className="text-[11px] tracking-widest text-gray-500 uppercase block mb-1">입고상태</label>
          <div className="flex gap-2 flex-wrap">
            {STATUS_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => set("status", s)}
                className={`px-3 py-1.5 text-[12px] font-bold rounded-full border transition-all ${
                  form.status === s
                    ? STATUS_CLS[s] + " border-transparent"
                    : "border-gray-200 text-gray-400 hover:border-gray-400"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 space-y-3">
          <div>
            <label className="text-[11px] tracking-widest text-gray-500 uppercase block mb-1">설명</label>
            <textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              rows={2}
              className="w-full border border-gray-200 px-3 py-2 text-[13px] rounded-lg focus:outline-none focus:border-[#1a1a1a] resize-none"
            />
          </div>
          <div>
            <label className="text-[11px] tracking-widest text-gray-500 uppercase block mb-1">비고</label>
            <input
              type="text"
              value={form.note}
              onChange={e => set("note", e.target.value)}
              className="w-full border border-gray-200 px-3 py-2 text-[13px] rounded-lg focus:outline-none focus:border-[#1a1a1a]"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-[12px] text-red-500">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-2.5 bg-[#1a1a1a] text-white text-[14px] font-bold rounded-xl disabled:opacity-50 hover:bg-[#333]"
          >
            {saving ? "등록 중..." : "등록"}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-gray-200 text-[14px] text-gray-500 rounded-xl hover:border-gray-400"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 이미지 + CSV 통합 업로드 패널 (카탈로그 스타일) ─────────────────────────
function UploadPanel({
  products,
  onImageMatched,
  onImported,
}: {
  products: ArrivalProduct[];
  onImageMatched: (matches: Record<string, string>) => void;
  onImported: (products: ArrivalProduct[]) => void;
}) {
  const [open, setOpen] = useState(false);

  // ── Step 1: 이미지 ────────────────────────────────────────────────────────
  const [imgFiles,     setImgFiles]     = useState<File[]>([]);
  const [imgMatches,   setImgMatches]   = useState<Record<string, string[]>>({});  // productCode → URL[]
  const [imgFiles_map, setImgFilesMap]  = useState<Record<string, File[]>>({});    // productCode → File[]
  const [imgPreviews,  setImgPreviews]  = useState<Record<string, string>>({});
  const [imgUploading, setImgUploading] = useState(false);
  const [imgDone,      setImgDone]      = useState(false);

  // ── Step 2: CSV ───────────────────────────────────────────────────────────
  const [csvRows,   setCsvRows]   = useState<Record<string, string>[]>([]);
  const [csvSaving, setCsvSaving] = useState(false);
  const [csvResult, setCsvResult] = useState<{ added: number; skipped: string[] } | null>(null);
  const [csvError,  setCsvError]  = useState("");

  const CSV_HDRS = CSV_HEADERS;

  // CSV 매칭 상태: csvRows에 있는 productCode 중 이미지가 매칭된 것
  const csvMatchStats = useMemo(() => {
    const total = csvRows.length;
    const withImg = csvRows.filter(r => imgMatches[r.productCode]).length;
    return { total, withImg };
  }, [csvRows, imgMatches]);

  // 전체 매칭된 파일 수 (productCode별 배열 합산)
  const imgTotalFileCount = useMemo(
    () => Object.values(imgMatches).reduce((acc, arr) => acc + arr.length, 0),
    [imgMatches]
  );

  // ── 이미지 폴더 선택 ──────────────────────────────────────────────────────
  const handleFolder = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const exts = [".jpg",".jpeg",".png",".webp"];
    const newMatches: Record<string, string[]> = {};
    const newFiles:   Record<string, File[]>   = {};
    const newPrevs:   Record<string, string>   = {};

    // 긴 코드 우선 매칭 (짧은 코드가 긴 코드의 prefix인 경우 오탐 방지)
    const sortedProducts = [...products].sort((a, b) => b.productCode.length - a.productCode.length);

    for (const f of files) {
      const base     = f.name.replace(/\.[^.]+$/, "").trim();
      const ext      = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
      if (!exts.includes(ext)) continue;

      const match = sortedProducts.find(p => {
        const code = p.productCode;
        if (code === base) return true;
        // _숫자, (숫자), _텍스트, -숫자, -텍스트 등 suffix 제거 후 코드와 일치하는지 확인
        if (base.startsWith(code + "_") || base.startsWith(code + "-") || base.startsWith(code + " ")) return true;
        // Windows 복사본: "code (N)" 패턴
        if (base.replace(/\s*\(\d+\)$/, "").trim() === code) return true;
        return false;
      });
      if (match) {
        newMatches[match.productCode] = [...(newMatches[match.productCode] ?? []), `/images/arrival/${f.name}`];
        newFiles[match.productCode]   = [...(newFiles[match.productCode]   ?? []), f];
        newPrevs[match.productCode]   = URL.createObjectURL(f); // 마지막 이미지로 미리보기
      }
    }
    setImgFiles(files.filter(f => [".jpg",".jpeg",".png",".webp"].includes(f.name.slice(f.name.lastIndexOf(".")).toLowerCase())));
    setImgMatches(newMatches);
    setImgFilesMap(newFiles);
    setImgPreviews(newPrevs);
    setImgDone(false);
  };

  const [imgProgress, setImgProgress] = useState({ done: 0, total: 0 });

  const applyImages = async () => {
    setImgUploading(true);
    // productCode → 실제 업로드된 URL[]
    const uploadedUrls: Record<string, string[]> = {};

    try {
      // 파일을 하나씩 업로드 (Vercel 4.5 MB 본문 제한 우회)
      const allEntries = Object.entries(imgFiles_map);
      const totalFiles = Object.values(imgFiles_map).flat().length;
      setImgProgress({ done: 0, total: totalFiles });

      for (const [code, fileArr] of allEntries) {
        uploadedUrls[code] = [];
        for (const file of fileArr) {
          const fd = new FormData();
          fd.append("files", file);
          const res = await fetch("/api/admin/arrival/images", { method: "POST", body: fd });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            alert(`업로드 실패 (${file.name})\n\n${json.error ?? res.status}`);
            return;
          }
          if (json.errors?.length) console.warn("[arrival upload]", json.errors);
          if (json.saved?.[0]) uploadedUrls[code].push(json.saved[0]);
          setImgProgress(p => ({ ...p, done: p.done + 1 }));
        }
      }

      // productCode별 저장
      await Promise.all(
        Object.entries(uploadedUrls)
          .filter(([, urls]) => urls.length > 0)
          .map(([productCode, urls]) =>
            fetch("/api/admin/arrival", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productCode, image: urls.join(",") }),
            })
          )
      );

      // 로컬 상태 반영
      const allImages: Record<string, string> = {};
      for (const [code, urls] of Object.entries(uploadedUrls)) {
        if (urls.length > 0) allImages[code] = urls.join(",");
      }
      onImageMatched(allImages);
      setImgDone(true);
    } catch (e) {
      alert(`오류: ${String(e)}`);
    } finally {
      setImgUploading(false);
    }
  };

  // ── CSV 파싱 ──────────────────────────────────────────────────────────────
  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].replace(/^﻿/, "").split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    return lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
    }).filter(r => r.productCode?.trim());
  };

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = parseCSV(ev.target?.result as string);
      setCsvRows(rows);
      setCsvResult(null);
      setCsvError("");
    };
    reader.readAsText(f, "utf-8");
    e.target.value = "";
  };

  const doCSVImport = async () => {
    setCsvSaving(true); setCsvError("");
    try {
      const mapped = csvRows.map(r => ({
        productCode: r.productCode || "",
        productName: r.productName || "",
        brand: r.brand || "",
        category: r.category || "",
        color: r.color || "",
        price: Number(r.price) || 0,
        arrivalDate: r.arrivalDate || "",
        status: (r.status as ArrivalStatus) || "입고예정",
        description: r.description || "",
        note: r.note || "",
        image: null, detailUrl: null, changeHistory: [],
      }));
      const res = await fetch("/api/admin/arrival", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: mapped }),
      });
      const data = await res.json();
      if (!res.ok) { setCsvError(data.error || "임포트 실패"); return; }
      setCsvResult(data);
      onImported(mapped.filter(p => !data.skipped?.includes(p.productCode)) as ArrivalProduct[]);
    } finally {
      setCsvSaving(false);
    }
  };

  const downloadTemplate = () => {
    const example = ["EX-001","예시상품","BRAND","상의","블랙","50000","2026-09-15","입고예정","제품 설명","비고"];
    const csv = [CSV_HDRS.join(","), example.join(",")].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "arrival-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const imgMatchCount = Object.keys(imgMatches).length;

  const resetAll = () => {
    setImgFiles([]);
    setImgMatches({});
    setImgFilesMap({});
    setImgPreviews({});
    setImgDone(false);
    setImgProgress({ done: 0, total: 0 });
    setCsvRows([]);
    setCsvResult(null);
    setCsvError("");
  };

  return (
    <>
      <button
        onClick={() => { resetAll(); setOpen(true); }}
        className="px-4 py-2 border border-gray-200 text-[13px] text-gray-600 rounded-lg hover:border-gray-400 hover:text-[#1a1a1a] transition-colors flex items-center gap-2"
      >
        <span>📦</span> 이미지·데이터 업로드
      </button>

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex items-start justify-center pt-8 pb-16 px-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-black text-[#1a1a1a]">입고 데이터 업로드</h3>
                <p className="text-[13px] text-gray-400 mt-0.5">이미지를 먼저 업로드한 후 엑셀 파일을 올려 데이터를 등록하세요.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            {/* 순서 안내 */}
            <div className="mx-6 mt-5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-[13px] text-blue-700">
              순서 ① 아래에서 이미지 파일들을 먼저 업로드 →
              ② CSV/엑셀 <strong>"productCode"</strong> 칸이 파일명과 일치하면 자동 연결됩니다.
            </div>

            <div className="p-6 space-y-6">

              {/* ─── STEP 1: 이미지 ─────────────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-[#1a1a1a] text-white text-[12px] font-black flex items-center justify-center shrink-0">1</span>
                  <h4 className="text-[15px] font-bold text-[#1a1a1a]">이미지 파일 업로드</h4>
                  {imgMatchCount > 0 && (
                    <span className="ml-auto text-[13px] text-green-600 font-semibold">{imgMatchCount}개 매칭됨</span>
                  )}
                </div>

                <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors
                  ${imgMatchCount > 0 ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-gray-400 bg-gray-50"}`}>
                  {imgMatchCount > 0 ? (
                    <>
                      <span className="text-3xl">✅</span>
                      <p className="text-[14px] font-bold text-green-700">{imgFiles.length}개 파일 선택됨 · {imgMatchCount}개 상품, {imgTotalFileCount}개 이미지 매칭</p>
                      <p className="text-[12px] text-gray-400">다시 선택하려면 클릭</p>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl text-gray-300">🖼</span>
                      <p className="text-[14px] text-gray-500">이미지 파일 여러 장을 한 번에 선택 (Ctrl+A 또는 드래그 선택)</p>
                      <p className="text-[12px] text-gray-400">.jpg .jpeg .png .webp</p>
                    </>
                  )}
                  <input type="file"
                    multiple
                    className="hidden" onChange={handleFolder}
                    accept=".jpg,.jpeg,.png,.webp,image/*"
                  />
                </label>

                {/* 매칭 미리보기 */}
                {imgMatchCount > 0 && (
                  <div className="mt-3 border border-gray-100 rounded-xl divide-y divide-gray-50 max-h-40 overflow-y-auto">
                    {products.slice(0, 40).map(p => (
                      <div key={`${p.productCode}_${p.arrivalDate || "none"}`} className="flex items-center gap-3 px-4 py-2">
                        <div className="w-8 h-8 rounded bg-gray-100 shrink-0 overflow-hidden">
                          {imgPreviews[p.productCode]
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={imgPreviews[p.productCode]} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-gray-300 text-[9px]">✕</div>
                          }
                        </div>
                        <span className="text-[12px] font-mono text-gray-500 flex-1 truncate">{p.productCode}</span>
                        {imgMatches[p.productCode]
                          ? <span className="text-[11px] text-green-600 font-bold shrink-0">✓</span>
                          : <span className="text-[11px] text-gray-300 shrink-0">—</span>
                        }
                      </div>
                    ))}
                    {products.length > 40 && <p className="text-[11px] text-center text-gray-300 py-2">… 외 {products.length - 40}개</p>}
                  </div>
                )}

                {imgMatchCount > 0 && (
                  <button
                    onClick={applyImages}
                    disabled={imgUploading || imgDone}
                    className={`mt-3 w-full py-2.5 text-[14px] font-bold rounded-xl transition-colors ${
                      imgDone
                        ? "bg-green-600 text-white cursor-default"
                        : "bg-[#1a1a1a] text-white hover:bg-[#333] disabled:opacity-40"
                    }`}
                  >
                    {imgDone
                    ? "✓ 이미지 적용 완료"
                    : imgUploading
                      ? `업로드 중... (${imgProgress.done}/${imgProgress.total})`
                      : `${imgTotalFileCount}개 이미지 서버에 업로드`
                  }
                  </button>
                )}
              </div>

              {/* 구분선 */}
              <div className="border-t border-gray-100" />

              {/* ─── STEP 2: CSV ────────────────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-[#1a1a1a] text-white text-[12px] font-black flex items-center justify-center shrink-0">2</span>
                  <h4 className="text-[15px] font-bold text-[#1a1a1a]">엑셀 파일 업로드</h4>
                  <button onClick={downloadTemplate}
                    className="ml-auto text-[12px] text-blue-600 hover:text-blue-800 underline flex items-center gap-1">
                    📋 템플릿 다운로드 (.csv)
                  </button>
                </div>

                {csvResult ? (
                  <div className="border border-green-200 bg-green-50 rounded-xl p-5 text-center">
                    <p className="text-3xl font-black text-green-600">{csvResult.added}</p>
                    <p className="text-[14px] font-bold text-[#1a1a1a] mt-1">개 상품 등록 완료</p>
                    {csvResult.skipped.length > 0 && (
                      <p className="text-[12px] text-amber-600 mt-1">중복 {csvResult.skipped.length}개 건너뜀</p>
                    )}
                  </div>
                ) : (
                  <>
                    <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors
                      ${csvRows.length > 0 ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:border-gray-400 bg-gray-50"}`}>
                      {csvRows.length > 0 ? (
                        <>
                          <span className="text-2xl">📊</span>
                          <p className="text-[14px] font-bold text-blue-700">{csvRows.length}개 행 감지됨</p>
                          {imgMatchCount > 0 && (
                            <p className="text-[12px] text-green-600 font-semibold">이미지 매칭: {csvMatchStats.withImg}/{csvMatchStats.total}개</p>
                          )}
                          <p className="text-[12px] text-gray-400">다시 선택하려면 클릭</p>
                        </>
                      ) : (
                        <>
                          <span className="text-3xl text-gray-300">📋</span>
                          <p className="text-[14px] text-gray-500">CSV 파일을 클릭하여 선택</p>
                          <p className="text-[12px] text-gray-400">.csv · UTF-8 또는 BOM 포함</p>
                        </>
                      )}
                      <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCSV} />
                    </label>

                    {/* CSV 미리보기 */}
                    {csvRows.length > 0 && (
                      <div className="mt-3 border border-gray-100 rounded-xl overflow-auto max-h-48">
                        <table className="w-full text-[12px]">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left font-bold text-gray-400">코드</th>
                              <th className="px-3 py-2 text-left font-bold text-gray-400">상품명</th>
                              <th className="px-3 py-2 text-left font-bold text-gray-400">브랜드</th>
                              <th className="px-3 py-2 text-left font-bold text-gray-400">입고일</th>
                              <th className="px-3 py-2 text-left font-bold text-gray-400">상태</th>
                              <th className="px-3 py-2 text-left font-bold text-gray-400">이미지</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {csvRows.map((r, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-mono text-gray-500">{r.productCode}</td>
                                <td className="px-3 py-2 text-[#1a1a1a] font-semibold max-w-[140px] truncate">{r.productName}</td>
                                <td className="px-3 py-2 text-gray-500">{r.brand}</td>
                                <td className="px-3 py-2 text-gray-500">{r.arrivalDate}</td>
                                <td className="px-3 py-2">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_CLS[r.status as ArrivalStatus] ?? "bg-gray-100 text-gray-400"}`}>
                                    {r.status || "입고예정"}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {imgMatches[r.productCode]
                                    ? <span className="text-green-600 font-bold">✓</span>
                                    : <span className="text-gray-300">—</span>
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {csvError && <p className="text-[12px] text-red-500 mt-2">{csvError}</p>}

                    {csvRows.length > 0 && (
                      <button
                        onClick={doCSVImport}
                        disabled={csvSaving}
                        className="mt-3 w-full py-2.5 bg-[#1a1a1a] text-white text-[14px] font-bold rounded-xl disabled:opacity-40 hover:bg-[#333]"
                      >
                        {csvSaving ? "등록 중..." : `${csvRows.length}개 상품 데이터 등록`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
export default function AdminArrivalPage() {
  const [products,       setProducts]       = useState<ArrivalProduct[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [editProduct,    setEditProduct]    = useState<ArrivalProduct | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selected,       setSelected]       = useState<Set<string>>(new Set());
  const [showBulk,       setShowBulk]       = useState(false);

  // 필터
  const [q,              setQ]             = useState("");
  const [filterBrand,       setFilterBrand]      = useState("all");
  const [filterCategory,    setFilterCat]        = useState("all");
  const [filterProductType, setFilterProductType]= useState("all");
  const [filterNewArrival,  setFilterNewArrival] = useState("all");
  const [filterStatus,      setFilterStatus]     = useState("all");
  const [filterDate,        setFilterDate]       = useState("");
  const [uploadingCode,  setUploadingCode] = useState<string | null>(null);
  const [syncing,        setSyncing]       = useState(false);
  const [syncResult,     setSyncResult]    = useState<{ total: number; syncedAt: string; actor?: string } | null>(null);
  const [syncElapsed,    setSyncElapsed]   = useState<number | null>(null); // 초 단위
  const [syncHistory,    setSyncHistory]   = useState<SyncHistoryEntry[]>([]);
  const [showSyncHistory,setShowSyncHistory] = useState(false);
  const [adminName,      setAdminName]     = useState<string | null>(null);
  const syncTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncStartRef  = useRef<number>(0);

  // 관리자 이름 + 동기화 히스토리 복원
  useEffect(() => {
    fetch("/api/admin/super-check")
      .then(r => r.json())
      .then(d => { if (d.name) setAdminName(d.name); })
      .catch(() => {});
    try {
      const saved = localStorage.getItem("arrival_sync_history");
      if (saved) {
        const parsed: SyncHistoryEntry[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSyncHistory(parsed);
          const last = parsed[0];
          if (last?.syncedAt && !last.error) {
            setSyncResult({ total: last.total, syncedAt: last.syncedAt, actor: last.actor });
          }
        }
      }
    } catch { /* 무시 */ }
  }, []);

  const handleInlineImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    product: ArrivalProduct
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingCode(product.productCode);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const uploadRes = await fetch("/api/admin/arrival/images", { method: "POST", body: formData });
      const json = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) { alert(`이미지 업로드 실패\n${json.error ?? uploadRes.status}`); return; }
      const imagePath: string = json.saved?.[0] ?? `/images/arrival/${file.name}`;
      if (!json.saved?.[0]) { alert(`업로드 응답에 URL이 없습니다.\n응답: ${JSON.stringify(json)}`); return; }
      const patchRes = await fetch("/api/admin/arrival", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productCode: product.productCode, image: imagePath }),
      });
      if (patchRes.ok) {
        setProducts(prev => prev.map(p =>
          p.productCode === product.productCode ? { ...p, image: imagePath } : p
        ));
      }
    } finally {
      setUploadingCode(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 오전 8:50 이후면 오늘 입고일 상품 자동완료 트리거
      const now = new Date();
      const isPastAutoTime = now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() >= 50);
      if (isPastAutoTime) {
        fetch("/api/cron/arrival").catch(() => {});
      }

      const res = await fetch("/api/admin/arrival");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const brands       = Array.from(new Set(products.map(p => p.brand))).sort();
  const categories   = Array.from(new Set(products.map(p => p.category))).sort();
  const productTypes = Array.from(new Set(products.map(p => p.productType).filter(Boolean))).sort() as string[];
  const newArrivalTypes = Array.from(new Set(products.map(p => p.newArrivalType).filter(Boolean))).sort() as string[];

  const filtered = products.filter(p => {
    const qLow = q.toLowerCase();
    if (qLow && !p.productName.toLowerCase().includes(qLow) && !p.productCode.toLowerCase().includes(qLow) && !p.brand.toLowerCase().includes(qLow)) return false;
    if (filterBrand !== "all" && p.brand !== filterBrand) return false;
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (filterProductType !== "all" && (p.productType ?? "") !== filterProductType) return false;
    if (filterNewArrival !== "all" && (p.newArrivalType ?? "") !== filterNewArrival) return false;
    if (filterStatus === "__noimage__") { if (p.image) return false; }
    else if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterDate && p.arrivalDate !== filterDate) return false;
    return true;
  });

  const allSelected = filtered.length > 0 && filtered.every(p => selected.has(p.productCode));
  const toggleAll = () => {
    if (allSelected) {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(p => s.delete(p.productCode)); return s; });
    } else {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(p => s.add(p.productCode)); return s; });
    }
  };
  const toggleOne = (code: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(code)) s.delete(code); else s.add(code);
      return s;
    });
  };

  const handleSingleSaved = (code: string, data: Partial<ArrivalProduct>) => {
    setProducts(prev => prev.map(p => p.productCode === code ? { ...p, ...data } : p));
  };

  const handleSyncFromSheet = async () => {
    if (!confirm("구글 시트에서 전체 상품 데이터를 가져옵니다.\n기존 데이터가 시트 내용으로 교체됩니다. 계속하시겠습니까?")) return;

    const beforeSnapshot = [...products];
    setSyncing(true);
    setSyncResult(null);

    // 타이머 시작
    syncStartRef.current = Date.now();
    setSyncElapsed(0);
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    syncTimerRef.current = setInterval(() => {
      setSyncElapsed((Date.now() - syncStartRef.current) / 1000);
    }, 100);

    let entry: SyncHistoryEntry | null = null;
    try {
      const res  = await fetch("/api/admin/arrival/sync-sheet", { method: "POST" });
      const json = await res.json();
      const elapsed = (Date.now() - syncStartRef.current) / 1000;

      if (!res.ok) {
        entry = {
          id: crypto.randomUUID(),
          syncedAt: new Date().toISOString(),
          durationSec: elapsed,
          total: 0,
          byStatus: {},
          diff: [],
          error: json.error || "동기화 실패",
        };
      } else {
        const result = { total: json.total, syncedAt: json.syncedAt, actor: adminName ?? undefined };
        setSyncResult(result);
        // 목록 새로고침
        const listRes = await fetch("/api/admin/arrival");
        const data = await listRes.json();
        const newProducts: ArrivalProduct[] = Array.isArray(data) ? data : [];
        setProducts(newProducts);
        entry = {
          id: crypto.randomUUID(),
          syncedAt: json.syncedAt,
          durationSec: elapsed,
          total: json.total,
          byStatus: json.byStatus ?? {},
          diff: calcSyncDiff(beforeSnapshot, newProducts),
          actor: adminName ?? undefined,
        };
      }
    } catch (e) {
      const elapsed = (Date.now() - syncStartRef.current) / 1000;
      entry = {
        id: crypto.randomUUID(),
        syncedAt: new Date().toISOString(),
        durationSec: elapsed,
        total: 0,
        byStatus: {},
        diff: [],
        error: String(e),
      };
    } finally {
      if (syncTimerRef.current) { clearInterval(syncTimerRef.current); syncTimerRef.current = null; }
      setSyncElapsed((Date.now() - syncStartRef.current) / 1000);
      setSyncing(false);
      if (entry) {
        setSyncHistory(prev => {
          const next = [entry!, ...prev];
          try { localStorage.setItem("arrival_sync_history", JSON.stringify(next)); } catch { /* 무시 */ }
          return next;
        });
      }
    }
  };

  const handleBulkSaved = (codes: string[], data: Partial<ArrivalProduct>) => {
    setProducts(prev => prev.map(p => codes.includes(p.productCode) ? { ...p, ...data } : p));
    setSelected(new Set());
    setShowBulk(false);
  };

  const handleImageMatched = (matches: Record<string, string>) => {
    setProducts(prev => prev.map(p =>
      matches[p.productCode] ? { ...p, image: matches[p.productCode] } : p
    ));
  };

  const handleProductAdded = (p: ArrivalProduct) => {
    setProducts(prev => [p, ...prev]);
  };

  const handleCSVImported = (newProducts: ArrivalProduct[]) => {
    setProducts(prev => [...newProducts, ...prev]);
  };

  const selectedCodes = Array.from(selected);

  const stats = [
    { label: "전체",      value: products.length,                                       cls: "text-[#1a1a1a]",  filter: "all" },
    { label: "입고예정",  value: products.filter(p => p.status === "입고예정").length,  cls: "text-[#1a1a1a]",  filter: "입고예정" },
    { label: "입고완료",  value: products.filter(p => p.status === "입고완료").length,  cls: "text-green-600",  filter: "입고완료" },
    { label: "입고지연",  value: products.filter(p => p.status === "입고지연").length,  cls: "text-amber-600",  filter: "입고지연" },
    { label: "이미지 없음", value: products.filter(p => !p.image).length,               cls: "text-gray-400",   filter: "__noimage__" },
  ];

  return (
    <div className="space-y-5 max-w-[1400px]">

      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#1a1a1a]">입고 스케쥴</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* 구글 시트 동기화 */}
          <div className="flex items-center gap-3">
            {/* 완료 정보 고정 영역 — 항상 렌더링 */}
            <div className="flex flex-col items-end min-w-[110px]">
              {syncResult && !syncing ? (
                <>
                  <span className="text-[11px] tabular-nums leading-tight text-gray-500 font-medium">
                    {syncResult.total}개 완료 / {new Date(syncResult.syncedAt).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",hour12:false})}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    {syncResult.actor && (
                      <span className="text-[10px] text-gray-400">{syncResult.actor}</span>
                    )}
                    {syncResult.actor && <span className="text-[10px] text-gray-300">/</span>}
                    <button
                      onClick={() => setShowSyncHistory(true)}
                      className="text-[10px] text-gray-400 underline underline-offset-2 hover:text-gray-600"
                    >
                      {syncHistory.length > 0 ? `히스토리 ${syncHistory.length}건` : "히스토리"}
                    </button>
                  </div>
                </>
              ) : (
                <span className="text-[11px] text-gray-300 leading-tight">동기화 이력 없음</span>
              )}
            </div>

            <button
              onClick={handleSyncFromSheet}
              disabled={syncing}
              className="px-4 py-2 border border-green-300 bg-green-50 text-green-700 text-[13px] font-bold rounded-lg hover:bg-green-100 disabled:opacity-50 flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={syncing ? "animate-spin" : ""}>
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 16h5v5"/>
              </svg>
              {syncing ? "동기화 중…" : "구글 시트 동기화"}
            </button>
          </div>

          <button
            onClick={() => setShowAddProduct(true)}
            className="px-4 py-2 bg-[#1a1a1a] text-white text-[13px] font-bold rounded-lg hover:bg-[#333] flex items-center gap-1.5"
          >
            <span>＋</span> 개별 등록
          </button>
          <UploadPanel
            products={products}
            onImageMatched={handleImageMatched}
            onImported={handleCSVImported}
          />
          {selected.size > 0 && (
            <button
              onClick={() => setShowBulk(true)}
              className="px-4 py-2 border border-[#1a1a1a] text-[#1a1a1a] text-[13px] font-bold rounded-lg hover:bg-gray-50"
            >
              {selected.size}개 일괄 수정
            </button>
          )}
          <a
            href="/arrival"
            target="_blank"
            className="px-4 py-2 border border-gray-200 text-[13px] text-gray-600 rounded-lg hover:border-gray-400"
          >
            사용자 화면 →
          </a>
        </div>
      </div>

      {/* 통계 — 상단 */}
      {!loading && (
        <div className="grid grid-cols-5 gap-3">
          {stats.map(s => {
            const active = filterStatus === s.filter;
            return (
              <button
                key={s.label}
                onClick={() => setFilterStatus(active ? "all" : s.filter)}
                className={`bg-white border rounded-xl p-4 text-center w-full transition-all ${
                  active ? "border-[#1a1a1a] ring-1 ring-[#1a1a1a]" : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <p className={`text-2xl font-black ${s.cls}`}>{s.value}</p>
                <p className="text-[11px] tracking-widest text-gray-400 uppercase mt-0.5">{s.label}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* 필터 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex gap-3 flex-wrap items-center">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="상품명 / 코드 / 브랜드 검색"
          className="border border-gray-200 px-3 py-2 text-[13px] rounded-lg focus:outline-none focus:border-[#1a1a1a] w-52"
        />
        <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
          className="border border-gray-200 px-3 py-2 text-[13px] rounded-lg bg-white focus:outline-none">
          <option value="all">전체 브랜드</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={filterCategory} onChange={e => setFilterCat(e.target.value)}
          className="border border-gray-200 px-3 py-2 text-[13px] rounded-lg bg-white focus:outline-none">
          <option value="all">전체 카테고리</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterProductType} onChange={e => setFilterProductType(e.target.value)}
          className="border border-gray-200 px-3 py-2 text-[13px] rounded-lg bg-white focus:outline-none">
          <option value="all">전체 상품구분</option>
          {productTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterNewArrival} onChange={e => setFilterNewArrival(e.target.value)}
          className="border border-gray-200 px-3 py-2 text-[13px] rounded-lg bg-white focus:outline-none">
          <option value="all">전체 신상구분</option>
          {newArrivalTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-200 px-3 py-2 text-[13px] rounded-lg bg-white focus:outline-none">
          <option value="all">전체 상태</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="border border-gray-200 px-3 py-2 text-[13px] rounded-lg focus:outline-none focus:border-[#1a1a1a]"
        />
        {(q || filterBrand !== "all" || filterCategory !== "all" || filterProductType !== "all" || filterNewArrival !== "all" || filterStatus !== "all" || filterDate) ? (
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-[#1a1a1a] bg-gray-100 px-2.5 py-1 rounded-full">
              {filtered.length.toLocaleString("ko-KR")}개
            </span>
            <button onClick={() => { setQ(""); setFilterBrand("all"); setFilterCat("all"); setFilterProductType("all"); setFilterNewArrival("all"); setFilterStatus("all"); setFilterDate(""); }}
              className="text-[12px] text-gray-400 hover:text-[#1a1a1a] underline">
              초기화
            </button>
          </div>
        ) : (
          <span className="text-[12px] text-gray-400">{products.length.toLocaleString("ko-KR")}개</span>
        )}
      </div>

      {/* 테이블 */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-3 py-20 px-6 text-[14px] text-gray-400">
            <span className="w-5 h-5 border-2 border-[#1a1a1a] border-t-transparent rounded-full animate-spin" />
            불러오는 중...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      className="w-4 h-4 accent-[#1a1a1a]" />
                  </th>
                  {["상품코드","상품명","브랜드","카테고리","상품구분","신상구분","공급가","판매가","수량","컬러","입고일","상태",""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[12px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p, i) => {
                  const meta = STATUS_CLS[p.status] ?? STATUS_CLS["입고예정"];
                  return (
                    <tr key={`${p.productCode}_${p.arrivalDate || "none"}_${i}`} className={`hover:bg-gray-50/70 ${selected.has(p.productCode) ? "bg-blue-50/30" : ""}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(p.productCode)} onChange={() => toggleOne(p.productCode)}
                          className="w-4 h-4 accent-[#1a1a1a]" />
                      </td>
                      <td className="px-4 py-3 text-[12px] font-mono text-gray-500 whitespace-nowrap">{p.productCode}</td>
                      <td className="px-4 py-3 min-w-[220px]">
                        <div className="flex items-center gap-3">
                          <label className="cursor-pointer shrink-0 relative group">
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={e => handleInlineImageUpload(e, p)}
                            />
                            {uploadingCode === p.productCode ? (
                              <div className="w-10 h-10 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center animate-pulse">
                                <span className="text-[8px] text-gray-400">...</span>
                              </div>
                            ) : p.image ? (
                              <div className="w-10 h-10 rounded-md overflow-hidden bg-[#edebe8] border border-gray-100 relative">
                                <img
                                  src={p.image.split(",")[0].trim()}
                                  alt={p.productName}
                                  className="w-full h-full object-cover"
                                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                  <span className="text-white text-[8px] font-bold opacity-0 group-hover:opacity-100 leading-none">변경</span>
                                </div>
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-md border-2 border-dashed border-gray-300 group-hover:border-[#1a1a1a] transition-colors flex items-center justify-center">
                                <span className="text-[14px] text-gray-300 group-hover:text-[#1a1a1a] leading-none">+</span>
                              </div>
                            )}
                          </label>
                          <span className="text-[13px] font-semibold text-[#1a1a1a]">{p.productName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-gray-600 whitespace-nowrap">{p.brand}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-600 whitespace-nowrap">{p.category}</td>
                      <td className="px-4 py-3 text-[12px] text-gray-500 whitespace-nowrap">{p.productType || "—"}</td>
                      <td className="px-4 py-3 text-[12px] text-gray-500 whitespace-nowrap">{p.newArrivalType || "—"}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-500 whitespace-nowrap tabular-nums">{p.supplyPrice ? fmtPrice(p.supplyPrice) : "—"}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-600 whitespace-nowrap tabular-nums">{fmtPrice(p.price)}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-600 whitespace-nowrap tabular-nums">{p.quantity != null && p.quantity > 0 ? p.quantity.toLocaleString("ko-KR") : "—"}</td>
                      <td className="px-4 py-3 text-[12px] text-gray-500 max-w-[120px] truncate">{p.color}</td>
                      <td className="px-4 py-3 text-[13px] font-mono text-gray-600 whitespace-nowrap">
                        {p.arrivalDate || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${meta}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => setEditProduct(p)}
                          className="text-[12px] text-gray-400 hover:text-[#1a1a1a] border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-400 transition-colors"
                        >
                          수정
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="py-20 text-center text-[14px] text-gray-400">
                조건에 맞는 상품이 없습니다.
              </div>
            )}
          </div>
        )}
      </div>

      {/* 동기화 히스토리 패널 */}
      {showSyncHistory && (() => {
        const today = new Date().toLocaleDateString("ko-KR", { year:"numeric", month:"2-digit", day:"2-digit" }).replace(/\. /g,"-").replace(".","");
        const todayEntries  = syncHistory.filter(e => {
          const d = new Date(e.syncedAt).toLocaleDateString("ko-KR", { year:"numeric", month:"2-digit", day:"2-digit" }).replace(/\. /g,"-").replace(".","");
          return d === today;
        });
        const pastEntries   = syncHistory.filter(e => {
          const d = new Date(e.syncedAt).toLocaleDateString("ko-KR", { year:"numeric", month:"2-digit", day:"2-digit" }).replace(/\. /g,"-").replace(".","");
          return d !== today;
        });
        const pastByDate: Record<string, SyncHistoryEntry[]> = {};
        for (const e of pastEntries) {
          const d = new Date(e.syncedAt).toLocaleDateString("ko-KR", { year:"numeric", month:"2-digit", day:"2-digit" });
          if (!pastByDate[d]) pastByDate[d] = [];
          pastByDate[d].push(e);
        }
        const pastDates = Object.keys(pastByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        const renderEntry = (entry: SyncHistoryEntry, ei: number, total: number) => {
                const added   = entry.diff.filter(d => d.type === "added");
                const removed = entry.diff.filter(d => d.type === "removed");
                const changed = entry.diff.filter(d => d.type === "changed");
                const STATUS_ORDER = ["입고예정","입고완료","입고지연","일정미정","대기","일정미표기"];
                return (
                  <div key={entry.id} className={`px-6 py-5 ${ei < total - 1 ? "border-b" : ""}`}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[13px] font-bold text-[#1a1a1a]">
                          {new Date(entry.syncedAt).toLocaleString("ko-KR", {
                            hour:"2-digit", minute:"2-digit", second:"2-digit", hour12: false,
                          })}
                        </span>
                        <span className="ml-2 text-[11px] text-gray-400 font-mono">{fmtElapsed(entry.durationSec)}</span>
                        {entry.actor && <span className="ml-2 text-[11px] text-gray-400">{entry.actor}</span>}
                        {entry.error && (
                          <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full">오류</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {!entry.error && <span className="text-[11px] text-gray-500 font-medium">총 {entry.total}개</span>}
                        {added.length > 0   && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-full">+{added.length} 추가</span>}
                        {removed.length > 0 && <span className="px-2 py-0.5 bg-red-100    text-red-600    text-[11px] font-bold rounded-full">−{removed.length} 삭제</span>}
                        {changed.length > 0 && <span className="px-2 py-0.5 bg-amber-100  text-amber-700  text-[11px] font-bold rounded-full">↻{changed.length} 변경</span>}
                        {entry.diff.length === 0 && !entry.error && <span className="text-[11px] text-gray-400">변경 없음</span>}
                      </div>
                    </div>
                    {entry.error && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-[12px] text-red-700 font-mono mb-3 break-all">{entry.error}</div>
                    )}
                    {Object.keys(entry.byStatus).length > 0 && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 px-3 py-2 bg-gray-50 rounded-lg">
                        {STATUS_ORDER.filter(s => entry.byStatus[s]).map(s => (
                          <span key={s} className="text-[11px] text-gray-600">
                            <span className="text-gray-400 mr-1">{s}</span>
                            <span className="font-bold">{entry.byStatus[s]}개</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {added.length > 0 && (
                      <div className="mb-4">
                        <div className="text-[11px] font-bold text-emerald-700 mb-1.5 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                          신규 추가 {added.length}건
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-emerald-100">
                          <table className="w-full text-[12px] border-collapse">
                            <thead><tr className="bg-emerald-50 text-emerald-800 text-[11px]">
                              <th className="text-left px-3 py-1.5 font-semibold border-b border-emerald-100 w-7">#</th>
                              <th className="text-left px-3 py-1.5 font-semibold border-b border-emerald-100">상품코드</th>
                              <th className="text-left px-3 py-1.5 font-semibold border-b border-emerald-100">브랜드</th>
                              <th className="text-left px-3 py-1.5 font-semibold border-b border-emerald-100">상품명</th>
                              <th className="text-left px-3 py-1.5 font-semibold border-b border-emerald-100">입고일</th>
                              <th className="text-left px-3 py-1.5 font-semibold border-b border-emerald-100">상태</th>
                            </tr></thead>
                            <tbody className="divide-y divide-emerald-50">
                              {added.map((d, di) => (
                                <tr key={di} className="hover:bg-emerald-50/50">
                                  <td className="px-3 py-2 text-gray-400">{di + 1}</td>
                                  <td className="px-3 py-2 font-mono text-[11px] text-gray-500 whitespace-nowrap">{d.productCode}</td>
                                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{d.snapshot?.brand || "—"}</td>
                                  <td className="px-3 py-2 text-gray-800 max-w-[160px]"><span className="block truncate">{d.productName}</span></td>
                                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap font-mono text-[11px]">{d.snapshot?.arrivalDate || "—"}</td>
                                  <td className="px-3 py-2 whitespace-nowrap"><span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">{d.snapshot?.status || "—"}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {changed.length > 0 && (
                      <div className="mb-4">
                        <div className="text-[11px] font-bold text-amber-700 mb-1.5 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                          변경 {changed.length}건
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-amber-100">
                          <table className="w-full text-[12px] border-collapse">
                            <thead><tr className="bg-amber-50 text-amber-800 text-[11px]">
                              <th className="text-left px-3 py-1.5 font-semibold border-b border-amber-100 w-7">#</th>
                              <th className="text-left px-3 py-1.5 font-semibold border-b border-amber-100">상품코드</th>
                              <th className="text-left px-3 py-1.5 font-semibold border-b border-amber-100">상품명</th>
                              <th className="text-left px-3 py-1.5 font-semibold border-b border-amber-100">변경 항목</th>
                            </tr></thead>
                            <tbody className="divide-y divide-amber-50">
                              {changed.map((d, di) => (
                                <tr key={di} className="hover:bg-amber-50/40">
                                  <td className="px-3 py-2 text-gray-400 align-top">{di + 1}</td>
                                  <td className="px-3 py-2 font-mono text-[11px] text-gray-500 whitespace-nowrap align-top">{d.productCode}</td>
                                  <td className="px-3 py-2 text-gray-800 max-w-[160px] align-top"><span className="block truncate">{d.productName}</span></td>
                                  <td className="px-3 py-2 align-top">
                                    <div className="flex flex-col gap-1">
                                      {d.changes?.map((c, ci) => (
                                        <div key={ci} className="flex items-baseline gap-1.5 text-[11px] flex-wrap">
                                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold whitespace-nowrap shrink-0">{c.field}</span>
                                          <span className="line-through text-red-400 whitespace-nowrap">{c.before}</span>
                                          <span className="text-gray-400">→</span>
                                          <span className="text-emerald-600 font-medium whitespace-nowrap">{c.after}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {removed.length > 0 && (
                      <div className="mb-2">
                        <div className="text-[11px] font-bold text-red-600 mb-1.5 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                          삭제 {removed.length}건
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-red-100">
                          <table className="w-full text-[12px] border-collapse">
                            <thead><tr className="bg-red-50 text-red-800 text-[11px]">
                              <th className="text-left px-3 py-1.5 font-semibold border-b border-red-100 w-7">#</th>
                              <th className="text-left px-3 py-1.5 font-semibold border-b border-red-100">상품코드</th>
                              <th className="text-left px-3 py-1.5 font-semibold border-b border-red-100">상품명</th>
                              <th className="text-left px-3 py-1.5 font-semibold border-b border-red-100">상태</th>
                            </tr></thead>
                            <tbody className="divide-y divide-red-50">
                              {removed.map((d, di) => (
                                <tr key={di} className="hover:bg-red-50/50 opacity-70">
                                  <td className="px-3 py-2 text-gray-400">{di + 1}</td>
                                  <td className="px-3 py-2 font-mono text-[11px] text-gray-500 whitespace-nowrap">{d.productCode}</td>
                                  <td className="px-3 py-2 text-gray-700 max-w-[160px]"><span className="block truncate">{d.productName}</span></td>
                                  <td className="px-3 py-2 whitespace-nowrap"><span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">{d.snapshot?.status || "—"}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              };

        return (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowSyncHistory(false)} />
          <div className="relative bg-white shadow-2xl w-full max-w-3xl h-full flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div>
                <h2 className="text-[15px] font-bold text-[#1a1a1a]">동기화 히스토리</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">누적 기록 · {syncHistory.length}건</p>
              </div>
              <button onClick={() => setShowSyncHistory(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">✕</button>
            </div>

            {/* 목록 */}
            <div className="overflow-y-auto flex-1">
              {syncHistory.length === 0 && (
                <div className="py-20 text-center text-[13px] text-gray-400">동기화 기록이 없습니다.</div>
              )}

              {/* 오늘 */}
              {todayEntries.length > 0 && (
                <div>
                  <div className="px-6 py-2 bg-blue-50 border-b border-blue-100 sticky top-0 z-10">
                    <span className="text-[11px] font-bold text-blue-700 tracking-widest uppercase">오늘 · {todayEntries.length}건</span>
                  </div>
                  {todayEntries.map((entry, ei) => renderEntry(entry, ei, todayEntries.length))}
                </div>
              )}

              {/* 과거 - 날짜별 그룹 */}
              {pastDates.map(date => (
                <div key={date}>
                  <div className="px-6 py-2 bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                    <span className="text-[11px] font-bold text-gray-500 tracking-widest">{date} · {pastByDate[date].length}건</span>
                  </div>
                  {pastByDate[date].map((entry, ei) => renderEntry(entry, ei, pastByDate[date].length))}
                </div>
              ))}
            </div>
          </div>
        </div>
        );
      })()}

      {/* 단일 수정 모달 */}
      {editProduct && (
        <EditModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSaved={(data) => { handleSingleSaved(editProduct.productCode, data); }}
        />
      )}

      {/* 개별 등록 모달 */}
      {showAddProduct && (
        <AddProductModal
          onClose={() => setShowAddProduct(false)}
          onAdded={handleProductAdded}
        />
      )}

      {/* 일괄 수정 패널 */}
      {showBulk && selectedCodes.length > 0 && (
        <BulkPanel
          selected={selectedCodes}
          onSaved={handleBulkSaved}
          onClose={() => setShowBulk(false)}
        />
      )}
    </div>
  );
}
