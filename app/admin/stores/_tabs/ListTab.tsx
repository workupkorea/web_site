"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { partsFromHours } from "@/lib/storeHours";

type StoreRow = {
  id: number;
  name: string;
  store_code: string | null;
  ship_name: string | null;
  region: string;
  address: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  hours: string;
  description: string;
  image_urls: string[];
  brands: string[];
  parking: boolean;
  store_type: string;
  kakao_channel_url: string;
  store_url: string;
  is_active: boolean;
  page_active: boolean;
  sort_order: number;
  product_ids: string[] | null;
  created_at: string;
  updated_at: string | null;
  open_date: string | null;
  close_date: string | null;
  close_reason: string | null;
  closed_at: string | null;
  change_history: { at: string; by: string; changes: { field: string; label: string; from: string; to: string }[] }[] | null;
};

// 'YY/M/D HH:mm' (한국시간) 표기. 예: 26/8/5 09:51
const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "-";
  const [date, time] = new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).split(" ");
  const [y, m, d] = date.split("-");
  return `${y.slice(2)}/${Number(m)}/${Number(d)} ${time.slice(0, 5)}`;
};
// 'YY/M/D' (시간 제외) — 목록의 등록일·수정일 열용
const fmtDate = (iso?: string | null) => fmtDateTime(iso).split(" ")[0];

type SortKey = "id" | "store_code" | "name" | "region" | "store_type" | "phone" | "is_active" | "page_active" | "created_at" | "updated_at";

// 정렬 기준값 (문자열/숫자/날짜 공용)
const sortValue = (s: StoreRow, key: SortKey): string | number => {
  switch (key) {
    case "id": return s.id;
    case "is_active": return s.is_active ? 1 : 0;
    case "page_active": return s.page_active ? 1 : 0;
    case "created_at": return s.created_at ?? "";
    case "updated_at": return s.updated_at ?? "";
    default: return (s[key] as string | null) ?? "";
  }
};

// 운영중 = 공개 중, 예정 = 오픈 대기(비활성) 또는 폐업 예약, 폐업 = 폐업 처리됨
type StoreStatus = "운영중" | "예정" | "폐업";
const STATUS_OPTIONS: StoreStatus[] = ["운영중", "예정", "폐업"];
const STATUS_COLOR: Record<StoreStatus, string> = {
  운영중: "bg-emerald-100 text-emerald-700",
  예정: "bg-amber-100 text-amber-700",
  폐업: "bg-red-100 text-red-700",
};
const storeStatus = (s: Pick<StoreRow, "is_active" | "closed_at">): StoreStatus =>
  s.closed_at ? "폐업" : s.is_active ? "운영중" : "예정";
// 예정 필터: 오픈 대기(비활성) + 폐업 예약(폐업 예정일이 있고 아직 운영중)
const isScheduled = (s: Pick<StoreRow, "is_active" | "closed_at" | "close_date">) =>
  !s.closed_at && (!s.is_active || !!s.close_date);

const CLOSE_REASONS = ["폐업", "점주변경", "이전", "계약종료"];

const TYPE_COLOR: Record<string, string> = {
  직영점: "bg-blue-100 text-blue-700",
  대리점: "bg-green-100 text-green-700",
  아울렛: "bg-purple-100 text-purple-700",
  "복합쇼핑몰": "bg-orange-100 text-orange-700",
};

