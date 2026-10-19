"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { partsFromHours } from "@/lib/storeHours";

type StoreRow = {
  id: number;
  name: string;
  store_code: string | null;
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
  change_history: { at: string; by: string; changes: { field: string; label: string; from: string; to: string }[] }[] | null;
};

// 'YY/M/D HH:mm' (한국시간) 표기. 예: 26/8/5 09:51
const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "-";
  const [date, time] = new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).split(" ");
  const [y, m, d] = date.split("-");
  return `${y.slice(2)}/${Number(m)}/${Number(d)} ${time.slice(0, 5)}`;
};

const TYPE_COLOR: Record<string, string> = {
  직영점: "bg-blue-100 text-blue-700",
  대리점: "bg-green-100 text-green-700",
  아울렛: "bg-purple-100 text-purple-700",
  "복합쇼핑몰": "bg-orange-100 text-orange-700",
};

export default function AdminStoresPage() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("전체");
  const [typeFilter, setTypeFilter] = useState("전체");
  const [activeFilter, setActiveFilter] = useState<"전체" | "활성" | "비활성">("전체");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState<number | null>(null);

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
        !(s.store_code ?? "").toLowerCase().includes(search.toLowerCase())
      )
        return false;
      if (regionFilter !== "전체" && s.region !== regionFilter) return false;
      if (typeFilter !== "전체" && s.store_type !== typeFilter) return false;
      if (activeFilter === "활성" && !s.is_active) return false;
      if (activeFilter === "비활성" && s.is_active) return false;
      return true;
    });
  }, [stores, search, regionFilter, typeFilter, activeFilter]);

  // 현재 매장 목록을 Excel로 다운로드 (업로드 템플릿과 동일 컬럼 + ID/정렬순서)
  // 필터가 적용돼 있으면 보이는 목록만, 아니면 전체를 내보낸다.
  const downloadExcel = () => {
    const target = filtered.length === stores.length ? stores : filtered;
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

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}"을(를) 삭제합니다. 채용공고도 함께 삭제됩니다.`)) return;
    setDeleting(id);
    const res = await fetch(`/api/admin/stores/${id}`, { method: "DELETE" });
    if (res.ok) {
      setStores((prev) => prev.filter((s) => s.id !== id));
    } else {
      const d = await res.json();
      alert("삭제 실패: " + d.error);
    }
    setDeleting(null);
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

  const toggleActive = (store: StoreRow) => updateStore(store, { is_active: !store.is_active });
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
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">스토어 관리</h1>
          <p className="text-base text-gray-400 mt-1">전국 매장 정보를 관리합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/stores/import"
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-400 transition-colors rounded"
          >
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Excel 업로드
          </Link>
          <button
            onClick={downloadExcel}
            disabled={stores.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-400 transition-colors rounded disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Excel 다운로드
          </button>
          <Link
            href="/admin/stores/new"
            className="flex items-center gap-2 px-5 py-2.5 bg-[#303236] text-white text-sm font-semibold hover:bg-[#243a63] transition-colors rounded"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            매장 추가
          </Link>
        </div>
      </div>


      {/* 채용공고 바로가기 */}
      <div className="mb-6 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-semibold text-blue-800">채용공고 관리</span>
          <span className="text-sm text-blue-600">전 지점 채용공고를 등록하고 관리합니다.</span>
        </div>
        <Link
          href="/admin/stores/jobs"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded hover:bg-blue-700 transition-colors"
        >
          채용공고 관리 →
        </Link>
      </div>

      {/* 필터 */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-6 flex flex-wrap gap-4 items-center">
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
          {(["전체", "활성", "비활성"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setActiveFilter(opt)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${activeFilter === opt ? "bg-[#303236] text-white" : "text-gray-500 hover:text-gray-900"}`}
            >
              {opt}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-400 ml-auto">
          {filtered.length} / {stores.length}개 매장
        </p>
      </div>

      {/* 다중 선택 일괄 처리 */}
      {selected.size > 0 && (
        <div className="bg-[#303236] rounded-xl px-5 py-3 mb-4 flex items-center gap-4">
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
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
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
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">관리</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">ID</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">지점코드</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">매장명</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">지역</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">유형</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">전화</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">상태</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">스토어 페이지</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">상세보기</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">등록일</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">수정일 / 수정내역</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-5 py-16 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-gray-300 border-t-[#303236] rounded-full animate-spin" />
                      불러오는 중...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-5 py-16 text-center text-gray-400">
                    {stores.length === 0
                      ? <div>
                          <p className="text-base font-medium mb-2">등록된 매장이 없습니다.</p>
                          <p className="text-sm">"매장 추가" 또는 "Excel 업로드"로 매장을 등록하세요.</p>
                        </div>
                      : "검색 결과가 없습니다."}
                  </td>
                </tr>
              ) : (
                filtered.map((store) => (
                  <tr key={store.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(store.id)}
                        onChange={() => toggleOne(store.id)}
                        className="w-4 h-4 rounded border-gray-300 accent-[#303236]"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <Link
                          href={`/admin/stores/${store.id}/edit`}
                          className="px-2 py-1 text-[11px] font-semibold text-[#303236] border border-[#303236] rounded hover:bg-[#303236] hover:text-white transition-colors"
                        >
                          수정
                        </Link>
                        <button
                          onClick={() => handleDelete(store.id, store.name)}
                          disabled={deleting === store.id}
                          className="px-2 py-1 text-[11px] font-semibold text-red-600 border border-red-300 rounded hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 text-[11px] font-mono">{store.id}</td>
                    <td className="px-3 py-2.5 text-gray-600 text-[11px] font-mono">{store.store_code || "-"}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-gray-900">{store.name}</span>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[200px]">{store.address}</p>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{store.region || "-"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${TYPE_COLOR[store.store_type] ?? "bg-gray-100 text-gray-600"}`}>
                        {store.store_type || "직영점"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 font-mono text-[11px]">{store.phone || "-"}</td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => toggleActive(store)}
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-full cursor-pointer transition-colors ${store.is_active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                      >
                        {store.is_active ? "활성" : "비활성"}
                      </button>
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
                    </td>
                    <td className="px-3 py-2.5">
                      {store.page_active ? (
                        <Link
                          href={`/store/${store.id}`}
                          target="_blank"
                          className="text-[11px] text-blue-600 hover:underline"
                        >
                          공개 페이지 ↗
                        </Link>
                      ) : (
                        <span className="text-[11px] text-gray-300">페이지 비노출</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 text-[11px] font-mono whitespace-nowrap">{fmtDateTime(store.created_at)}</td>
                    <td className="px-3 py-2.5 text-[11px] align-top">
                      <p className="text-gray-500 font-mono whitespace-nowrap">{fmtDateTime(store.updated_at)}</p>
                      {(store.change_history?.length ?? 0) > 0 && (
                        <>
                          <button
                            onClick={() => setHistoryOpen(historyOpen === store.id ? null : store.id)}
                            className="mt-0.5 text-blue-600 hover:underline"
                          >
                            수정내역 ({store.change_history!.length}) {historyOpen === store.id ? "▲" : "▼"}
                          </button>
                          {historyOpen === store.id && (
                            <ul className="mt-1.5 space-y-2 min-w-[260px] max-w-[340px]">
                              {store.change_history!.map((h, i) => (
                                <li key={i} className="border-l-2 border-gray-200 pl-2">
                                  <p className="text-gray-400 font-mono">{fmtDateTime(h.at)} · {h.by}</p>
                                  {h.changes.map((c, j) => (
                                    <p key={j} className="text-gray-700 break-all">
                                      <span className="font-semibold">{c.label}</span>
                                      {c.from ? `: ${c.from} → ${c.to}` : ` ${c.to}`}
                                    </p>
                                  ))}
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
