"use client";
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { EMPTY_BRAND, type Brand } from "@/data/brands";
import { EMPTY_BRAND_CATALOG, type BrandCatalog } from "@/data/brandCatalogs";
import AssembledCatalogTab from "@/components/admin/AssembledCatalogTab";
import type { CatalogPagesSummary } from "@/data/catalog";

// ── 탭 타입 ──────────────────────────────────────────────────
type Tab = "info" | "catalog" | "assembled";

// ── 유틸 ─────────────────────────────────────────────────────
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function UnifiedBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [catalogs, setCatalogs] = useState<BrandCatalog[]>([]);
  const [assembled, setAssembled] = useState<CatalogPagesSummary>({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("info");
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [togglingVis, setTogglingVis] = useState(false);
  const [seasonInput, setSeasonInput] = useState("");
  const [applyingSeasonBulk, setApplyingSeasonBulk] = useState(false);
  const [sortMode, setSortMode] = useState<"order" | "alpha" | "date">("date");
  const [visFilter, setVisFilter] = useState<"all" | "visible" | "hidden">("visible");
  const [showAddModal, setShowAddModal] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // ── 데이터 로드 ───────────────────────────────────────────
  const loadBrands = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const [br, ca, asm] = await Promise.all([
        fetch("/api/admin/brands").then((r) => r.json()),
        fetch("/api/admin/brand-catalogs").then((r) => r.json()),
        fetch("/api/admin/catalog?summary=1").then((r) => r.json()).catch(() => ({})),
      ]);
      if (br?.error) { setFetchError(br.error); setLoading(false); return; }
      setBrands(Array.isArray(br) ? br : []);
      setCatalogs(Array.isArray(ca) ? ca : []);
      setAssembled(asm && typeof asm === "object" && !asm.error ? asm : {});
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadBrands(); }, [loadBrands]);

  const flash = (text: string, type = "ok") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 3500);
  };

  // ── 브랜드 선택 ───────────────────────────────────────────
  const selectBrand = (b: Brand) => {
    setSelectedId(String(b.id));
    setEditing({ ...b });
    setIsNew(false);
    setTab("info");
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const openNew = () => {
    const draft: Brand = { id: "", ...EMPTY_BRAND, sort_order: brands.length };
    setEditing(draft);
    setSelectedId(null);
    setIsNew(true);
    setTab("info");
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const set = <K extends keyof Brand>(key: K, value: Brand[K]) =>
    setEditing((prev) => (prev ? { ...prev, [key]: value } : prev));

  // ── 저장 ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { flash("브랜드명을 입력하세요.", "err"); return; }
    const id = isNew ? (String(editing.id).trim() || slugify(editing.name)) : editing.id;
    if (!id) { flash("ID(슬러그)를 입력하세요.", "err"); return; }
    setSaving(true);
    const payload = { ...editing, id };
    const url = isNew ? "/api/admin/brands" : `/api/admin/brands/${editing.id}`;
    const method = isNew ? "POST" : "PUT";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (res.ok) {
      flash("저장됐습니다.");
      await loadBrands();
      if (isNew) { setSelectedId(String(id)); setIsNew(false); }
    } else {
      const err = await res.json().catch(() => ({}));
      flash(err.error ?? "저장 실패", "err");
    }
  };

  // ── 삭제 ──────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!editing || isNew) return;
    if (!confirm(`"${editing.name}" 브랜드를 삭제할까요? 카탈로그는 별도 삭제가 필요합니다.`)) return;
    const res = await fetch(`/api/admin/brands/${editing.id}`, { method: "DELETE" });
    if (res.ok) { flash("삭제됐습니다."); setEditing(null); setSelectedId(null); loadBrands(); }
    else { const e = await res.json().catch(() => ({})); flash(e.error ?? "삭제 실패", "err"); }
  };

  // ── 드래그 정렬 ───────────────────────────────────────────
  const handleDrop = async (target: number) => {
    if (dragIndex === null || dragIndex === target) { setDragIndex(null); setDragOver(null); return; }
    const next = [...brands];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(target, 0, moved);
    const updated = next.map((b, i) => ({ ...b, sort_order: i }));
    setBrands(updated);
    setDragIndex(null); setDragOver(null);
    await Promise.all(updated.map((b) =>
      fetch(`/api/admin/brands/${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sort_order: b.sort_order }) })
    ));
  };

  // ── 체크박스 선택 ─────────────────────────────────────────
  const toggleCheck = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCheckAll = () => {
    if (checkedIds.size === brands.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(brands.map((b) => String(b.id))));
    }
  };

  const handleBulkDelete = async () => {
    if (checkedIds.size === 0) return;
    const ids = [...checkedIds];
    const count = ids.length;
    if (!confirm(`선택된 브랜드 ${count}개를 삭제할까요?`)) return;
    setDeletingBulk(true);
    await Promise.all(ids.map((id) =>
      fetch(`/api/admin/brands/${id}`, { method: "DELETE" })
    ));
    setDeletingBulk(false);
    setCheckedIds(new Set());
    if (editing && ids.includes(String(editing.id))) { setEditing(null); setSelectedId(null); }
    await loadBrands();
    flash(`${count}개 삭제됐습니다.`);
  };

  // ── 노출 토글 ─────────────────────────────────────────────
  const toggleVisible = async (b: Brand) => {
    const next = !b.is_visible;
    setBrands((prev) => prev.map((x) => x.id === b.id ? { ...x, is_visible: next } : x));
    await fetch(`/api/admin/brands/${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_visible: next }) });
  };

  // 선택한 브랜드 일괄 노출/비노출
  const bulkSetVisible = async (next: boolean) => {
    const ids = [...checkedIds];
    if (ids.length === 0) return;
    setTogglingVis(true);
    const idSet = new Set(ids);
    setBrands((prev) => prev.map((x) => (idSet.has(String(x.id)) ? { ...x, is_visible: next } : x)));
    await Promise.all(ids.map((id) =>
      fetch(`/api/admin/brands/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_visible: next }) })
    ));
    setTogglingVis(false);
    setCheckedIds(new Set());
    flash(`${ids.length}개 브랜드를 ${next ? "노출" : "비노출"}로 변경했습니다.`);
  };

  // 선택한 브랜드들의 카탈로그에 시즌 일괄 적용
  const applySeasonBulk = async () => {
    const season = seasonInput.trim();
    if (!season) { flash("시즌 문구를 입력하세요.", "err"); return; }
    if (checkedIds.size === 0) { flash("브랜드를 선택하세요.", "err"); return; }
    setApplyingSeasonBulk(true);
    try {
      const res = await fetch("/api/admin/catalog/apply-season", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season, brand_ids: [...checkedIds] }),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.error ?? "오류가 발생했습니다.", "err"); }
      else if (data.updated === 0) { flash(data.message ?? "적용할 페이지가 없습니다."); }
      else { flash(`"${season}" 시즌을 ${data.updated}개 페이지에 적용했습니다.`); }
    } catch {
      flash("요청 실패", "err");
    }
    setApplyingSeasonBulk(false);
  };

  // ── 브랜드별 최신 카탈로그 날짜 맵 ──────────────────────────
  const latestCatalogDateMap = catalogs.reduce<Record<string, string>>((acc, c) => {
    const key = c.brand_name.toLowerCase();
    if (!acc[key] || (c.created_at && c.created_at > acc[key])) {
      acc[key] = c.created_at ?? "";
    }
    return acc;
  }, {});

  const fmtDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}.${mm}.${dd}`;
  };
  const formatCatalogDate = (brandName: string) => fmtDate(latestCatalogDateMap[brandName.toLowerCase()]);

  // PDF 최신일 + 조립형 최신 저장일 중 더 최근(ISO 문자열) — "업로드일자" 정렬·표시용
  const brandUploadISO = (b: Brand): string => {
    const pdf = latestCatalogDateMap[(b.name || "").toLowerCase()] ?? "";
    const asm = (b.catalog_enabled && assembled[String(b.id)]?.latest) || "";
    return pdf > asm ? pdf : asm;
  };

  // ── 정렬된 브랜드 목록 ───────────────────────────────────
  const sortedBrands = (() => {
    if (sortMode === "alpha") {
      return [...brands].sort((a, b) => {
        const aLabel = (a.name_ko || a.name || "").toLowerCase();
        const bLabel = (b.name_ko || b.name || "").toLowerCase();
        return aLabel.localeCompare(bLabel, "ko");
      });
    }
    if (sortMode === "date") {
      return [...brands].sort((a, b) => {
        const aDate = brandUploadISO(a);
        const bDate = brandUploadISO(b);
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return bDate.localeCompare(aDate); // 최신순
      });
    }
    return brands; // "order" — 드래그 순서 유지
  })();

  // 노출/비노출 필터 (드래그 정렬은 필터가 걸리면 인덱스가 어긋나므로 "전체"에서만 허용)
  const canDrag = sortMode === "order" && visFilter === "all";
  const displayBrands = sortedBrands.filter((b) => {
    if (visFilter === "visible") return b.is_visible !== false;
    if (visFilter === "hidden") return b.is_visible === false;
    return true;
  });
  const hiddenCount = brands.filter((b) => b.is_visible === false).length;

  const showAllVisible = async () => {
    const targets = displayBrands.filter((b) => b.is_visible === false);
    if (targets.length === 0) return;
    if (!confirm(`비노출 브랜드 ${targets.length}개를 모두 노출로 바꿀까요?`)) return;
    setTogglingVis(true);
    const ids = new Set(targets.map((t) => String(t.id)));
    setBrands((prev) => prev.map((x) => (ids.has(String(x.id)) ? { ...x, is_visible: true } : x)));
    await Promise.all(
      targets.map((b) =>
        fetch(`/api/admin/brands/${b.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_visible: true }),
        }),
      ),
    );
    setTogglingVis(false);
    flash(`${targets.length}개 브랜드를 노출로 변경했습니다.`);
  };

  // ── 이 브랜드의 카탈로그 ──────────────────────────────────
  const brandCatalogs = editing
    ? catalogs.filter((c) => c.brand_name.toLowerCase() === editing.name.toLowerCase())
    : [];

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">브랜드 통합 관리</h1>
          <p className="text-base text-gray-400 mt-1">브랜드 정보 · 메가메뉴 이미지 · 카탈로그를 한 곳에서 관리합니다 <span className="font-semibold text-gray-600">전체 {brands.length}개</span> · <span className="font-semibold text-green-600">노출 {brands.filter((b) => b.is_visible !== false).length}개</span></p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            브랜드 등록
          </button>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            카탈로그 브랜드 추가
          </button>
        </div>
      </div>

      {/* 브랜드 등록 팝업 */}
      {showAddModal && (
        <QuickAddModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); loadBrands(); flash("브랜드가 등록됐습니다."); }}
        />
      )}

      {msg.text && (
        <div className={`mb-5 px-4 py-3 text-sm rounded-lg font-medium ${msg.type === "err" ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
          {msg.text}
        </div>
      )}

      {fetchError && (
        <div className="mb-6 p-5 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm font-semibold text-amber-800 mb-2">⚠ brands 테이블을 읽지 못했습니다.</p>
          <div className="mb-3 px-3 py-2 bg-white border border-red-200 rounded text-xs text-red-600 font-mono break-all">{fetchError}</div>
          <p className="text-xs text-amber-700 mb-2">supabase/migrate_add_brands_table.sql 을 Supabase SQL Editor에서 실행하세요.</p>
        </div>
      )}

      <div className="flex gap-6 items-start">
        {/* ── 왼쪽: 브랜드 목록 ── */}
        <div className={`flex-shrink-0 sticky top-6 transition-all duration-200 ${listCollapsed ? "w-[44px]" : "w-[380px]"}`}>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col" style={listCollapsed ? {} : { maxHeight: "calc(80vh - 160px)" }}>
            {/* 목록 헤더 */}
            <div className={`border-b border-slate-100 flex-shrink-0 ${listCollapsed ? "px-2 py-3" : "px-4 py-3"}`}>
              <div className={`flex items-center justify-between ${listCollapsed ? "" : "mb-2"}`}>
                {listCollapsed ? (
                  <div className="flex flex-col items-center w-full gap-2">
                    <button onClick={() => setListCollapsed(false)}
                      title="목록 펼치기"
                      className="p-1.5 rounded-md border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors">
                      <svg className="w-3.5 h-3.5 rotate-180" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-[10px] font-semibold text-slate-400 [writing-mode:vertical-rl] tracking-widest select-none mt-1">브랜드 목록</span>
                  </div>
                ) : <h2 className="text-sm font-semibold text-slate-700">브랜드 목록</h2>}
                {/* 접기/펼치기 + 정렬 토글 (펼쳐진 상태에서만 표시) */}
                {!listCollapsed && (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <div className="flex items-center rounded-md border border-slate-200 overflow-hidden text-[11px]">
                      <button onClick={() => setSortMode("alpha")}
                        className={`px-2 py-1 transition-colors ${sortMode === "alpha" ? "bg-blue-500 text-white font-semibold" : "text-slate-500 hover:bg-slate-50"}`}>
                        가나다
                      </button>
                      <button onClick={() => setSortMode("date")}
                        className={`px-2 py-1 transition-colors ${sortMode === "date" ? "bg-blue-500 text-white font-semibold" : "text-slate-500 hover:bg-slate-50"}`}>
                        업로드일자
                      </button>
                    </div>
                    <button onClick={() => setSortMode("order")}
                      className={`px-2 py-1 rounded-md border text-[11px] transition-colors ${sortMode === "order" ? "bg-orange-500 text-white border-orange-500 font-semibold" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                      순서변경
                    </button>
                    <button onClick={() => setListCollapsed(true)}
                      title="목록 접기"
                      className="p-1.5 rounded-md border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              {/* 노출/비노출 필터 */}
              {!listCollapsed && <div className="flex items-center gap-1.5 mb-2">
                <div className="flex items-center rounded-md border border-slate-200 overflow-hidden text-[11px]">
                  {([["all", "전체"], ["visible", "노출"], ["hidden", `비노출 ${hiddenCount}`]] as const).map(([v, label]) => (
                    <button key={v} onClick={() => setVisFilter(v)}
                      className={`px-2 py-1 transition-colors ${visFilter === v ? "bg-slate-700 text-white font-semibold" : "text-slate-500 hover:bg-slate-50"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {visFilter === "hidden" && displayBrands.length > 0 && (
                  <button onClick={showAllVisible} disabled={togglingVis}
                    className="ml-auto px-2 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-600 text-[11px] font-semibold hover:bg-blue-100 transition-colors disabled:opacity-50">
                    {togglingVis ? "처리 중…" : "목록 전체 노출로"}
                  </button>
                )}
              </div>}
              {/* 일괄 선택·삭제 툴바 */}
              {!listCollapsed && <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer select-none" onClick={toggleCheckAll}>
                  <input type="checkbox" readOnly
                    checked={brands.length > 0 && checkedIds.size === brands.length}
                    className="w-3.5 h-3.5 accent-blue-600 pointer-events-none" />
                  <span className="text-[11px] text-slate-500">전체 선택</span>
                </label>
                {sortMode === "order" && (
                  <span className="text-[10px] text-slate-400 ml-auto">
                    {canDrag ? "드래그로 순서 변경" : "순서 변경은 '전체' 필터에서만"}
                  </span>
                )}
                {checkedIds.size > 0 && (
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={() => bulkSetVisible(true)} disabled={togglingVis}
                      className="px-2 py-1 bg-blue-50 text-blue-600 border border-blue-200 text-[11px] font-semibold rounded-md hover:bg-blue-100 transition-colors disabled:opacity-50">
                      노출
                    </button>
                    <button onClick={() => bulkSetVisible(false)} disabled={togglingVis}
                      className="px-2 py-1 bg-slate-100 text-slate-600 border border-slate-300 text-[11px] font-semibold rounded-md hover:bg-slate-200 transition-colors disabled:opacity-50">
                      비노출
                    </button>
                    <button onClick={handleBulkDelete} disabled={deletingBulk}
                      className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 text-[11px] font-semibold rounded-md hover:bg-red-100 transition-colors disabled:opacity-50">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      {deletingBulk ? "삭제 중…" : `${checkedIds.size} 삭제`}
                    </button>
                  </div>
                )}
                {checkedIds.size > 0 && (
                  <div className="w-full mt-1.5 flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                    <span className="text-[10px] font-semibold text-amber-700 flex-shrink-0">시즌 적용</span>
                    <input
                      type="text"
                      value={seasonInput}
                      onChange={(e) => setSeasonInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") applySeasonBulk(); }}
                      placeholder="예: 2026 F/W"
                      className="flex-1 min-w-0 border border-amber-300 bg-white px-2.5 py-1 text-[11px] rounded-lg focus:outline-none focus:border-amber-500 placeholder-amber-300"
                    />
                    <button
                      onClick={applySeasonBulk}
                      disabled={applyingSeasonBulk || !seasonInput.trim()}
                      className="flex-shrink-0 px-2.5 py-1 bg-amber-500 text-white text-[10px] font-semibold rounded-lg hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      {applyingSeasonBulk ? "적용 중…" : `${checkedIds.size}개 브랜드 적용`}
                    </button>
                  </div>
                )}
              </div>}
            </div>
            {/* 스크롤 목록 */}
            {!listCollapsed && <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-14 text-slate-400 text-sm">
                  <span className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />불러오는 중...
                </div>
              ) : brands.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">등록된 브랜드가 없습니다.</div>
              ) : displayBrands.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  {visFilter === "hidden" ? "비노출 브랜드가 없습니다." : "해당하는 브랜드가 없습니다."}
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {displayBrands.map((b, i) => (
                    <li key={b.id} draggable={canDrag}
                      onDragStart={() => canDrag && setDragIndex(i)}
                      onDragOver={(e) => { if (canDrag) { e.preventDefault(); setDragOver(i); } }}
                      onDrop={() => canDrag && handleDrop(i)}
                      onDragEnd={() => { setDragIndex(null); setDragOver(null); }}
                      onClick={() => selectBrand(b)}
                      className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors
                        ${selectedId === String(b.id) && checkedIds.size === 0 ? "bg-blue-50" : "hover:bg-slate-50"}
                        ${dragOver === i && dragIndex !== i ? "bg-orange-50 border-l-2 border-orange-400" : ""}`}>
                      {/* 체크박스 */}
                      <input type="checkbox" checked={checkedIds.has(String(b.id))} readOnly
                        onClick={(e) => toggleCheck(String(b.id), e)}
                        className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0 cursor-pointer pointer-events-auto" />
                      {/* 로고 등록 시 로고 미리보기, 없으면 색상 스와치 */}
                      {b.logo_url ? (
                        <div className="w-5 h-5 rounded flex-shrink-0 border border-black/10 bg-slate-100 flex items-center justify-center overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={b.logo_url} alt="" className="max-w-full max-h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded flex-shrink-0 border border-black/10" style={{ backgroundColor: b.accent_color }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{b.name || b.name_ko || "(이름 없음)"}</p>
                        {b.name_ko && b.name && <p className="text-[10px] text-slate-500 truncate">{b.name_ko}</p>}
                        {!b.name_ko && b.positioning && <p className="text-[10px] text-slate-400 truncate">{b.positioning}</p>}
                      </div>
                      {(() => {
                        const date = formatCatalogDate(b.name || "");
                        if (date) return <span className="text-[9px] text-blue-400 font-mono flex-shrink-0">{date}</span>;
                        const asm = b.catalog_enabled ? assembled[String(b.id)] : undefined;
                        if (asm && asm.visibleCount > 0) {
                          const asmDate = fmtDate(asm.latest);
                          return <span className="text-[9px] text-emerald-500 font-mono flex-shrink-0" title={`카탈로그 · ${asm.count}페이지${asmDate ? ` · 수정 ${asmDate}` : ""}`}>카탈로그 {asmDate ?? asm.count}</span>;
                        }
                        if (b.catalog_enabled)
                          return <span className="text-[9px] text-amber-500 flex-shrink-0" title="카탈로그 공개 상태이나 노출 페이지가 없음">카탈로그 준비중</span>;
                        return <span className="text-[9px] text-slate-300 flex-shrink-0">파일없음</span>;
                      })()}
                      <button onClick={(e) => { e.stopPropagation(); toggleVisible(b); }}
                        title={b.is_visible ? "노출 중" : "숨김"}
                        className={`relative inline-flex items-center rounded-full transition-colors flex-shrink-0 ${b.is_visible ? "bg-blue-500" : "bg-slate-200"}`}
                        style={{ width: 28, height: 16 }}>
                        <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition-transform ${b.is_visible ? "translate-x-[13px]" : "translate-x-[2px]"}`} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>}
          </div>
        </div>

        {/* ── 오른쪽: 편집 패널 ── */}
        <div className="flex-1 min-w-0" ref={formRef}>
          {editing ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {/* 편집 헤더 */}
              <div className="px-6 py-4 bg-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">{isNew ? "새 브랜드 추가" : editing.name}</h2>
                  {!isNew && <p className="text-xs text-slate-400 mt-0.5">ID: {editing.id}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {!isNew && (
                    <button onClick={handleDelete} className="px-3 py-1.5 text-red-400 hover:text-red-300 text-xs font-medium border border-red-800 rounded-lg transition-colors">삭제</button>
                  )}
                  <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors">
                    {saving ? "저장 중..." : "저장"}
                  </button>
                  <button onClick={() => { setEditing(null); setSelectedId(null); }} className="text-slate-400 hover:text-white ml-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              {/* 탭 */}
              <div className="flex border-b border-slate-200 bg-slate-50">
                {(["info", "assembled"] as Tab[]).map((t) => (
                  <button key={t} onClick={() => { setTab(t); setListCollapsed(t === "assembled"); }}
                    className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${tab === t ? "border-blue-500 text-blue-600 bg-white" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                    {t === "info" ? "기본 정보" : "카탈로그(플립북)"}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {/* ── 탭 1: 기본 정보 ── */}
                {tab === "info" && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="is_visible" checked={editing.is_visible} onChange={(e) => set("is_visible", e.target.checked)} className="w-4 h-4 accent-blue-600" />
                      <label htmlFor="is_visible" className="text-sm text-gray-700 cursor-pointer">브랜드 페이지에 노출</label>
                    </div>

                    {isNew && (
                      <Field label="ID (슬러그)" hint="영문 소문자·숫자·하이픈만. 생성 후 변경 불가. 비워두면 브랜드명에서 자동 생성.">
                        <input type="text" value={editing.id} onChange={(e) => set("id", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                          placeholder="예: kenta" className={INPUT} />
                      </Field>
                    )}

                    <Field label="브랜드명">
                      <input type="text" value={editing.name} onChange={(e) => set("name", e.target.value)} placeholder="예: KENTA" className={INPUT} />
                    </Field>
                    <Field label="포지셔닝" hint="쉼표로 구분하면 여러 태그 — 예: EVERYDAY BASIC, 태닝">
                      <input type="text" value={editing.positioning} onChange={(e) => set("positioning", e.target.value)} placeholder="예: EVERYDAY BASIC, 태닝" className={INPUT} />
                    </Field>
                    <Field label="한글명">
                      <input type="text" value={editing.name_ko ?? ""} onChange={(e) => set("name_ko", e.target.value)} placeholder="예: 세이프티조거" className={INPUT} />
                    </Field>
                    <Field label="설명 (영문)">
                      <input type="text" value={editing.description} onChange={(e) => set("description", e.target.value)} placeholder="예: Everyday basic workwear for every occasion" className={INPUT} />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="강조 색상 (Accent Color)">
                        <div className="flex items-center gap-2">
                          <input type="color" value={editing.accent_color} onChange={(e) => set("accent_color", e.target.value)}
                            className="w-9 h-9 rounded cursor-pointer border border-gray-200 p-0.5 flex-shrink-0" />
                          <input type="text" value={editing.accent_color} onChange={(e) => set("accent_color", e.target.value)}
                            placeholder="#000000" className={INPUT} />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">포지셔닝 텍스트·CTA 버튼 색상</p>
                      </Field>
                      <Field label="히어로 텍스트 색상">
                        <div className="flex items-center gap-2">
                          <input type="color" value={editing.hero_text_color || "#ffffff"}
                            onChange={(e) => set("hero_text_color", e.target.value)}
                            className="w-9 h-9 rounded cursor-pointer border border-gray-200 p-0.5 flex-shrink-0" />
                          <input type="text" value={editing.hero_text_color ?? ""}
                            onChange={(e) => set("hero_text_color", e.target.value)}
                            placeholder="#ffffff (비워두면 흰색)" className={INPUT} />
                          {editing.hero_text_color && (
                            <button type="button" onClick={() => set("hero_text_color", "")}
                              className="text-xs text-slate-400 hover:text-red-500 flex-shrink-0">초기화</button>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">배경 이미지 위 브랜드명·설명 글자색</p>
                      </Field>
                    </div>
                    <CardImageField editing={editing} set={set} flash={flash} />
                    <LogoField editing={editing} set={set} flash={flash} />

                    {/* 카탈로그 PDF — 기본 정보 하단 */}
                    {!isNew && (
                      <div className="border-t border-slate-100 pt-5">
                        <p className="text-sm font-semibold text-slate-700 mb-3">카탈로그 PDF <span className="ml-1 text-xs font-normal text-slate-400">({brandCatalogs.length})</span></p>
                        <CatalogTab
                          brandName={editing.name}
                          catalogs={brandCatalogs}
                          onRefresh={loadBrands}
                          flash={flash}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* ── 탭 3: 조립형 카탈로그 ── */}
                {tab === "assembled" && !isNew && editing && (
                  <AssembledCatalogTab
                    brand={editing}
                    brandId={editing.id}
                    onPatchBrand={(patch) => setEditing((prev) => (prev ? { ...prev, ...patch } : prev))}
                    flash={flash}
                    pageCount={assembled[String(editing.id)]?.count}
                  />
                )}
                {tab === "assembled" && isNew && (
                  <p className="text-sm text-gray-400">브랜드를 먼저 저장한 후 조립형 카탈로그를 편집할 수 있습니다.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm gap-3">
              <p>왼쪽 목록에서 브랜드를 선택하거나 "브랜드 추가"를 눌러 새로 등록하세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CSS 상수 ──────────────────────────────────────────────────
const INPUT = "w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-400 rounded";

// ── Field 컴포넌트 ────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {hint && <p className="text-xs text-slate-400 mb-2">{hint}</p>}
      {children}
    </div>
  );
}


// ── CatalogTab ────────────────────────────────────────────────
function CatalogTab({ brandName, catalogs, onRefresh, flash }: {
  brandName: string;
  catalogs: BrandCatalog[];
  onRefresh: () => void;
  flash: (msg: string, type?: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<BrandCatalog, "id">>({ ...EMPTY_BRAND_CATALOG, brand_name: brandName });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setF = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const uploadPdf = async (file: File) => {
    setUploading(true);
    try {
      const sig = await fetch("/api/admin/r2-upload-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: "workup/brands", fileName: file.name, contentType: "application/pdf" }),
      }).then((r) => r.json());
      if (!sig?.uploadUrl) { flash("업로드 URL 발급 실패", "err"); return; }
      const up = await fetch(sig.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: file });
      if (!up.ok) { flash(`업로드 실패: ${up.status}`, "err"); return; }
      setF("pdf_public_id", sig.key);
      setF("pdf_file_id", sig.key);
      setF("pdf_url", sig.publicUrl);
      flash("PDF 업로드 완료 · 페이지 수를 입력하고 저장하세요.");
    } catch { flash("업로드 실패", "err"); }
    finally { setUploading(false); }
  };

  const saveCatalog = async () => {
    if (!form.pdf_public_id) { flash("PDF를 먼저 업로드하세요.", "err"); return; }
    if (form.page_count < 1) { flash("페이지 수를 입력하세요.", "err"); return; }
    setSaving(true);
    const payload = { ...form, id: crypto.randomUUID() };
    const res = await fetch("/api/admin/brand-catalogs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (res.ok) { flash("카탈로그 추가 완료"); setShowForm(false); setForm({ ...EMPTY_BRAND_CATALOG, brand_name: brandName }); onRefresh(); }
    else { const e = await res.json().catch(() => ({})); flash(e.error ?? "저장 실패", "err"); }
  };

  const deleteCatalog = async (id: string, label: string) => {
    if (!confirm(`"${label}" 카탈로그를 삭제할까요?`)) return;
    const res = await fetch(`/api/admin/brand-catalogs/${id}`, { method: "DELETE" });
    if (res.ok) { flash("삭제됐습니다."); onRefresh(); }
  };

  const toggleCatalogVisible = async (c: BrandCatalog) => {
    await fetch(`/api/admin/brand-catalogs/${c.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_visible: !c.is_visible }) });
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* PDF 카탈로그 목록 */}
      {catalogs.length === 0 ? (
        <p className="text-sm text-slate-400 py-4">등록된 카탈로그가 없습니다.</p>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
          {catalogs.map((c) => (
            <div key={c.id} className="flex items-center gap-4 px-4 py-3 bg-white hover:bg-slate-50 transition-colors">
              {/* 표지 */}
              <div className="w-8 h-11 flex-shrink-0 bg-slate-100 rounded overflow-hidden border border-slate-200">
                {c.thumbnail_url
                  ? <img src={c.thumbnail_url} alt="" className="w-full h-full object-cover" />  // eslint-disable-line @next/next/no-img-element
                  : <div className="w-full h-full bg-slate-600 flex items-center justify-center text-white/30 text-[7px]">PDF</div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{c.season || "시즌 미설정"}</p>
                <p className="text-xs text-slate-400">{c.page_count}페이지</p>
              </div>
              <button onClick={() => toggleCatalogVisible(c)} title={c.is_visible ? "노출 중" : "숨김"}
                className={`relative inline-flex items-center rounded-full transition-colors flex-shrink-0 ${c.is_visible ? "bg-blue-500" : "bg-slate-200"}`}
                style={{ width: 32, height: 18 }}>
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${c.is_visible ? "translate-x-[16px]" : "translate-x-[2px]"}`} />
              </button>
              <button onClick={() => deleteCatalog(c.id, c.season || c.brand_name)} className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">삭제</button>
            </div>
          ))}
        </div>
      )}

      {/* 추가 버튼 */}
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          카탈로그 추가
        </button>
      ) : (
        <div className="border border-blue-200 rounded-xl p-5 bg-blue-50/40 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">새 카탈로그</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="시즌">
              <input type="text" value={form.season ?? ""} onChange={(e) => setF("season" as keyof typeof form, e.target.value)}
                placeholder="예: 2026 FW" className={INPUT} />
            </Field>
            <Field label="페이지 수">
              <input type="number" min={1} value={form.page_count || ""} onChange={(e) => setF("page_count", Math.max(1, parseInt(e.target.value) || 1))}
                placeholder="예: 48" className={INPUT} />
            </Field>
          </div>
          <Field label="PDF 파일">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="px-4 py-2 text-sm font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg disabled:opacity-50">
                {uploading ? "업로드 중…" : form.pdf_public_id ? "다른 PDF로 교체" : "PDF 선택"}
              </button>
              {form.pdf_public_id && <span className="text-xs text-green-600">✓ 업로드됨</span>}
            </div>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f); e.target.value = ""; }} />
          </Field>
          <div className="flex items-center gap-3">
            <button onClick={saveCatalog} disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
              {saving ? "저장 중..." : "저장"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">취소</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── BgField ───────────────────────────────────────────────────
// 브랜드 목록(/brands) 카드 이미지 — catalog_cover_url 컬럼 재사용 (3:2 가로형)
function CardImageField({ editing, set, flash }: {
  editing: Brand;
  set: <K extends keyof Brand>(k: K, v: Brand[K]) => void;
  flash: (msg: string, type?: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const url = editing.catalog_cover_url ?? "";

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const sig = await fetch("/api/admin/r2-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: "workup/brands/card", fileName: file.name, contentType: file.type }),
      }).then((r) => r.json());
      if (!sig?.uploadUrl) { flash("업로드 URL 발급 실패", "err"); return; }
      const up = await fetch(sig.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!up.ok) { flash(`업로드 실패: ${up.status}`, "err"); return; }
      set("catalog_cover_url", sig.publicUrl);
      flash("목록 카드 이미지 업로드 완료");
    } catch { flash("업로드 실패 (네트워크 확인)", "err"); }
    finally { setUploading(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-slate-700">브랜드 목록 카드 이미지</label>
        <span className="text-[11px] text-slate-400">권장 사이즈: <strong>1200 × 800px</strong> (3:2 가로형)</span>
      </div>
      <p className="text-[11px] text-slate-400 mb-2"><code>/brands</code> 목록에서 이 브랜드 카드에 표시됩니다. 비우면 히어로 배경 이미지를 대신 사용합니다.</p>
      <div className="flex items-center gap-3 mb-3">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="px-4 py-2 text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg disabled:opacity-50 transition-colors">
          {uploading ? "업로드 중…" : url ? "이미지 교체" : "이미지 업로드"}
        </button>
        {url && (
          <button type="button" onClick={() => set("catalog_cover_url", "")}
            className="text-xs text-red-400 hover:text-red-600">이미지 삭제</button>
        )}
        <span className="text-xs text-slate-400">JPG · PNG · WEBP</span>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      {url && (
        <div className="rounded-lg overflow-hidden border border-slate-200" style={{ aspectRatio: "3 / 2", maxWidth: 280 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}

// 히어로 배경: 이미지 업로드 OR CSS 그라디언트 둘 다 지원
function BgField({ editing, set, flash }: {
  editing: Brand;
  set: <K extends keyof Brand>(k: K, v: Brand[K]) => void;
  flash: (msg: string, type?: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // image_bg 값이 http(s)://로 시작하면 이미지 URL
  const isImageUrl = (editing.image_bg ?? "").startsWith("http");

  const uploadBg = async (file: File) => {
    setUploading(true);
    try {
      const sig = await fetch("/api/admin/r2-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: "workup/brands/bg", fileName: file.name, contentType: file.type }),
      }).then((r) => r.json());
      if (!sig?.uploadUrl) { flash("업로드 URL 발급 실패", "err"); return; }
      const up = await fetch(sig.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!up.ok) { flash(`업로드 실패: ${up.status}`, "err"); return; }
      set("image_bg", sig.publicUrl);
      flash("배경 이미지 업로드 완료");
    } catch { flash("업로드 실패 (네트워크 확인)", "err"); }
    finally { setUploading(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-slate-700">히어로 배경</label>
        <span className="text-[11px] text-slate-400">권장 사이즈: <strong>1920 × 560px</strong> (가로 배너)</span>
      </div>
      <p className="text-[11px] text-slate-400 mb-2">브랜드 페이지(<code>/brands/[브랜드]</code>) 상단 배너 전용. 브랜드 목록 카드 이미지는 아래 <b>&ldquo;브랜드 목록 카드 이미지&rdquo;</b>에서 따로 올립니다.</p>

      {/* 업로드 버튼 */}
      <div className="flex items-center gap-3 mb-3">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="px-4 py-2 text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg disabled:opacity-50 transition-colors">
          {uploading ? "업로드 중…" : isImageUrl ? "이미지 교체" : "이미지 업로드"}
        </button>
        {isImageUrl && (
          <button type="button" onClick={() => set("image_bg", "")}
            className="text-xs text-red-400 hover:text-red-600">이미지 삭제</button>
        )}
        <span className="text-xs text-slate-400">JPG · PNG · WEBP</span>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBg(f); e.target.value = ""; }} />

      {/* 미리보기 */}
      {editing.image_bg && (
        <div className="mb-3 rounded-lg overflow-hidden border border-slate-200" style={{ height: 80 }}>
          {isImageUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={editing.image_bg} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full" style={{ background: editing.image_bg }} />}
        </div>
      )}

      {/* 이미지 URL 표시 */}
      {isImageUrl && (
        <p className="text-[10px] text-slate-400 font-mono break-all mt-1">{editing.image_bg}</p>
      )}
    </div>
  );
}

// ── LogoField ─────────────────────────────────────────────────
// 히어로 로고: 이미지 업로드 OR 텍스트 직접 입력
function LogoField({ editing, set, flash }: {
  editing: Brand;
  set: <K extends keyof Brand>(k: K, v: Brand[K]) => void;
  flash: (msg: string, type?: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasLogo = !!(editing.logo_url ?? "");

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const sig = await fetch("/api/admin/r2-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: "workup/brands/logo", fileName: file.name, contentType: file.type }),
      }).then((r) => r.json());
      if (!sig?.uploadUrl) { flash("업로드 URL 발급 실패", "err"); return; }
      const up = await fetch(sig.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!up.ok) { flash(`업로드 실패: ${up.status}`, "err"); return; }
      set("logo_url", sig.publicUrl);
      flash("로고 업로드 완료");
    } catch { flash("업로드 실패 (네트워크 확인)", "err"); }
    finally { setUploading(false); }
  };

  return (
    <div className="border-t border-slate-100 pt-5">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-slate-700">히어로 로고</label>
        <span className="text-[11px] text-slate-400">권장 사이즈: <strong>500 × 200px</strong> 내외 (가로형, 투명 배경)</span>
      </div>
      <p className="text-[11px] text-slate-400 mb-2">이미지가 있으면 텍스트 대신 표시됩니다. 메인 페이지 브랜드 로고 마퀴에도 이 이미지가 사용됩니다.</p>

      {/* 이미지 업로드 */}
      <div className="flex items-center gap-3 mb-3">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="px-4 py-2 text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg disabled:opacity-50 transition-colors">
          {uploading ? "업로드 중…" : hasLogo ? "로고 교체" : "로고 이미지 업로드"}
        </button>
        {hasLogo && (
          <button type="button" onClick={() => set("logo_url", "")}
            className="text-xs text-red-400 hover:text-red-600">이미지 삭제</button>
        )}
        <span className="text-xs text-slate-400">PNG · SVG · WEBP (투명 배경 권장)</span>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }} />

      {/* 로고 미리보기 */}
      {hasLogo && (
        <div className="mb-3 rounded-lg overflow-hidden border border-slate-200 bg-slate-800 flex items-center justify-center" style={{ height: 72 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={editing.logo_url} alt="로고 미리보기" className="max-h-14 max-w-[240px] object-contain" />
        </div>
      )}

      {/* 텍스트 로고 */}
      <Field label="텍스트 로고" hint="로고 이미지가 없을 때 브랜드명 대신 표시할 텍스트. 비워두면 브랜드명 그대로 표시.">
        <input type="text" value={editing.logo_text ?? ""}
          onChange={(e) => set("logo_text", e.target.value)}
          placeholder={`예: ${editing.name || "BRAND NAME"}`}
          className={INPUT} />
      </Field>
    </div>
  );
}

// ── BrandListModal ─────────────────────────────────────────────
// 브랜드 목록 전체를 보면서 추가·수정·삭제할 수 있는 팝업
function QuickAddModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  type Item = { id: number; name: string; name_ko?: string | null };

  const [items, setItems]           = useState<Item[]>([]);
  const [loading, setLoading]       = useState(true);
  const [newName, setNewName]       = useState("");
  const [newNameKo, setNewNameKo]   = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");
  const [editId, setEditId]         = useState<number | null>(null);
  const [editName, setEditName]     = useState("");
  const [editNameKo, setEditNameKo] = useState("");
  const [search, setSearch]         = useState("");
  const addRef  = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const r = await fetch("/api/admin/brands").then(r => r.json());
    if (Array.isArray(r)) setItems(r);
    setLoading(false);
  };

  useEffect(() => { load(); addRef.current?.focus(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true); setError("");
    const r = await fetch("/api/admin/brands", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), name_ko: newNameKo.trim() || undefined }),
    });
    setSaving(false);
    if (r.ok) { setNewName(""); setNewNameKo(""); await load(); onSaved(); }
    else { const d = await r.json().catch(() => ({})); setError(d.error ?? "오류가 발생했습니다."); }
  };

  const startEdit = (item: Item) => {
    setEditId(item.id); setEditName(item.name); setEditNameKo(item.name_ko ?? "");
    setTimeout(() => editRef.current?.focus(), 50);
  };

  const saveEdit = async (id: number) => {
    if (!editName.trim()) return;
    setSaving(true);
    await fetch("/api/admin/brands", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName.trim(), name_ko: editNameKo.trim() || undefined }),
    });
    setSaving(false);
    setEditId(null);
    await load(); onSaved();
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}"을 삭제하시겠습니까?`)) return;
    await fetch("/api/admin/brands", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load(); onSaved();
  };

  const filtered = items.filter(item => {
    const q = search.toLowerCase();
    return !q || item.name.toLowerCase().includes(q) || (item.name_ko ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-lg"
        style={{ maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">브랜드 목록 관리</h2>
            <p className="text-xs text-gray-400 mt-0.5">제품 등록 시 선택할 브랜드를 관리합니다 ({items.length}개)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 추가 폼 */}
        <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          <form onSubmit={handleAdd} className="flex gap-2">
            <input ref={addRef} value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="브랜드명 (영문)" className="flex-1 min-w-0 border border-gray-200 px-3 py-2 text-sm rounded-lg focus:outline-none focus:border-blue-400" />
            <input value={newNameKo} onChange={e => setNewNameKo(e.target.value)}
              placeholder="한글명 (선택)" className="flex-1 min-w-0 border border-gray-200 px-3 py-2 text-sm rounded-lg focus:outline-none focus:border-blue-400" />
            <button type="submit" disabled={saving || !newName.trim()}
              className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap transition-colors">
              추가
            </button>
          </form>
        </div>

        {/* 검색 */}
        <div className="px-6 py-2 border-b border-gray-100 flex-shrink-0">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="브랜드 검색..."
            className="w-full border border-gray-200 px-3 py-1.5 text-sm rounded-lg focus:outline-none focus:border-blue-400" />
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              {search ? "검색 결과가 없습니다." : "등록된 브랜드가 없습니다."}
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {filtered.map(item => (
                <li key={item.id} className="flex items-center gap-2 px-5 py-2.5 hover:bg-gray-50 group">
                  {editId === item.id ? (
                    <>
                      <input ref={editRef} value={editName} onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveEdit(item.id); if (e.key === "Escape") setEditId(null); }}
                        className="flex-1 border border-blue-400 px-2.5 py-1.5 text-sm rounded-lg focus:outline-none" />
                      <input value={editNameKo} onChange={e => setEditNameKo(e.target.value)}
                        placeholder="한글명"
                        onKeyDown={e => { if (e.key === "Enter") saveEdit(item.id); if (e.key === "Escape") setEditId(null); }}
                        className="flex-1 border border-blue-400 px-2.5 py-1.5 text-sm rounded-lg focus:outline-none" />
                      <button onClick={() => saveEdit(item.id)} disabled={saving}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">저장</button>
                      <button onClick={() => setEditId(null)}
                        className="px-3 py-1.5 border border-gray-200 text-gray-500 text-xs rounded-lg">취소</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium text-gray-800">
                        {item.name}
                        {item.name_ko && <span className="ml-2 text-xs text-gray-400 font-normal">{item.name_ko}</span>}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(item)}
                          className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50">수정</button>
                        <button onClick={() => handleDelete(item.id, item.name)}
                          className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">삭제</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 하단 */}
        <div className="px-6 py-3 border-t border-gray-100 flex-shrink-0 flex justify-end">
          <button onClick={onClose}
            className="px-5 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
