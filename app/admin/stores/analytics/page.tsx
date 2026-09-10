"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";

// ── 방문 분석 타입 ────────────────────────────────────────────────
type StoreStat = {
  store_id: number | null;
  store_name: string;
  view: number;
  list_click: number;
  directions_kakao: number;
  directions_naver: number;
  call: number;
  kakao_chat: number;
  conversions: number;
};
type Totals = { view: number; list_click: number; directions: number; call: number; kakao_chat: number; conversions: number };
type VisitRange = { type: "preset"; days: number } | { type: "custom"; from: string; to: string };

// 증감률 계산
function calcChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr > 0 ? null : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

function ChangeBadge({ curr, prev }: { curr: number; prev: number | undefined }) {
  if (prev === undefined) return null;
  const pct = calcChange(curr, prev);
  if (pct === null) return <span className="text-[11px] text-blue-500 font-bold">NEW</span>;
  if (pct === 0) return <span className="text-[11px] text-gray-400">–</span>;
  const up = pct > 0;
  return (
    <span className={`text-[11px] font-bold ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? "▲" : "▼"}{Math.abs(pct)}%
    </span>
  );
}

// ── 패스 매트릭스 타입 ────────────────────────────────────────────
type MatrixStore = { id: number; name: string };
type MatrixEntry = { status: string; updated_at: string | null } | null;
type MatrixNotice = {
  notice_id: string;
  notice_status: "대기" | "진행중" | "마감";
  product_name: string;
  entries: Record<number, MatrixEntry>;
};
type MatrixDate = { date: string; notices: MatrixNotice[] };
type MatrixData = { stores: MatrixStore[]; dates: MatrixDate[] };
type MatrixMode = "month" | "range" | "days";

// ── 공통 상수 / 유틸 ─────────────────────────────────────────────
const VISIT_PRESETS = [
  { label: "최근 7일", days: 7 },
  { label: "최근 30일", days: 30 },
  { label: "최근 90일", days: 90 },
  { label: "전체", days: 0 },
];
const MATRIX_DAYS_PRESETS = [
  { label: "7일", days: 7 },
  { label: "14일", days: 14 },
  { label: "30일", days: 30 },
  { label: "60일", days: 60 },
];
const RANK_BADGE = ["bg-[#E5541B] text-white", "bg-amber-400 text-white", "bg-amber-300 text-amber-900"];
const NOTICE_STATUS_STYLE: Record<string, string> = {
  "대기": "bg-gray-100 text-gray-500",
  "진행중": "bg-blue-50 text-blue-600",
  "마감": "bg-gray-100 text-gray-400",
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const todayKst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
const currentMonthKst = () => todayKst().slice(0, 7);

const monthLastDay = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

// ── 방문 분석 탭 ─────────────────────────────────────────────────
type SortKey = "view" | "conv_rate" | "directions_kakao" | "directions_naver" | "call" | "kakao_chat" | "conversions" | "vs_prev";
type SortDir = "desc" | "asc";

function VisitAnalyticsTab() {
  const [range, setRange] = useState<VisitRange>({ type: "preset", days: 30 });
  const [from, setFrom] = useState(() => isoDate(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [stores, setStores] = useState<StoreStat[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [prevTotals, setPrevTotals] = useState<Totals | null>(null);
  const [prevStores, setPrevStores] = useState<StoreStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const rangeLabel = useMemo(
    () => range.type === "preset" ? VISIT_PRESETS.find((p) => p.days === range.days)?.label ?? `${range.days}일` : `${range.from} ~ ${range.to}`,
    [range],
  );

  useEffect(() => {
    const qs = range.type === "preset" ? `days=${range.days}` : `from=${range.from}&to=${range.to}`;
    setLoading(true);
    fetch(`/api/admin/stores/analytics?${qs}`)
      .then((r) => (r.ok ? r.json() : { stores: [], totals: null, prevTotals: null, prevStores: [] }))
      .then((d) => {
        setStores(d.stores ?? []);
        setTotals(d.totals ?? null);
        setPrevTotals(d.prevTotals ?? null);
        setPrevStores(d.prevStores ?? []);
      })
      .finally(() => setLoading(false));
  }, [range]);

  const summary = [
    { label: "지점 조회", value: totals?.view ?? 0, prev: prevTotals?.view, color: "text-gray-900" },
    { label: "길찾기", value: totals?.directions ?? 0, prev: prevTotals?.directions, color: "text-[#303236]" },
    { label: "전화 문의", value: totals?.call ?? 0, prev: prevTotals?.call, color: "text-emerald-600" },
    { label: "카카오톡 상담", value: totals?.kakao_chat ?? 0, prev: prevTotals?.kakao_chat, color: "text-yellow-600" },
    { label: "전환 합계", value: totals?.conversions ?? 0, prev: prevTotals?.conversions, color: "text-[#E5541B]" },
  ];

  // 이전 기간 매장 Map
  const prevStoreMap = useMemo(() => {
    const m = new Map<string, StoreStat>();
    for (const s of prevStores) m.set(String(s.store_id ?? `name:${s.store_name}`), s);
    return m;
  }, [prevStores]);

  // 정렬된 rows
  const sortedStores = useMemo(() => {
    if (!sortKey) return stores;
    return [...stores].sort((a, b) => {
      const pa = prevStoreMap.get(String(a.store_id ?? `name:${a.store_name}`));
      const pb = prevStoreMap.get(String(b.store_id ?? `name:${b.store_name}`));
      let va = 0, vb = 0;
      if (sortKey === "conv_rate") {
        va = a.view > 0 ? (a.conversions / a.view) * 100 : 0;
        vb = b.view > 0 ? (b.conversions / b.view) * 100 : 0;
      } else if (sortKey === "vs_prev") {
        va = pa ? calcChange(a.conversions, pa.conversions) ?? 0 : -Infinity;
        vb = pb ? calcChange(b.conversions, pb.conversions) ?? 0 : -Infinity;
      } else {
        va = a[sortKey as keyof StoreStat] as number;
        vb = b[sortKey as keyof StoreStat] as number;
      }
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [stores, sortKey, sortDir, prevStoreMap]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortTh = ({ k, label, left }: { k: SortKey; label: string; left?: boolean }) => {
    const active = sortKey === k;
    return (
      <th
        onClick={() => handleSort(k)}
        className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap cursor-pointer select-none hover:text-gray-900 hover:bg-gray-100 transition-colors ${left ? "text-left" : "text-right"}`}
      >
        <span className="inline-flex items-center gap-1 justify-end w-full">
          {!left && <span className={`text-[10px] ${active ? "text-[#303236]" : "text-gray-300"}`}>{active && sortDir === "asc" ? "▲" : "▼"}</span>}
          <span className={active ? "text-[#303236]" : ""}>{label}</span>
          {left && <span className={`text-[10px] ${active ? "text-[#303236]" : "text-gray-300"}`}>{active && sortDir === "asc" ? "▲" : "▼"}</span>}
        </span>
      </th>
    );
  };

  const downloadExcel = () => {
    if (stores.length === 0) return;
    const header = ["순위", "지점", "조회", "전환율(%)", "길찾기(카카오)", "길찾기(네이버)", "전화", "카카오톡", "리스트클릭", "전환합계"];
    const rows = stores.map((s, i) => [
      i + 1, s.store_name, s.view,
      s.view > 0 ? ((s.conversions / s.view) * 100).toFixed(1) : "0.0",
      s.directions_kakao, s.directions_naver, s.call, s.kakao_chat, s.list_click, s.conversions,
    ]);
    const totalRow = totals ? ["", "합계", totals.view, totals.view > 0 ? ((totals.conversions / totals.view) * 100).toFixed(1) : "0.0", "", "", totals.call, totals.kakao_chat, totals.list_click, totals.conversions] : null;
    const aoa = [[`워크업 지점 방문 분석 — 기간: ${rangeLabel}`], [], header, ...rows, ...(totalRow ? [totalRow] : [])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = header.map((_, i) => ({ wch: i === 1 ? 26 : 12 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "방문분석");
    XLSX.writeFile(wb, `workup_방문분析_${range.type === "preset" ? rangeLabel.replace(/\s/g, "") : `${range.from}_${range.to}`}.xlsx`);
  };

  return (
    <>
      {/* 기간 선택 + 엑셀 다운로드 */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-6 flex flex-wrap items-center gap-4">
        <div className="flex gap-1 border border-gray-200 rounded-lg overflow-hidden">
          {VISIT_PRESETS.map((p) => (
            <button key={p.days} onClick={() => setRange({ type: "preset", days: p.days })}
              className={`px-3.5 py-2 text-sm font-medium transition-colors ${range.type === "preset" && range.days === p.days ? "bg-[#303236] text-white" : "text-gray-500 hover:text-gray-900"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">직접 설정</span>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]" />
          <span className="text-gray-400">~</span>
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]" />
          <button onClick={() => from && to && setRange({ type: "custom", from, to })}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${range.type === "custom" ? "bg-[#303236] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
            조회
          </button>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <p className="text-sm text-gray-400">기간: {rangeLabel}</p>
          <button onClick={downloadExcel} disabled={stores.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-400 transition-colors rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Excel
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {summary.map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <ChangeBadge curr={s.value} prev={s.prev} />
              {s.prev !== undefined && (
                <span className="text-[11px] text-gray-300">이전 {s.prev.toLocaleString()}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 지점별 순위 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">지점별 순위 <span className="text-sm font-normal text-gray-400 ml-1">전환 많은 순</span></h2>
          <p className="text-sm text-gray-400">{stores.length}개 지점</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left whitespace-nowrap">순위</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left whitespace-nowrap">지점</th>
                <SortTh k="view" label="조회" />
                <SortTh k="conv_rate" label="전환율" />
                <SortTh k="directions_kakao" label="길찾기(카)" />
                <SortTh k="directions_naver" label="길찾기(네)" />
                <SortTh k="call" label="전화" />
                <SortTh k="kakao_chat" label="카톡" />
                <SortTh k="conversions" label="전환합계" />
                <SortTh k="vs_prev" label="vs 이전" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={10} className="px-5 py-16 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-[#303236] rounded-full animate-spin" />
                    불러오는 중...
                  </div>
                </td></tr>
              ) : stores.length === 0 ? (
                <tr><td colSpan={10} className="px-5 py-16 text-center text-gray-400">
                  <p className="text-base font-medium mb-1">이 기간에 수집된 데이터가 없습니다.</p>
                  <p className="text-sm">고객이 매장 페이지를 조회하거나 길찾기·전화를 누르면 여기에 집계됩니다.</p>
                </td></tr>
              ) : sortedStores.map((s, i) => {
                const convRate = s.view > 0 ? ((s.conversions / s.view) * 100).toFixed(1) : "0.0";
                const prevS = prevStoreMap.get(String(s.store_id ?? `name:${s.store_name}`));
                const originalRank = stores.indexOf(s);
                return (
                  <tr key={s.store_id ?? s.store_name} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center justify-center w-7 h-7 text-xs font-bold rounded-full ${RANK_BADGE[originalRank] ?? "bg-gray-100 text-gray-500"}`}>{originalRank + 1}</span>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-gray-900">
                      {s.store_id ? <Link href={`/store/${s.store_id}`} target="_blank" className="hover:text-[#E5541B] hover:underline">{s.store_name}</Link> : s.store_name}
                    </td>
                    <td className="px-4 py-3.5 text-right text-gray-600">{s.view.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`font-semibold ${parseFloat(convRate) >= 10 ? "text-emerald-600" : parseFloat(convRate) >= 5 ? "text-blue-500" : "text-gray-400"}`}>
                        {convRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-gray-600">{s.directions_kakao.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-right text-gray-600">{s.directions_naver.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-right text-emerald-600">{s.call.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-right text-yellow-600">{s.kakao_chat.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-[#E5541B]">{s.conversions.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-right">
                      <ChangeBadge curr={s.conversions} prev={prevS?.conversions} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-4 text-xs text-gray-400">
        · 전환율 = 전환합계 ÷ 조회수 · 전환합계 = 길찾기 + 전화 + 카카오톡 · vs 이전 = 동일 기간 길이의 직전 기간 대비
      </p>
    </>
  );
}

// ── 지점 선택 드롭다운 ────────────────────────────────────────────
function StoreFilterDropdown({
  stores, selected, onChange,
}: {
  stores: MatrixStore[];
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };

  const label = selected.size === 0 ? "전체 지점" : `${selected.size}개 지점 선택`;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border rounded-lg transition-colors ${open || selected.size > 0 ? "border-[#303236] text-[#303236] bg-gray-50" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        {label}
        {selected.size > 0 && (
          <span onClick={(e) => { e.stopPropagation(); onChange(new Set()); }}
            className="ml-0.5 text-gray-400 hover:text-gray-700">×</span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[180px] py-1.5 max-h-72 overflow-y-auto">
          <button onClick={() => onChange(new Set())}
            className={`w-full text-left px-4 py-2 text-sm transition-colors ${selected.size === 0 ? "font-semibold text-[#303236]" : "text-gray-600 hover:bg-gray-50"}`}>
            전체 지점
          </button>
          <div className="border-t border-gray-100 mt-1 pt-1">
            {stores.map((s) => (
              <button key={s.id} onClick={() => toggle(s.id)}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2.5 transition-colors ${selected.has(s.id) ? "text-[#303236] font-semibold bg-gray-50" : "text-gray-600 hover:bg-gray-50"}`}>
                <span className={`flex-shrink-0 w-4 h-4 border rounded flex items-center justify-center ${selected.has(s.id) ? "bg-[#303236] border-[#303236]" : "border-gray-300"}`}>
                  {selected.has(s.id) && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 패스 상세현황 탭 ──────────────────────────────────────────────
function PassMatrixTab() {
  const today = todayKst();

  const [mode, setMode] = useState<MatrixMode>("days");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKst);
  const [rangeFrom, setRangeFrom] = useState(() => isoDate(new Date(Date.now() - 13 * 86400000)));
  const [rangeTo, setRangeTo] = useState(today);
  const [selectedDays, setSelectedDays] = useState(14);
  const [matrix, setMatrix] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState<Set<number>>(new Set());

  const buildQs = (m = mode) => {
    if (m === "month") {
      const ym = selectedMonth;
      return `from=${ym}-01&to=${ym}-${String(monthLastDay(ym)).padStart(2, "0")}`;
    }
    if (m === "range") return `from=${rangeFrom}&to=${rangeTo}`;
    return `days=${selectedDays}`;
  };

  const fetchMatrix = () => {
    setLoading(true);
    fetch(`/api/admin/stores/pass-matrix?${buildQs()}`)
      .then((r) => (r.ok ? r.json() : { stores: [], dates: [] }))
      .then((data: MatrixData) => { setMatrix(data); setStoreFilter(new Set()); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchMatrix(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 지점 필터 적용
  const visibleStores = useMemo(() => {
    if (!matrix) return [];
    if (storeFilter.size === 0) return matrix.stores;
    return matrix.stores.filter((s) => storeFilter.has(s.id));
  }, [matrix, storeFilter]);

  // 월별 그룹핑
  const groupedByMonth = useMemo(() => {
    if (!matrix) return [];
    const monthMap = new Map<string, MatrixDate[]>();
    for (const d of matrix.dates) {
      const month = d.date.slice(0, 7); // YYYY-MM
      const list = monthMap.get(month) ?? [];
      list.push(d);
      monthMap.set(month, list);
    }
    return [...monthMap.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, dates]) => ({ month, dates }));
  }, [matrix]);

  const totalNotices = matrix?.dates.reduce((s, d) => s + d.notices.length, 0) ?? 0;

  const downloadExcel = () => {
    if (!matrix || matrix.dates.length === 0 || visibleStores.length === 0) return;
    const storeNames = visibleStores.map((s) => s.name);
    const header = ["날짜", "공지 상태", "상품명", ...storeNames];
    const rows: (string | number)[][] = [];
    for (const d of matrix.dates) {
      for (const n of d.notices) {
        const cells = visibleStores.map((s) => {
          const e = n.entries[s.id];
          return e ? e.status : "미응답(출고)";
        });
        rows.push([d.date, n.notice_status, n.product_name, ...cells]);
      }
    }
    const aoa = [["워크업 패스 상세현황"], [], header, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 32 }, ...storeNames.map(() => ({ wch: 10 }))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "패스현황");
    XLSX.writeFile(wb, `workup_패스현황.xlsx`);
  };

  return (
    <>
      {/* 필터 바 */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* 모드 탭 */}
          <div className="flex gap-1 border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
            {(["month", "range", "days"] as MatrixMode[]).map((m) => {
              const labels: Record<MatrixMode, string> = { month: "월별", range: "기간 지정", days: "최근 N일" };
              return (
                <button key={m} onClick={() => setMode(m)}
                  className={`px-3.5 py-2 text-sm font-medium transition-colors ${mode === m ? "bg-[#303236] text-white" : "text-gray-500 hover:text-gray-900"}`}>
                  {labels[m]}
                </button>
              );
            })}
          </div>

          {/* 날짜 입력 */}
          {mode === "month" && (
            <input type="month" value={selectedMonth} max={currentMonthKst()}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]" />
          )}
          {mode === "range" && (
            <div className="flex items-center gap-2">
              <input type="date" value={rangeFrom} max={rangeTo}
                onChange={(e) => setRangeFrom(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]" />
              <span className="text-gray-400 text-sm">~</span>
              <input type="date" value={rangeTo} min={rangeFrom} max={today}
                onChange={(e) => setRangeTo(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]" />
            </div>
          )}
          {mode === "days" && (
            <div className="flex gap-1 border border-gray-200 rounded-lg overflow-hidden">
              {MATRIX_DAYS_PRESETS.map((p) => (
                <button key={p.days} onClick={() => setSelectedDays(p.days)}
                  className={`px-3.5 py-2 text-sm font-medium transition-colors ${selectedDays === p.days ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-900"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <button onClick={fetchMatrix}
            className="px-4 py-2 text-sm font-semibold bg-[#303236] text-white rounded-lg hover:bg-[#1f2124] transition-colors flex-shrink-0">
            조회
          </button>

          {/* 지점 필터 */}
          {matrix && matrix.stores.length > 0 && (
            <StoreFilterDropdown
              stores={matrix.stores}
              selected={storeFilter}
              onChange={setStoreFilter}
            />
          )}

          {/* Excel 다운로드 */}
          <button onClick={downloadExcel} disabled={!matrix || matrix.dates.length === 0}
            className="ml-auto flex items-center gap-2 px-4 py-2 border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-400 transition-colors rounded disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Excel
          </button>
        </div>
      </div>

      {/* 매트릭스 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-bold text-gray-900">지점 × 공지 패스 현황</h2>
          {matrix && (
            <p className="text-sm text-gray-400">
              {totalNotices}개 공지 ·{" "}
              {storeFilter.size === 0 ? `전체 ${matrix.stores.length}개 지점` : `${visibleStores.length}개 지점 (필터됨)`}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-gray-400">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-[#303236] rounded-full animate-spin" />
            불러오는 중...
          </div>
        ) : !matrix || matrix.dates.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <p className="text-base font-medium mb-1">이 기간에 공지가 없습니다.</p>
            <p className="text-sm">공지를 등록하면 여기에 패스 현황이 표시됩니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap border-r border-gray-200 min-w-[96px]">날짜</th>
                  <th className="sticky left-[96px] z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-500 border-r border-gray-200 min-w-[200px]">상품명</th>
                  {visibleStores.map((s) => (
                    <th key={s.id} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap min-w-[72px]">
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupedByMonth.map(({ month, dates }) => (
                  <Fragment key={month}>
                    {/* 월별 구분 헤더 — 여러 달에 걸칠 때만 표시 */}
                    {groupedByMonth.length > 1 && (
                      <tr>
                        <td colSpan={2 + visibleStores.length}
                          className="px-4 py-2 bg-gray-50 text-xs font-bold text-gray-500 border-y border-gray-200">
                          {month.replace("-", "년 ")}월
                        </td>
                      </tr>
                    )}

                    {dates.map((d) =>
                      d.notices.map((n, ni) => (
                        <tr key={n.notice_id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                          {/* 날짜 — 날짜 그룹의 첫 행만 */}
                          <td className="sticky left-0 z-10 bg-white px-4 py-3 text-xs text-gray-500 whitespace-nowrap border-r border-gray-100 align-middle">
                            {ni === 0 ? (
                              <span className="font-medium text-gray-700">{d.date}</span>
                            ) : (
                              <span className="text-gray-200 select-none">│</span>
                            )}
                          </td>
                          {/* 상품명 + 공지 상태 */}
                          <td className="sticky left-[96px] z-10 bg-white px-4 py-3 border-r border-gray-100">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded ${NOTICE_STATUS_STYLE[n.notice_status] ?? "bg-gray-100 text-gray-500"}`}>
                                {n.notice_status}
                              </span>
                              <span className="text-gray-800 text-xs font-medium truncate max-w-[180px]">{n.product_name}</span>
                            </div>
                          </td>
                          {/* 지점별 패스/출고 */}
                          {visibleStores.map((s) => {
                            const e = n.entries[s.id];
                            const status = e?.status ?? null;
                            return (
                              <td key={s.id} className="px-3 py-3 text-center">
                                {status === "패스" ? (
                                  <span className="inline-block px-2 py-0.5 text-[11px] font-bold bg-orange-50 text-orange-600 border border-orange-200 rounded">패스</span>
                                ) : status === "출고" ? (
                                  <span className="inline-block px-2 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded">출고</span>
                                ) : (
                                  <span className="text-[11px] text-gray-300">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-400">
        <span><span className="inline-block px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded font-bold mr-1">출고</span>출고 확정</span>
        <span><span className="inline-block px-1.5 py-0.5 bg-orange-50 text-orange-600 border border-orange-200 rounded font-bold mr-1">패스</span>패스 선택</span>
        <span>— 미응답 (기본값: 출고)</span>
      </div>
    </>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────────
export default function StoreAnalyticsPage() {
  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
        <Link href="/admin/stores" className="hover:text-gray-900">스토어 관리</Link>
        <span>/</span>
        <span className="text-gray-900 font-semibold">분석</span>
      </div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">지점 분석</h1>
        <p className="text-base text-gray-400 mt-1">방문 전환 현황을 확인합니다.</p>
      </div>

      <VisitAnalyticsTab />
    </div>
  );
}