export default function ListTab() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("전체");
  const [typeFilter, setTypeFilter] = useState("전체");
  const [closeTarget, setCloseTarget] = useState<StoreRow | null>(null);
  const [closeDate, setCloseDate] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [activeFilter, setActiveFilter] = useState<"전체" | "운영중" | "예정" | "폐업">("전체");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("created_at"); // 기본: 최근 등록일 순
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [historyOpen, setHistoryOpen] = useState<number | null>(null);
  const historyStore = stores.find((s) => s.id === historyOpen && (s.change_history?.length ?? 0) > 0);

  // ESC 로 수정내역 팝업 닫기
  useEffect(() => {
    if (historyOpen === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setHistoryOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [historyOpen]);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/stores");
    if (res.ok) setStores(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const regions = useMemo(() => {
    const set = new Set(stores.map((s) => s.region).filter(Boolean));
    return ["전체", ...Array.from(set).sort()];
  }, [stores]);

  const types = useMemo(() => {
    const set = new Set(stores.map((s) => s.store_type).filter(Boolean));
    return ["전체", ...Array.from(set).sort()];
  }, [stores]);

  const filtered = useMemo(() => {
    return stores.filter((s) => {
      if (
        search &&
        !s.name.includes(search) &&
        !s.address.includes(search) &&
        !(s.ship_name ?? "").includes(search) &&
        !(s.store_code ?? "").toLowerCase().includes(search.toLowerCase())
      )
        return false;
      if (regionFilter !== "전체" && s.region !== regionFilter) return false;
      if (typeFilter !== "전체" && s.store_type !== typeFilter) return false;
      // 폐업 지점은 '폐업' 필터에서만 보이고, 전체/활성/비활성 목록에서는 숨긴다.
      if (activeFilter === "폐업") return !!s.closed_at;
      if (s.closed_at) return false;
      if (activeFilter === "운영중" && !s.is_active) return false;
      if (activeFilter === "예정" && !isScheduled(s)) return false;
      return true;
    });
  }, [stores, search, regionFilter, typeFilter, activeFilter]);

  // 상태 필터별 건수 (전체 = 폐업 제외)
  const statusCounts = useMemo(() => {
    const c = { 전체: 0, 운영중: 0, 예정: 0, 폐업: 0 };
    stores.forEach((s) => {
      const st = storeStatus(s);
      if (st === "폐업") { c.폐업 += 1; return; }
      c.전체 += 1;
      if (st === "운영중") c.운영중 += 1;
      if (isScheduled(s)) c.예정 += 1;
    });
    return c;
  }, [stores]);

  // 헤더 클릭으로 정렬 기준·방향 변경 (같은 헤더를 다시 누르면 방향 반전)
  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "ko");
      return cmp !== 0 ? cmp * dir : b.id - a.id;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "created_at" || key === "updated_at" || key === "id" ? "desc" : "asc"); }
  };

  // 현재 매장 목록을 Excel로 다운로드 (업로드 템플릿과 동일 컬럼 + ID/정렬순서)
  // 필터가 적용돼 있으면 보이는 목록만, 아니면 전체를 내보낸다.
  const downloadExcel = () => {
    const target = filtered;
    if (target.length === 0) return;
    const header = [
      "ID", "지점코드", "매장명", "지역", "주소", "전화번호",
      "평일시작", "평일종료", "주말시작", "주말종료",
      "매장유형", "취급브랜드(;구분)", "주차여부", "매장소개",
      "카카오채널URL", "스토어URL", "활성여부", "정렬순서",
    ];
    const data = target.map((s) => {
      const t = partsFromHours(s.hours ?? "");
      return [
        s.id,
        s.store_code ?? "",
        s.name,
        s.region ?? "",
        s.address,
        s.phone ?? "",
        t.wdStart,
        t.wdEnd,
        t.weStart,
        t.weEnd,
        s.store_type ?? "",
        (s.brands ?? []).join(";"),
        s.parking ? "true" : "false",
        s.description ?? "",
        s.kakao_channel_url ?? "",
        s.store_url ?? "",
        s.is_active ? "true" : "false",
        s.sort_order ?? 0,
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    ws["!cols"] = header.map((_, i) => ({ wch: i === 2 ? 24 : i === 4 ? 40 : i === 13 ? 30 : 14 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "매장목록");
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `workup_stores_${today}.xlsx`);
  };

  const updateStore = async (store: StoreRow, patch: Partial<StoreRow>) => {
    const res = await fetch(`/api/admin/stores/${store.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...store, ...patch }),
    });
    if (res.ok) {
      const updated = await res.json();
      setStores((prev) => prev.map((s) => (s.id === store.id ? updated : s)));
    }
    return res.ok;
  };


  // 상태 변경(활성/비활성/폐업). 폐업은 비활성 + 폐업일 기록, 다른 상태로 바꾸면 폐업일 해제
  const changeStatus = async (store: StoreRow, next: StoreStatus) => {
    if (next === storeStatus(store)) return;
    if (next === "폐업") {
      // 폐업일은 캘린더 팝업에서 선택 (즉시 폐업 / 날짜 예약)
      setCloseTarget(store);
      setCloseDate(store.close_date ?? "");
      setCloseReason(store.close_reason ?? "");
      return;
    }
    await updateStore(store, { is_active: next === "운영중", closed_at: null, close_date: null, close_reason: null });
  };

  // 폐업 확정: date 가 없거나 오늘 이하면 즉시 폐업, 오늘 이후면 해당일에 자동 폐업(예약)
  const confirmClose = async (date: string) => {
    const store = closeTarget;
    if (!store) return;
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10); // KST
    setCloseTarget(null);
    if (date && date > today) {
      await updateStore(store, { close_date: date, close_reason: closeReason.trim() || null });
    } else {
      await updateStore(store, { is_active: false, closed_at: new Date().toISOString(), close_date: null, close_reason: closeReason.trim() || null });
    }
  };
  const togglePageActive = (store: StoreRow) => updateStore(store, { page_active: !store.page_active });

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((s) => next.delete(s.id));
      else filtered.forEach((s) => next.add(s.id));
      return next;
    });
  };

  const bulkSetActive = async (active: boolean) => {
    if (!selected.size) return;
    setBulkSaving(true);
    const targets = stores.filter((s) => selected.has(s.id));
    await Promise.all(targets.map((s) => updateStore(s, { is_active: active })));
    setBulkSaving(false);
    setSelected(new Set());
  };

  const bulkSetPageActive = async (pageActive: boolean) => {
    if (!selected.size) return;
    setBulkSaving(true);
    const targets = stores.filter((s) => selected.has(s.id));
    await Promise.all(targets.map((s) => updateStore(s, { page_active: pageActive })));
    setBulkSaving(false);
    setSelected(new Set());
  };

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-xl font-bold text-gray-900">스토어 관리</h1>
          <p className="text-sm text-gray-400">전국 매장 정보를 관리합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/stores/import"
            className="flex items-center gap-2 px-4 py-1.5 border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-400 transition-colors rounded"
          >
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Excel 업로드
          </Link>
          <button
            onClick={downloadExcel}
            disabled={stores.length === 0}
            className="flex items-center gap-2 px-4 py-1.5 border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-400 transition-colors rounded disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Excel 다운로드
          </button>
          <Link
            href="/admin/stores/new"
            className="flex items-center gap-2 px-5 py-1.5 bg-[#303236] text-white text-sm font-semibold hover:bg-[#243a63] transition-colors rounded"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            매장 추가
          </Link>
        </div>
      </div>


      {/* 필터 */}
      <div className="bg-white border border-gray-200 rounded-t-xl border-b-0 px-5 py-3 mb-0 flex flex-wrap gap-4 items-center">
        <input
          type="text"
          placeholder="매장명 또는 주소 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
        />
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
        >
          {regions.map((r) => <option key={r} value={r}>{r === "전체" ? "지역 전체" : r}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
        >
          {types.map((t) => <option key={t} value={t}>{t === "전체" ? "유형 전체" : t}</option>)}
        </select>
        <div className="flex gap-1 border border-gray-200 rounded-lg overflow-hidden">
          {(["전체", "운영중", "예정", "폐업"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setActiveFilter(opt)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${activeFilter === opt ? "bg-[#303236] text-white" : "text-gray-500 hover:text-gray-900"}`}
            >
              {opt === "전체" ? opt : `${opt}(${statusCounts[opt]}건)`}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-400 ml-auto">
          {filtered.length} / {statusCounts.전체}개 매장
        </p>
      </div>

      {/* 다중 선택 일괄 처리 */}
      {selected.size > 0 && (
        <div className="bg-[#303236] rounded-xl px-5 py-3 mt-3 mb-3 flex items-center gap-4">
          <span className="text-sm font-semibold text-white">{selected.size}개 선택됨</span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => bulkSetActive(true)}
              disabled={bulkSaving}
              className="px-4 py-1.5 text-xs font-semibold bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              선택 활성화
            </button>
            <button
              onClick={() => bulkSetActive(false)}
              disabled={bulkSaving}
              className="px-4 py-1.5 text-xs font-semibold bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              선택 비활성화
            </button>
            <span className="w-px h-4 bg-white/20" />
            <button
              onClick={() => bulkSetPageActive(true)}
              disabled={bulkSaving}
              className="px-4 py-1.5 text-xs font-semibold bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              선택 페이지 노출
            </button>
            <button
              onClick={() => bulkSetPageActive(false)}
              disabled={bulkSaving}
              className="px-4 py-1.5 text-xs font-semibold bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              선택 페이지 비노출
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="px-4 py-1.5 text-xs font-semibold text-white/70 hover:text-white transition-colors"
            >
              선택 해제
            </button>
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white border border-gray-200 rounded-b-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 accent-[#303236]"
                  />
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap"><button type="button" onClick={() => toggleSort("id")} className="inline-flex items-center gap-1 uppercase hover:text-gray-900">ID<span className={sortKey === "id" ? "text-gray-900" : "text-gray-300"}>{sortKey === "id" ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span></button></th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap"><button type="button" onClick={() => toggleSort("store_code")} className="inline-flex items-center gap-1 uppercase hover:text-gray-900">지점코드<span className={sortKey === "store_code" ? "text-gray-900" : "text-gray-300"}>{sortKey === "store_code" ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span></button></th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap"><button type="button" onClick={() => toggleSort("name")} className="inline-flex items-center gap-1 uppercase hover:text-gray-900">매장명<span className={sortKey === "name" ? "text-gray-900" : "text-gray-300"}>{sortKey === "name" ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span></button></th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">W주문 지점명</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap"><button type="button" onClick={() => toggleSort("region")} className="inline-flex items-center gap-1 uppercase hover:text-gray-900">지역<span className={sortKey === "region" ? "text-gray-900" : "text-gray-300"}>{sortKey === "region" ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span></button></th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap"><button type="button" onClick={() => toggleSort("store_type")} className="inline-flex items-center gap-1 uppercase hover:text-gray-900">유형<span className={sortKey === "store_type" ? "text-gray-900" : "text-gray-300"}>{sortKey === "store_type" ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span></button></th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap"><button type="button" onClick={() => toggleSort("phone")} className="inline-flex items-center gap-1 uppercase hover:text-gray-900">전화<span className={sortKey === "phone" ? "text-gray-900" : "text-gray-300"}>{sortKey === "phone" ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span></button></th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap"><button type="button" onClick={() => toggleSort("is_active")} className="inline-flex items-center gap-1 uppercase hover:text-gray-900">상태<span className={sortKey === "is_active" ? "text-gray-900" : "text-gray-300"}>{sortKey === "is_active" ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span></button></th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap"><button type="button" onClick={() => toggleSort("page_active")} className="inline-flex items-center gap-1 uppercase hover:text-gray-900">스토어 페이지<span className={sortKey === "page_active" ? "text-gray-900" : "text-gray-300"}>{sortKey === "page_active" ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span></button></th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap"><button type="button" onClick={() => toggleSort("created_at")} className="inline-flex items-center gap-1 uppercase hover:text-gray-900">등록일<span className={sortKey === "created_at" ? "text-gray-900" : "text-gray-300"}>{sortKey === "created_at" ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span></button></th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap"><button type="button" onClick={() => toggleSort("updated_at")} className="inline-flex items-center gap-1 uppercase hover:text-gray-900">수정일 / 수정내역<span className={sortKey === "updated_at" ? "text-gray-900" : "text-gray-300"}>{sortKey === "updated_at" ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span></button></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-5 py-16 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-gray-300 border-t-[#303236] rounded-full animate-spin" />
                      불러오는 중...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-5 py-16 text-center text-gray-400">
                    {stores.length === 0
                      ? <div>
                          <p className="text-base font-medium mb-2">등록된 매장이 없습니다.</p>
                          <p className="text-sm">"매장 추가" 또는 "Excel 업로드"로 매장을 등록하세요.</p>
                        </div>
                      : "검색 결과가 없습니다."}
                  </td>
                </tr>
              ) : (
                sorted.map((store) => (
                  <tr key={store.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(store.id)}
                        onChange={() => toggleOne(store.id)}
                        className="w-4 h-4 rounded border-gray-300 accent-[#303236]"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 text-[11px] font-mono">{store.id}</td>
                    <td className="px-3 py-2.5 text-[11px] font-mono">
                      <Link href={`/admin/stores/${store.id}/edit`} className="text-gray-600 hover:text-blue-600 hover:underline">{store.store_code || "-"}</Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/admin/stores/${store.id}/edit`} className="font-medium text-gray-900 hover:text-blue-600 hover:underline">
                        {store.close_reason && (
                          <span className="mr-1.5 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[11px] font-semibold align-middle">{store.close_reason}</span>
                        )}
                        {store.name}
                      </Link>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[200px]">{store.address}</p>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{store.ship_name || "-"}</td>
                    <td className="px-3 py-2.5 text-gray-600">{store.region || "-"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${TYPE_COLOR[store.store_type] ?? "bg-gray-100 text-gray-600"}`}>
                        {store.store_type || "직영점"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 font-mono text-[11px]">{store.phone || "-"}</td>
                    <td className="px-3 py-2.5">
                      <select
                        value={storeStatus(store)}
                        onChange={(e) => changeStatus(store, e.target.value as StoreStatus)}
                        aria-label={`${store.name} 상태`}
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-full cursor-pointer border-0 focus:outline-none focus:ring-2 focus:ring-gray-300 ${STATUS_COLOR[storeStatus(store)]}`}
                      >
                        {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      {store.closed_at && (
                        <p className="mt-1 text-[11px] font-mono text-red-600 whitespace-nowrap">{fmtDate(store.closed_at)}</p>
                      )}
                      {store.close_date && !store.closed_at && (
                        <p className="mt-1 text-[11px] font-semibold text-red-600 whitespace-nowrap">
                          {store.close_date.slice(5).replace("-", "/")} 폐업예정
                        </p>
                      )}
                      {store.open_date && (
                        <p className="mt-1 text-[11px] font-semibold text-[#E5541B] whitespace-nowrap">
                          {store.open_date.slice(5).replace("-", "/")} 오픈예정
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => togglePageActive(store)}
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-full cursor-pointer transition-colors ${store.page_active ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                      >
                        {store.page_active ? "노출" : "비노출"}
                      </button>
                      {store.page_active && (
                        <Link
                          href={`/store/${store.id}`}
                          target="_blank"
                          title="공개 페이지 열기"
                          aria-label={`${store.name} 공개 페이지 열기`}
                          className="ml-1.5 inline-flex items-center justify-center w-6 h-6 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          ↗
                        </Link>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top text-gray-500 text-[11px] font-mono whitespace-nowrap">{fmtDate(store.created_at)}</td>
                    <td className="px-3 py-2.5 text-[11px] align-top">
                      <p className="text-gray-500 font-mono whitespace-nowrap">{fmtDate(store.updated_at)}</p>
                      {(store.change_history?.length ?? 0) > 0 && (
                        <button
                          onClick={() => setHistoryOpen(store.id)}
                          className="mt-0.5 text-blue-600 hover:underline"
                        >
                          수정내역 ({store.change_history!.length})
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 폐업일 선택 팝업 */}
      {closeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCloseTarget(null)}
          role="dialog"
          aria-modal="true"
          aria-label="폐업 처리"
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900">{closeTarget.name} 폐업 처리</h3>
            <p className="mt-1 text-[13px] text-gray-500">폐업일을 선택하면 그날 자동으로 폐업되고, 그 전까지는 정상 노출됩니다.</p>
            <input
              list="close-reason-options"
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              placeholder="폐업 사유 (예: 폐업, 점주변경)"
              className="mt-4 w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
            />
            <datalist id="close-reason-options">
              {CLOSE_REASONS.map((r) => <option key={r} value={r} />)}
            </datalist>
            <input
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
              className="mt-2 w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
            />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button onClick={() => setCloseTarget(null)} className="min-h-[44px] px-4 text-sm text-gray-500 hover:text-gray-900">취소</button>
              <button onClick={() => confirmClose("")} className="min-h-[44px] px-4 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50">지금 즉시 폐업</button>
              <button
                onClick={() => confirmClose(closeDate)}
                disabled={!closeDate}
                className="min-h-[44px] px-4 text-sm bg-[#303236] text-white rounded-lg disabled:opacity-40"
              >
                폐업일 예약
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정내역 팝업 */}
      {historyStore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setHistoryOpen(null)}
          role="dialog"
          aria-modal="true"
          aria-label="수정내역"
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">
                {historyStore.name} <span className="text-sm font-normal text-gray-400">수정내역 {historyStore.change_history!.length}건</span>
              </h3>
              <button
                onClick={() => setHistoryOpen(null)}
                className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-900 text-lg"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <ul className="overflow-y-auto px-5 py-4 space-y-4 text-[13px]">
              {historyStore.change_history!.map((h, i) => (
                <li key={i} className="border-l-2 border-gray-200 pl-3">
                  <p className="text-gray-400 font-mono text-[12px]">{fmtDateTime(h.at)} · {h.by}</p>
                  {h.changes.map((c, j) => (
                    <p key={j} className="text-gray-700 break-all mt-0.5">
                      <span className="font-semibold">{c.label}</span>
                      {c.from ? `: ${c.from} → ${c.to}` : ` ${c.to}`}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
