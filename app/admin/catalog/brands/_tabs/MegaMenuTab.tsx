"use client";
import { useState, useEffect, useRef } from "react";
import { oxanium } from "@/lib/oxanium";
import { buildDefaultBrands, DEFAULT_MEGA_SETTINGS } from "@/lib/mega-brands-defaults";
import type { MegaBrandItem, MegaBrandsConfig, MegaMenuSettings } from "@/lib/mega-brands-types";



// ── 작은 카드 미리보기 ─────────────────────────────────────────────────────
function MiniCardPreview({ brand }: { brand: MegaBrandItem }) {
  const bg = brand.megaMenuImage
    ? `url('${brand.megaMenuImage}') center top / cover no-repeat`
    : "#1c1c1c";

  return (
    <div
      className="rounded overflow-hidden flex flex-col text-white"
      style={{ background: "#0f0f0f", width: "160px", height: "220px", flexShrink: 0 }}
    >
      <div style={{ padding: "12px 10px 8px" }}>
        <p
          className={`${oxanium.className} text-white leading-tight mb-2`}
          style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em" }}
        >
          {brand.name || "—"}
        </p>
        <p
          className="uppercase leading-tight mb-1.5"
          style={{ fontSize: "7px", letterSpacing: "0.12em", color: "rgba(255,255,255,0.6)" }}
        >
          {brand.positioning || "—"}
        </p>
        <p style={{ fontSize: "9px", lineHeight: 1.6, color: "rgba(255,255,255,0.5)" }}>
          {brand.descriptionKo || "—"}
        </p>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: bg }} />
        {!brand.megaMenuImage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white/20 text-[10px]">이미지 없음</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function MegaMenuTab() {
  const [brands, setBrands] = useState<MegaBrandItem[]>([]);
  const [settings, setSettings] = useState<MegaMenuSettings>(DEFAULT_MEGA_SETTINGS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/site-settings/mega_menu_brands")
      .then(r => r.json())
      .then((data: MegaBrandsConfig | null) => {
        if (data?.brands?.length && data?.settings) {
          setBrands(data.brands);
          setSettings(data.settings);
          setSelectedId(data.brands[0].id);
        } else {
          const defaults = buildDefaultBrands();
          setBrands(defaults);
          setSettings(DEFAULT_MEGA_SETTINGS);
          setSelectedId(defaults[0].id);
        }
      })
      .catch(() => {
        const defaults = buildDefaultBrands();
        setBrands(defaults);
        setSettings(DEFAULT_MEGA_SETTINGS);
        setSelectedId(defaults[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedBrand = brands.find(b => b.id === selectedId) ?? null;

  function updateBrand(id: string, patch: Partial<MegaBrandItem>) {
    setBrands(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0] || !selectedId) return;
    const file = e.target.files[0];
    if (file.size > 4 * 1024 * 1024) {
      alert("이미지는 4MB 이하만 업로드 가능합니다.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (json.url) updateBrand(selectedId, { megaMenuImage: json.url });
    } catch {
      alert("업로드 실패. 다시 시도해주세요.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const config: MegaBrandsConfig = {
        brands: brands.map((b, i) => ({ ...b, sortOrder: i })),
        settings,
      };
      const res = await fetch("/api/admin/site-settings/mega_menu_brands", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error();
      setSavedMsg("저장되었습니다");
      setTimeout(() => setSavedMsg(""), 2500);
    } catch {
      alert("저장 실패. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  // Drag-to-reorder
  function onDragStart(idx: number) { setDragIdx(idx); }
  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
    if (dragIdx === null || dragIdx === idx) return;
    setBrands(prev => {
      const next = [...prev];
      const [item] = next.splice(dragIdx, 1);
      next.splice(idx, 0, item);
      return next;
    });
    setDragIdx(idx);
  }
  function onDragEnd() { setDragIdx(null); setDragOverIdx(null); }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        로딩 중…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── 상단 툴바 ── */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <h1 className="text-[15px] font-bold text-gray-800">브랜드 관리 — 메가메뉴</h1>
        <div className="flex items-center gap-3">
          {savedMsg && (
            <span className="text-[12px] text-green-600 font-medium">{savedMsg}</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-[#E5541B] text-white text-[13px] font-semibold rounded hover:brightness-95 disabled:opacity-50 transition"
          >
            {saving ? "저장 중…" : "전체 저장"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── 왼쪽 패널: 브랜드 목록 + 전역설정 ── */}
        <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">

          {/* 브랜드 목록 */}
          <div className="px-4 pt-4 pb-2">
            <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-2">브랜드 순서</p>
            <p className="text-[11px] text-gray-400 mb-3">드래그로 순서 변경</p>
          </div>
          <ul className="px-3 pb-4 space-y-1">
            {brands.map((b, idx) => (
              <li
                key={b.id}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={e => onDragOver(e, idx)}
                onDragEnd={onDragEnd}
                onClick={() => setSelectedId(b.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer select-none transition-colors ${
                  selectedId === b.id
                    ? "bg-[#E5541B]/10 border border-[#E5541B]/30"
                    : "hover:bg-gray-50 border border-transparent"
                } ${dragOverIdx === idx ? "ring-1 ring-[#E5541B]" : ""}`}
              >
                {/* 드래그 핸들 */}
                <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 cursor-grab" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                  <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                  <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                </svg>
                <span className="text-[10px] text-gray-400 font-mono flex-shrink-0 w-4">{idx + 1}</span>
                <span className="text-[12px] font-semibold text-gray-700 tracking-wide flex-1 truncate">{b.name}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    b.megaMenuVisible && b.status === "active" ? "bg-green-400" : "bg-gray-300"
                  }`}
                />
              </li>
            ))}
          </ul>

          {/* ── 전역 메가메뉴 설정 ── */}
          <div className="border-t border-gray-200 px-4 py-4">
            <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-3">전역 설정</p>

            <label className="flex items-center justify-between mb-3">
              <span className="text-[12px] text-gray-600 font-medium">메가메뉴 활성화</span>
              <button
                onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
                className={`relative w-9 h-5 rounded-full transition-colors ${settings.enabled ? "bg-[#E5541B]" : "bg-gray-300"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.enabled ? "translate-x-4" : ""}`}
                />
              </button>
            </label>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-gray-400 font-medium">헤딩 텍스트</label>
                <input
                  value={settings.heading}
                  onChange={e => setSettings(s => ({ ...s, heading: e.target.value }))}
                  className="mt-0.5 w-full text-[12px] border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#E5541B]"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-medium">본문 텍스트 (줄바꿈: \n)</label>
                <textarea
                  value={settings.body}
                  onChange={e => setSettings(s => ({ ...s, body: e.target.value }))}
                  rows={3}
                  className="mt-0.5 w-full text-[12px] border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#E5541B] resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-medium">CTA 라벨</label>
                <input
                  value={settings.ctaLabel}
                  onChange={e => setSettings(s => ({ ...s, ctaLabel: e.target.value }))}
                  className="mt-0.5 w-full text-[12px] border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#E5541B]"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-medium">CTA URL</label>
                <input
                  value={settings.ctaUrl}
                  onChange={e => setSettings(s => ({ ...s, ctaUrl: e.target.value }))}
                  className="mt-0.5 w-full text-[12px] border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#E5541B]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 오른쪽 패널: 선택된 브랜드 편집 ── */}
        {selectedBrand ? (
          <div className="flex-1 overflow-y-auto bg-gray-50">
            <div className="max-w-3xl mx-auto p-6 space-y-6">

              {/* 미리보기 + 편집 상단 */}
              <div className="flex gap-6 items-start">
                <MiniCardPreview brand={selectedBrand} />
                <div className="flex-1 space-y-4">
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h2 className="text-[13px] font-bold text-gray-700 mb-3">기본 정보</h2>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-gray-500 font-medium">브랜드명</label>
                        <input
                          value={selectedBrand.name}
                          onChange={e => updateBrand(selectedBrand.id, { name: e.target.value })}
                          className="mt-0.5 w-full text-[13px] border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#E5541B]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 font-medium">상태</label>
                        <select
                          value={selectedBrand.status}
                          onChange={e => updateBrand(selectedBrand.id, { status: e.target.value as "active" | "inactive" })}
                          className="mt-0.5 w-full text-[13px] border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#E5541B] bg-white"
                        >
                          <option value="active">활성</option>
                          <option value="inactive">비활성</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 font-medium">포지셔닝 (영문)</label>
                        <input
                          value={selectedBrand.positioning}
                          onChange={e => updateBrand(selectedBrand.id, { positioning: e.target.value })}
                          className="mt-0.5 w-full text-[13px] border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#E5541B]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 font-medium">링크 URL</label>
                        <input
                          value={selectedBrand.href}
                          onChange={e => updateBrand(selectedBrand.id, { href: e.target.value })}
                          className="mt-0.5 w-full text-[13px] border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#E5541B]"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[11px] text-gray-500 font-medium">한글 설명</label>
                        <input
                          value={selectedBrand.descriptionKo}
                          onChange={e => updateBrand(selectedBrand.id, { descriptionKo: e.target.value })}
                          className="mt-0.5 w-full text-[13px] border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#E5541B]"
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* 이미지 설정 */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-[13px] font-bold text-gray-700">메가메뉴 이미지</h2>
                  <span className="text-[11px] text-gray-400">권장: <strong className="text-gray-600">세로형 2:3</strong> (예: 800×1200px) · 최대 4MB · 상단 기준 정렬</span>
                </div>
                <div className="flex gap-4 items-start">
                  {/* 현재 이미지 */}
                  <div
                    className="flex-shrink-0 rounded overflow-hidden border border-gray-200"
                    style={{ width: "80px", height: "120px" }}
                  >
                    {selectedBrand.megaMenuImage ? (
                      <div
                        className="w-full h-full"
                        style={{
                          background: `url('${selectedBrand.megaMenuImage}') center top / cover no-repeat`,
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <span className="text-[9px] text-gray-400 text-center leading-relaxed">이미지<br />없음</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-3">
                    {/* 업로드 버튼 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id={`upload-${selectedBrand.id}`}
                      />
                      <label
                        htmlFor={`upload-${selectedBrand.id}`}
                        className="px-3 py-1.5 bg-gray-800 text-white text-[12px] font-medium rounded cursor-pointer hover:bg-gray-700 transition"
                      >
                        {uploading ? "업로드 중…" : "이미지 업로드"}
                      </label>
                      {selectedBrand.megaMenuImage && (
                        <button
                          onClick={() => updateBrand(selectedBrand.id, { megaMenuImage: "" })}
                          className="px-3 py-1.5 text-[12px] text-red-500 border border-red-200 rounded hover:bg-red-50 transition"
                        >
                          이미지 제거
                        </button>
                      )}
                    </div>

                    {/* URL 직접 입력 */}
                    <div>
                      <label className="text-[11px] text-gray-500 font-medium">또는 URL 직접 입력</label>
                      <input
                        value={selectedBrand.megaMenuImage}
                        onChange={e => updateBrand(selectedBrand.id, { megaMenuImage: e.target.value })}
                        placeholder="https://..."
                        className="mt-0.5 w-full text-[12px] border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#E5541B]"
                      />
                    </div>

                  </div>
                </div>
              </div>

              {/* 저장 버튼 (하단 반복) */}
              <div className="flex justify-end pb-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-[#E5541B] text-white text-[13px] font-semibold rounded hover:brightness-95 disabled:opacity-50 transition"
                >
                  {saving ? "저장 중…" : "전체 저장"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            왼쪽 목록에서 브랜드를 선택하세요
          </div>
        )}

      </div>
    </div>
  );
}
