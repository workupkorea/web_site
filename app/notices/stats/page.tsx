"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

type HistoryRow = { summary: string; actor_name: string; created_at: string };

function fmtHistoryTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}
import StatsCalendar from "../_components/StatsCalendar";
import { getShipName } from "@/data/store-ship-names";
import { useShipNameMode, ShipNameToggleButton } from "@/lib/useShipNameMode";

type StoreStat = { store_id: number; store_name: string; store_code: string | null; total: number; outbound: number; pass: number };
type DailyProduct = { id: string; name: string };
type DailyRow = { notice_date: string; count: number; products: DailyProduct[]; byStore: StoreStat[] };

// 패스 매트릭스 타입 (상세현황)
type MatrixStore = { id: number; name: string; store_code?: string | null };
type MatrixEntry = { status: string; updated_at: string | null } | null;
type MatrixNotice = {
  notice_id: string;
  notice_status: "대기" | "진행중" | "마감";
  product_name: string;
  entries: Record<number, MatrixEntry>;
};
type MatrixData = { stores: MatrixStore[]; dates: { date: string; notices: MatrixNotice[] }[] };

type FilterMode = "month" | "today" | "range";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}(${WEEKDAYS[d.getDay()]})`;
}

const todayKst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
const currentMonthKst = () => todayKst().slice(0, 7);

// ── 지점 선택 드롭다운 ────────────────────────────────────────────
function StoreFilterDropdown({
  stores, selected, onChange,
}: {
  stores: { store_id: number; store_name: string; store_code: string | null }[];
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { displayName } = useShipNameMode();

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
    <div ref={ref} className="relative max-lg:w-full">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3.5 py-2 max-lg:min-h-[44px] max-lg:w-full text-sm font-medium border rounded-lg transition-colors ${open || selected.size > 0 ? "border-[#303236] text-[#303236] bg-gray-50" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h4" />
        </svg>
        {label}
        {selected.size > 0 && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(new Set()); }}
            className="ml-0.5 text-gray-400 hover:text-gray-700"
          >×</span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[340px] max-lg:min-w-0 max-lg:w-full py-1.5 max-h-80 overflow-y-auto">
          <button
            onClick={() => onChange(new Set())}
            className={`w-full text-left px-4 py-2 max-lg:min-h-[44px] text-sm transition-colors ${selected.size === 0 ? "font-semibold text-[#303236]" : "text-gray-600 hover:bg-gray-50"}`}
          >
            전체 지점
          </button>
          <div className="border-t border-gray-100 mt-1 pt-1">
            {stores.map((s) => (
              <button
                key={s.store_id}
                onClick={() => toggle(s.store_id)}
                className={`w-full text-left px-4 py-2 max-lg:min-h-[44px] text-sm flex items-center gap-2.5 transition-colors ${selected.has(s.store_id) ? "text-[#303236] font-semibold bg-gray-50" : "text-gray-600 hover:bg-gray-50"}`}
              >
                <span className={`flex-shrink-0 w-4 h-4 border rounded flex items-center justify-center ${selected.has(s.store_id) ? "bg-[#303236] border-[#303236]" : "border-gray-300"}`}>
                  {selected.has(s.store_id) && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                {displayName(s.store_name, s.store_code)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 지점별 품목 상세 (펼침) ────────────────────────────────────────
function StoreNoticeDetail({
  storeId, matrixParams, block,
}: {
  storeId: number;
  matrixParams: { date?: string; from?: string; to?: string };
  block?: boolean; // true: 표(tr/td)가 아니라 div로 렌더링 — 모바일 카드용
}) {
  const Wrap = ({ className, children }: { className: string; children: React.ReactNode }) =>
    block ? <div className={className}>{children}</div> : (
      <tr>
        <td colSpan={6} className={className}>{children}</td>
      </tr>
    );
  const [notices, setNotices] = useState<MatrixNotice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = new URLSearchParams();
    if (matrixParams.date) {
      q.set("date", matrixParams.date);
    } else if (matrixParams.from && matrixParams.to) {
      q.set("from", matrixParams.from);
      q.set("to", matrixParams.to);
    } else {
      q.set("days", "3650");
    }
    setLoading(true);
    fetch(`/api/admin/stores/pass-matrix?${q}`)
      .then((r) => (r.ok ? r.json() : { stores: [], dates: [] }))
      .then((data: MatrixData) => {
        const all: MatrixNotice[] = [];
        for (const d of data.dates ?? []) {
          for (const n of d.notices ?? []) {
            all.push(n);
          }
        }
        setNotices(all);
      })
      .finally(() => setLoading(false));
  }, [storeId, matrixParams.date, matrixParams.from, matrixParams.to]);

  if (loading) {
    return (
      <Wrap className="px-5 py-4 bg-gray-50">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="w-3 h-3 border-2 border-gray-300 border-t-[#303236] rounded-full animate-spin" />
          불러오는 중...
        </div>
      </Wrap>
    );
  }

  if (notices.length === 0) {
    return <Wrap className="px-5 py-4 bg-gray-50 text-xs text-gray-400">이 기간에 공지가 없습니다.</Wrap>;
  }

  return (
    <Wrap className="px-0 py-0 bg-gray-50 border-b border-gray-100">
        <div className="px-5 py-3">
          <div className="flex flex-wrap gap-2">
            {notices.map((n) => {
              const entry = n.entries[storeId];
              const status = entry?.status ?? null;
              return (
                <div key={n.notice_id} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                  <span className="text-[11px] text-gray-600 max-w-[160px] truncate">{n.product_name}</span>
                  {status === "패스" ? (
                    <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-orange-50 text-orange-600 border border-orange-200 rounded">패스</span>
                  ) : status === "출고" ? (
                    <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded">출고</span>
                  ) : (
                    <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded">출고</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
    </Wrap>
  );
}

// ── 지점별 출고/패스 요약 테이블 ──────────────────────────────────────
function StoreStatsTable({
  rows, emptyText, storeFilter, matrixParams, showAllDetail,
}: {
  rows: StoreStat[];
  emptyText: string;
  storeFilter: Set<number>;
  matrixParams?: { date?: string; from?: string; to?: string };
  showAllDetail?: boolean;
}) {
  const { showShip, toggle, displayName } = useShipNameMode();
  const visible = (storeFilter.size === 0 ? rows : rows.filter((r) => storeFilter.has(r.store_id)))
    .slice()
    .sort((a, b) => {
      if (a.pass > 0 && b.pass === 0) return -1;
      if (a.pass === 0 && b.pass > 0) return 1;
      return a.store_name.localeCompare(b.store_name, "ko");
    });

  if (visible.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl py-10 text-center text-sm text-gray-400">{emptyText}</div>
    );
  }
  return (
    <>
    {/* 모바일/태블릿: 1줄 지점명, 2줄 수치 — 가로 스크롤 없이 한눈에 */}
    <div className="lg:hidden bg-white border border-gray-200 rounded-xl shadow-sm divide-y divide-gray-100">
      {visible.map((row) => {
        const passRate = row.total > 0 ? Math.round((row.pass / row.total) * 100) : 0;
        return (
          <div key={row.store_id}>
            <div className="px-4 py-3">
              <p className="text-sm font-bold text-gray-900">{displayName(row.store_name, row.store_code)}</p>
              <div className="mt-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap text-[13px]">
                <span className="text-gray-500">전체 <b className="font-semibold">{row.total}건</b></span>
                <span className="text-emerald-600">출고 <b className="font-semibold">{row.outbound}건</b></span>
                <span className="text-amber-600">패스 <b className="font-semibold">{row.pass}건</b></span>
                <div className="flex items-center gap-2 flex-1 min-w-[110px]">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${passRate}%` }} />
                  </div>
                  <span className="text-[12px] font-semibold text-gray-500 w-9 text-right whitespace-nowrap">{passRate}%</span>
                </div>
              </div>
            </div>
            {showAllDetail && matrixParams && <StoreNoticeDetail storeId={row.store_id} matrixParams={matrixParams} block />}
          </div>
        );
      })}
    </div>

    <div className="hidden lg:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
          <tr>
            <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 uppercase"><ShipNameToggleButton showShip={showShip} onToggle={toggle} /></th>
            <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">전체</th>
            <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">출고</th>
            <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">패스</th>
            <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">패스율</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const passRate = row.total > 0 ? Math.round((row.pass / row.total) * 100) : 0;
            return (
              <Fragment key={row.store_id}>
                <tr className="border-b border-gray-100">
                  <td className="px-5 py-3 text-sm font-semibold text-gray-900">{displayName(row.store_name, row.store_code)}</td>
                  <td className="px-5 py-3 text-sm text-gray-500 whitespace-nowrap">{row.total}건</td>
                  <td className="px-5 py-3 text-sm text-emerald-600 whitespace-nowrap">{row.outbound}건</td>
                  <td className="px-5 py-3 text-sm text-amber-600 whitespace-nowrap">{row.pass}건</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${passRate}%` }} />
                      </div>
                      <span className="text-[12px] font-semibold text-gray-500 w-9 text-right whitespace-nowrap">{passRate}%</span>
                    </div>
                  </td>
                </tr>
                {showAllDetail && matrixParams && (
                  <StoreNoticeDetail storeId={row.store_id} matrixParams={matrixParams} />
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

// ── 상품별 출고/패스 요약 테이블 ──────────────────────────────────────
// 공지(상품) 단위로 몇 개 지점이 패스/출고했는지 보여주고, 행을 누르면 패스한 지점 목록을 펼친다.
// 응답 없는 지점은 출고로 친다(지점별 통계와 동일 기준).
function ProductStatsTable({
  matrixParams, storeFilter,
}: {
  matrixParams: { date?: string; from?: string; to?: string };
  storeFilter: Set<number>;
}) {
  const { displayName } = useShipNameMode();
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams();
    if (matrixParams.date) q.set("date", matrixParams.date);
    else if (matrixParams.from && matrixParams.to) { q.set("from", matrixParams.from); q.set("to", matrixParams.to); }
    else q.set("days", "3650");
    setLoading(true);
    setOpenId(null);
    fetch(`/api/admin/stores/pass-matrix?${q}`)
      .then((r) => (r.ok ? r.json() : { stores: [], dates: [] }))
      .then(setData)
      .finally(() => setLoading(false));
  }, [matrixParams.date, matrixParams.from, matrixParams.to]);

  const rows = useMemo(() => {
    if (!data) return [];
    const stores = storeFilter.size === 0 ? data.stores : data.stores.filter((s) => storeFilter.has(s.id));
    const list = data.dates.flatMap((d) =>
      d.notices.map((n) => {
        const passStores = stores.filter((s) => n.entries[s.id]?.status === "패스");
        const total = stores.length;
        return {
          notice_id: n.notice_id,
          date: d.date,
          name: n.product_name,
          total,
          pass: passStores.length,
          outbound: total - passStores.length,
          passStores,
        };
      }),
    );
    return list.sort((a, b) => b.pass - a.pass || b.date.localeCompare(a.date) || a.name.localeCompare(b.name, "ko"));
  }, [data, storeFilter]);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl py-10 flex items-center justify-center gap-2 text-sm text-gray-400">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-[#303236] rounded-full animate-spin" />
        불러오는 중...
      </div>
    );
  }
  if (rows.length === 0) {
    return <div className="bg-white border border-gray-200 rounded-xl py-10 text-center text-sm text-gray-400">이 기간에 등록된 상품이 없습니다.</div>;
  }

  return (
    <>
    {/* 모바일/태블릿: 1줄 상품명, 2줄 공지일·출고·패스·패스율 */}
    <div className="lg:hidden bg-white border border-gray-200 rounded-xl shadow-sm divide-y divide-gray-100">
      {rows.map((r) => {
        const rate = r.total > 0 ? Math.round((r.pass / r.total) * 100) : 0;
        const open = openId === r.notice_id;
        return (
          <div key={r.notice_id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : r.notice_id)}
              className="w-full text-left px-4 py-3 active:bg-gray-50"
              aria-expanded={open}
            >
              <p className="text-sm font-bold text-gray-900 break-words">
                <span className="mr-1.5 text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
                {r.name}
              </p>
              <div className="mt-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap text-[13px]">
                <span className="text-gray-500 font-mono text-[12px]">{fmtDate(r.date)}</span>
                <span className="text-emerald-600">출고 <b className="font-semibold">{r.outbound}건</b></span>
                <span className="text-amber-600">패스 <b className="font-semibold">{r.pass}건</b></span>
                <div className="flex items-center gap-2 flex-1 min-w-[110px]">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${rate}%` }} />
                  </div>
                  <span className="text-[12px] font-semibold text-gray-500 w-9 text-right whitespace-nowrap">{rate}%</span>
                </div>
              </div>
            </button>
            {open && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                {r.passStores.length === 0 ? (
                  <p className="text-xs text-gray-400">패스한 지점이 없습니다.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {r.passStores.map((s) => (
                      <span key={s.id} className="px-2 py-1 text-[11px] font-semibold bg-orange-50 text-orange-600 border border-orange-200 rounded">
                        {displayName(s.name, s.store_code)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>

    <div className="hidden lg:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
          <tr>
            <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 whitespace-nowrap">상품명</th>
            <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 whitespace-nowrap">공지일</th>
            <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 whitespace-nowrap">출고</th>
            <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 whitespace-nowrap">패스</th>
            <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 whitespace-nowrap">패스율</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rate = r.total > 0 ? Math.round((r.pass / r.total) * 100) : 0;
            const open = openId === r.notice_id;
            return (
              <Fragment key={r.notice_id}>
                <tr
                  onClick={() => setOpenId(open ? null : r.notice_id)}
                  className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-5 py-3 text-sm font-semibold text-gray-900">
                    <span className="mr-1.5 text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
                    {r.name}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="px-5 py-3 text-sm text-emerald-600 whitespace-nowrap">{r.outbound}건</td>
                  <td className="px-5 py-3 text-sm text-amber-600 whitespace-nowrap">{r.pass}건</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${rate}%` }} />
                      </div>
                      <span className="text-[12px] font-semibold text-gray-500 w-9 text-right whitespace-nowrap">{rate}%</span>
                    </div>
                  </td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={5} className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                      {r.passStores.length === 0 ? (
                        <p className="text-xs text-gray-400">패스한 지점이 없습니다.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {r.passStores.map((s) => (
                            <span key={s.id} className="px-2 py-1 text-[11px] font-semibold bg-orange-50 text-orange-600 border border-orange-200 rounded">
                              {displayName(s.name, s.store_code)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

// ── 일별 패스율 추이 그래프 (직접 SVG — 별도 차트 라이브러리 없이) ──────────
// 기간 필터와 지점 필터가 적용된 daily 로 그린다. 패스율 = 패스 건수 / (공지 × 지점) 전체 건수.
// 컨테이너 실제 폭을 재서 1:1 픽셀로 그린다(viewBox 확대 시 글자·선이 폭에 따라 뚱뚱해지는 문제 방지).
const CHART_COLOR = "#E5541B";
const CHART_MARGIN = { left: 44, right: 22, top: 30, bottom: 34 };
const X_LABEL_MIN_GAP = 64; // x축 날짜 라벨 사이 최소 간격(px)

// 단조(monotone) 3차 보간 — 꺾은선을 부드러운 곡선으로, 값이 튀어 오르내리는 오버슈트 없이.
function smoothPath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    slope.push((pts[i + 1].y - pts[i].y) / (dx[i] || 1));
  }
  const m: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    m.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  }
  m.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      m[i] = (3 * a * slope[i]) / h;
      m[i + 1] = (3 * b * slope[i]) / h;
    }
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = pts[i].x + dx[i] / 3;
    const c1y = pts[i].y + (m[i] * dx[i]) / 3;
    const c2x = pts[i + 1].x - dx[i] / 3;
    const c2y = pts[i + 1].y - (m[i + 1] * dx[i]) / 3;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

function DailyPassRateChart({ daily, storeFilter }: { daily: DailyRow[]; storeFilter: Set<number> }) {
  const [open, setOpen] = useState(false); // 리스트 하단에 접힌 채로 시작
  const [active, setActive] = useState<number | null>(null);
  const [width, setWidth] = useState(640);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 컨테이너 폭 추적 — 펼칠 때(open)마다 다시 붙인다.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(280, Math.round(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const points = useMemo(
    () =>
      daily
        .map((d) => {
          const rows = storeFilter.size === 0 ? d.byStore : d.byStore.filter((s) => storeFilter.has(s.store_id));
          const pass = rows.reduce((a, s) => a + s.pass, 0);
          const total = rows.reduce((a, s) => a + s.total, 0);
          return { date: d.notice_date, pass, total, rate: total > 0 ? (pass / total) * 100 : 0, products: d.count };
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
    [daily, storeFilter],
  );

  const sumPass = points.reduce((a, p) => a + p.pass, 0);
  const sumTotal = points.reduce((a, p) => a + p.total, 0);
  const overallRate = sumTotal > 0 ? Math.round((sumPass / sumTotal) * 100) : 0;
  const best = points.length ? points.reduce((a, p) => (p.rate > a.rate ? p : a)) : null;
  const worst = points.length ? points.reduce((a, p) => (p.rate < a.rate ? p : a)) : null;

  const H = width < 520 ? 230 : 280;
  const { left, right, top, bottom } = CHART_MARGIN;
  const plotW = width - left - right;
  const plotH = H - top - bottom;
  const yMax = Math.max(20, Math.ceil(Math.max(0, ...points.map((p) => p.rate)) / 20) * 20);
  const xAt = (i: number) => (points.length === 1 ? left + plotW / 2 : left + (i * plotW) / (points.length - 1));
  const yAt = (v: number) => top + plotH * (1 - v / yMax);
  const labelStep = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotW / X_LABEL_MIN_GAP))));
  const showValues = points.length <= Math.floor(plotW / 44); // 점이 듬성할 때만 값 라벨 표시
  const coords = points.map((p, i) => ({ x: xAt(i), y: yAt(p.rate) }));
  const linePath = smoothPath(coords);
  const areaPath = points.length > 1 ? `${linePath} L${coords[coords.length - 1].x},${yAt(0)} L${coords[0].x},${yAt(0)} Z` : "";
  const ticks = [0, 1, 2, 3, 4].map((k) => (yMax * k) / 4);
  const lastIdx = points.length - 1;
  const focus = active ?? (lastIdx >= 0 ? lastIdx : null);
  const cur = active !== null ? points[active] : undefined;

  // 포인터 위치 → 가장 가까운 날짜 인덱스 (마우스·터치 공용)
  const pickIndex = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (points.length === 1) return 0;
    const idx = Math.round(((x - left) / plotW) * (points.length - 1));
    return Math.min(points.length - 1, Math.max(0, idx));
  };

  const stat = (label: string, value: string, sub?: string, accent?: boolean) => (
    <div className="rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-3 min-w-0">
      <p className="text-[11px] font-semibold text-gray-400 tracking-wide">{label}</p>
      <p className={`mt-0.5 text-xl font-black leading-tight ${accent ? "text-[#E5541B]" : "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>}
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 lg:px-5 py-3.5 min-h-[44px] text-left text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span>일별 패스율 추이 그래프</span>
        <span className="text-gray-400 text-base">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-gray-100 p-4 lg:p-5">
          {points.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">선택한 기간에 오픈된 공지가 없습니다.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
                {stat("기간 패스율", `${overallRate}%`, `패스 ${sumPass}건 / 전체 ${sumTotal}건`, true)}
                {best && stat("최고", `${Math.round(best.rate)}%`, fmtDate(best.date))}
                {worst && stat("최저", `${Math.round(worst.rate)}%`, fmtDate(worst.date))}
                {stat("집계 일수", `${points.length}일`, `오픈 상품 ${points.reduce((a, p) => a + p.products, 0)}개`)}
              </div>

              <div ref={wrapRef} className="relative select-none">
                {cur && (
                  <div
                    className="absolute z-10 pointer-events-none bg-[#1f2124]/95 text-white rounded-xl px-3.5 py-2.5 text-[12px] leading-snug whitespace-nowrap shadow-xl"
                    style={{
                      left: Math.min(width - 12, Math.max(12, xAt(active as number))),
                      top: Math.max(0, yAt(cur.rate) - 86),
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div className="text-[11px] text-gray-300">{fmtDate(cur.date)}</div>
                    <div className="mt-0.5 flex items-baseline gap-1.5">
                      <span className="text-lg font-black text-[#FF8A5B]">{Math.round(cur.rate)}%</span>
                      <span className="text-[11px] text-gray-300">패스율</span>
                    </div>
                    <div className="text-[11px] text-gray-300">
                      패스 {cur.pass}건 · 출고 {cur.total - cur.pass}건 · 상품 {cur.products}개
                    </div>
                  </div>
                )}
                <svg
                  width={width}
                  height={H}
                  viewBox={`0 0 ${width} ${H}`}
                  className="block w-full touch-pan-y"
                  role="img"
                  aria-label={`일별 패스율 추이 그래프. 기간 패스율 ${overallRate}퍼센트`}
                  onPointerMove={(e) => setActive(pickIndex(e))}
                  onPointerDown={(e) => setActive(pickIndex(e))}
                  onPointerLeave={() => setActive(null)}
                >
                  <defs>
                    <linearGradient id="passRateArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLOR} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={CHART_COLOR} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="passRateLine" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#F59E0B" />
                      <stop offset="100%" stopColor={CHART_COLOR} />
                    </linearGradient>
                  </defs>

                  {/* 눈금선 + Y축 라벨 */}
                  {ticks.map((v, k) => (
                    <g key={k}>
                      <line
                        x1={left}
                        x2={width - right}
                        y1={yAt(v)}
                        y2={yAt(v)}
                        stroke={k === 0 ? "#D1D5DB" : "#EEF0F3"}
                        strokeWidth={1}
                        strokeDasharray={k === 0 ? undefined : "4 4"}
                      />
                      <text x={left - 10} y={yAt(v) + 4} textAnchor="end" fontSize={11} fill="#9CA3AF">
                        {Math.round(v)}%
                      </text>
                    </g>
                  ))}

                  {/* 기간 평균선 */}
                  {points.length > 1 && (
                    <g>
                      <line x1={left} x2={width - right} y1={yAt(overallRate)} y2={yAt(overallRate)} stroke="#9CA3AF" strokeWidth={1} strokeDasharray="2 4" />
                      <text x={width - right} y={yAt(overallRate) - 5} textAnchor="end" fontSize={10} fontWeight={600} fill="#9CA3AF">
                        평균 {overallRate}%
                      </text>
                    </g>
                  )}

                  {/* 선택한 날짜 세로 가이드 */}
                  {active !== null && (
                    <line x1={xAt(active)} x2={xAt(active)} y1={top} y2={yAt(0)} stroke={CHART_COLOR} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="3 3" />
                  )}

                  {/* 면 + 선 */}
                  {areaPath && <path d={areaPath} fill="url(#passRateArea)" />}
                  {points.length > 1 && <path d={linePath} fill="none" stroke="url(#passRateLine)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />}

                  {/* 점 + 값 라벨 + X축 날짜 */}
                  {points.map((p, i) => {
                    const isFocus = focus === i;
                    return (
                      <g key={p.date}>
                        {isFocus && <circle cx={coords[i].x} cy={coords[i].y} r={11} fill={CHART_COLOR} fillOpacity={0.15} />}
                        <circle cx={coords[i].x} cy={coords[i].y} r={isFocus ? 5.5 : 4} fill={isFocus ? CHART_COLOR : "#fff"} stroke={CHART_COLOR} strokeWidth={2.5} />
                        {showValues && !(active !== null && active === i) && (
                          <text x={coords[i].x} y={coords[i].y - 12} textAnchor="middle" fontSize={11} fontWeight={700} fill={isFocus ? CHART_COLOR : "#6B7280"}>
                            {Math.round(p.rate)}%
                          </text>
                        )}
                        {(i % labelStep === 0 || i === lastIdx) && (i === lastIdx || lastIdx - i >= labelStep) && (
                          <text
                            x={coords[i].x}
                            y={H - 10}
                            textAnchor={i === 0 && points.length > 1 ? "start" : i === lastIdx && points.length > 1 ? "end" : "middle"}
                            dx={i === 0 && points.length > 1 ? -6 : i === lastIdx && points.length > 1 ? 6 : 0}
                            fontSize={11}
                            fontWeight={isFocus ? 700 : 400}
                            fill={isFocus ? "#303236" : "#9CA3AF"}
                          >
                            {p.date.slice(5, 7)}/{p.date.slice(8, 10)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
              <p className="mt-2 text-[11px] text-gray-400 text-center">그래프를 누르거나 올리면 날짜별 상세가 보입니다.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── 기간 필터로 byStore 재집계 ────────────────────────────────────
function aggregateByStore(filtered: DailyRow[]): StoreStat[] {
  const map = new Map<number, StoreStat>();
  for (const d of filtered) {
    for (const s of d.byStore) {
      const cur = map.get(s.store_id) ?? { store_id: s.store_id, store_name: s.store_name, store_code: s.store_code, total: 0, outbound: 0, pass: 0 };
      cur.total += s.total;
      cur.outbound += s.outbound;
      cur.pass += s.pass;
      map.set(s.store_id, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

// ── 메인 페이지 ──────────────────────────────────────────────────
export default function NoticeStatsPage() {
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [byStore, setByStore] = useState<StoreStat[]>([]);
  const [loading, setLoading] = useState(true);
  const { showShip, toggle: toggleShip } = useShipNameMode();
  const [showAllDetail, setShowAllDetail] = useState(false);
  const [statsTab, setStatsTab] = useState<"store" | "product">("store");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 필터 상태
  const [filterMode, setFilterMode] = useState<FilterMode>("today");
  const [filterFrom, setFilterFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  });
  const [filterTo, setFilterTo] = useState(todayKst);
  const [storeFilter, setStoreFilter] = useState<Set<number>>(new Set());
  const [storeQuery, setStoreQuery] = useState("");

  useEffect(() => {
    fetch("/api/admin/notices/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setDaily(Array.isArray(data.daily) ? data.daily : []);
          setByStore(Array.isArray(data.byStore) ? data.byStore : []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSelectDate = (date: string | null) => {
    setSelectedDate(date);
  };

  // 기간 필터링된 daily
  const filteredDaily = useMemo(() => {
    if (filterMode === "month") {
      return daily.filter((d) => d.notice_date.startsWith(currentMonthKst()));
    }
    if (filterMode === "today") {
      return daily.filter((d) => d.notice_date === todayKst());
    }
    if (filterMode === "range") {
      return daily.filter((d) => d.notice_date >= filterFrom && d.notice_date <= filterTo);
    }
    return daily;
  }, [daily, filterMode, filterFrom, filterTo]);

  // 필터 적용된 byStore
  const filteredByStore = useMemo(() => aggregateByStore(filteredDaily), [filteredDaily]);

  // 드롭다운 선택 + 검색어를 합친 실제 지점 필터. 표들은 "빈 Set = 전체"로 해석하므로,
  // 검색 결과가 하나도 없을 땐 존재하지 않는 ID(-1)를 넣어 전체가 아니라 빈 결과가 나오게 한다.
  const effectiveStoreFilter = useMemo(() => {
    const q = storeQuery.trim().toLowerCase();
    if (!q) return storeFilter;
    const ids = byStore
      .filter((s) => s.store_name.toLowerCase().includes(q) && (storeFilter.size === 0 || storeFilter.has(s.store_id)))
      .map((s) => s.store_id);
    return new Set(ids.length > 0 ? ids : [-1]);
  }, [storeFilter, storeQuery, byStore]);

  const markedDates = useMemo(
    () => Object.fromEntries(filteredDaily.map((d) => [d.notice_date, d.count])),
    [filteredDaily],
  );
  const selectedDay = filteredDaily.find((d) => d.notice_date === selectedDate) ?? null;

  // 지점별 자세히 / 상품별 현황이 공통으로 쓰는 조회 기간
  const matrixParams = useMemo(() => {
    if (selectedDay) return { date: selectedDay.notice_date };
    if (filterMode === "month") return { from: `${currentMonthKst()}-01`, to: `${currentMonthKst()}-31` };
    if (filterMode === "range") return { from: filterFrom, to: filterTo };
    return { date: todayKst() };
  }, [selectedDay, filterMode, filterFrom, filterTo]);

  const filterLabel = useMemo(() => {
    if (filterMode === "month") return `${currentMonthKst().replace("-", "년 ")}월`;
    if (filterMode === "today") return `오늘 (${todayKst()})`;
    return `${filterFrom} ~ ${filterTo}`;
  }, [filterMode, filterFrom, filterTo]);

  const toggleHistory = () => {
    if (!showHistory && history.length === 0) {
      setHistoryLoading(true);
      fetch("/api/admin/notices/history")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setHistory(Array.isArray(data) ? data : []))
        .finally(() => setHistoryLoading(false));
    }
    setShowHistory((v) => !v);
  };

  if (loading) {
    return <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">통계</h1>
        <p className="text-sm text-gray-500 mt-1">
          날짜를 선택하면 그날 오픈된 상품과 지점별 출고/패스 현황을 볼 수 있습니다.
        </p>
      </div>

      {/* 기간 필터 */}
      <div className="bg-white border border-gray-200 rounded-xl px-3 lg:px-4 py-3 flex flex-wrap items-center gap-2 lg:gap-3">
        {/* 빠른 선택 */}
        <div className="flex gap-1 border border-gray-200 rounded-lg overflow-hidden">
          {(["today", "month"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setFilterMode(m); setSelectedDate(null); }}
              className={`px-3 max-lg:px-2.5 py-1.5 max-lg:min-h-[44px] text-sm max-lg:text-[13px] font-medium transition-colors ${filterMode === m ? "bg-[#303236] text-white" : "text-gray-500 hover:text-gray-900"}`}
            >
              {m === "month" ? "이번 달" : "오늘"}
            </button>
          ))}
        </div>

        {/* 날짜 범위 인라인 */}
        <div className="flex items-center gap-1 lg:gap-1.5 max-lg:flex-1 max-lg:min-w-[170px]">
          <input
            type="date"
            value={filterFrom}
            max={filterTo}
            onFocus={() => { setFilterMode("range"); setSelectedDate(null); }}
            onChange={(e) => { setFilterMode("range"); setFilterFrom(e.target.value); setSelectedDate(null); }}
            className={`px-1 lg:px-3 py-1.5 max-lg:min-h-[44px] max-lg:flex-1 min-w-0 border rounded-lg text-sm max-lg:text-[11px] max-lg:tracking-tight focus:outline-none transition-colors ${filterMode === "range" ? "border-[#303236]" : "border-gray-200"}`}
          />
          <span className="text-gray-400 text-sm">~</span>
          <input
            type="date"
            value={filterTo}
            min={filterFrom}
            max={todayKst()}
            onFocus={() => { setFilterMode("range"); setSelectedDate(null); }}
            onChange={(e) => { setFilterMode("range"); setFilterTo(e.target.value); setSelectedDate(null); }}
            className={`px-1 lg:px-3 py-1.5 max-lg:min-h-[44px] max-lg:flex-1 min-w-0 border rounded-lg text-sm max-lg:text-[11px] max-lg:tracking-tight focus:outline-none transition-colors ${filterMode === "range" ? "border-[#303236]" : "border-gray-200"}`}
          />
        </div>

        {/* 지점 선택 */}
        {byStore.length > 0 && (
          <StoreFilterDropdown
            stores={byStore.map((s) => ({ store_id: s.store_id, store_name: s.store_name, store_code: s.store_code }))}
            selected={storeFilter}
            onChange={setStoreFilter}
          />
        )}

        {/* 지점명 검색 — 입력하는 즉시 아래 표들이 걸러진다 */}
        {byStore.length > 0 && (
          <div className="relative max-lg:w-full">
            <input
              value={storeQuery}
              onChange={(e) => setStoreQuery(e.target.value)}
              placeholder="지점명 검색"
              aria-label="지점명 검색"
              className="w-48 max-lg:w-full max-lg:min-h-[44px] pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#303236]"
            />
            {storeQuery && (
              <button
                type="button"
                onClick={() => setStoreQuery("")}
                aria-label="검색어 지우기"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 max-lg:w-11 max-lg:h-11 text-gray-400 hover:text-gray-700"
              >
                ×
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={toggleShip}
          title="지점명 ⇄ W지점명 전환"
          className="flex-shrink-0 px-2.5 py-1 max-lg:min-h-[44px] text-[12px] font-medium border border-gray-200 rounded-lg hover:border-[#303236] text-gray-500"
        >
          {showShip ? "W지점명" : "지점명"} ⇄
        </button>

        <span className="lg:ml-auto text-xs text-gray-400">{filterLabel}</span>
      </div>

      {/* 캘린더 + 지점별 현황 나란히 */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-stretch lg:items-start">
        {/* 캘린더 */}
        <div className="lg:flex-shrink-0">
          <StatsCalendar
            viewMonth={viewMonth}
            onViewMonthChange={setViewMonth}
            markedDates={markedDates}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
          />
        </div>

        {/* 지점별 현황 */}
        <div className="flex-1 min-w-0">
          {/* 탭: 지점별 / 상품별 */}
          <div className="flex gap-1 mb-3 border border-gray-200 rounded-lg overflow-hidden lg:w-fit">
            {([["store", "지점별 출고/패스 현황"], ["product", "상품별 출고/패스 현황"]] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setStatsTab(k)}
                className={`px-3.5 py-1.5 max-lg:min-h-[44px] max-lg:flex-1 max-lg:text-[13px] text-sm font-semibold transition-colors ${statsTab === k ? "bg-[#303236] text-white" : "text-gray-500 hover:text-gray-900"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {statsTab === "store" ? (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h2 className="text-sm font-bold text-gray-700 flex-1 max-lg:basis-full">
                  {selectedDay
                    ? `${fmtDate(selectedDay.notice_date)} 지점별 출고/패스 현황`
                    : `지점별 출고/패스 현황 (${filterLabel})`}
                  {(selectedDay ? selectedDay.byStore : filteredByStore).length > 0 && (
                    <span className="ml-2 font-normal text-gray-400">
                      {(selectedDay ? selectedDay.byStore : filteredByStore).length}개 지점
                    </span>
                  )}
                </h2>
                <button
                  onClick={() => setShowAllDetail((v) => !v)}
                  className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 max-lg:min-h-[44px] text-[12px] font-medium rounded-lg border transition-colors ${showAllDetail ? "border-[#303236] bg-[#303236] text-white" : "border-gray-200 text-gray-500 hover:border-gray-400"}`}
                >
                  전체 자세히 {showAllDetail ? "▲" : "▼"}
                </button>
                <button
                  onClick={async () => {
                    const rows = selectedDay ? selectedDay.byStore : filteredByStore;
                    if (rows.length === 0) return;
                    const XLSX = await import("xlsx");
                    const sheetRows = rows.map((r) => ({
                      "지점코드": r.store_code ?? "",
                      "지점명": r.store_name,
                      "W지점명": getShipName(r.store_code, r.store_name),
                      "전체": r.total,
                      "출고": r.outbound,
                      "패스": r.pass,
                      "패스율(%)": r.total > 0 ? Math.round((r.pass / r.total) * 100) : 0,
                    }));
                    const ws = XLSX.utils.json_to_sheet(sheetRows);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "지점별현황");
                    XLSX.writeFile(wb, `지점별현황_${filterLabel}.xlsx`);
                  }}
                  className="flex-shrink-0 px-2.5 py-1 max-lg:min-h-[44px] text-[12px] font-medium border border-gray-200 rounded-lg hover:border-[#303236] text-gray-500"
                >
                  엑셀
                </button>
              </div>
              <StoreStatsTable
                rows={selectedDay ? selectedDay.byStore : filteredByStore}
                emptyText={selectedDay ? "이 날짜에 접수된 출고/패스 현황이 없습니다." : "이 기간에 접수된 출고/패스 현황이 없습니다."}
                storeFilter={effectiveStoreFilter}
                showAllDetail={showAllDetail}
                matrixParams={matrixParams}
              />
            </>
          ) : (
            <>
              <h2 className="text-sm font-bold text-gray-700 mb-3">
                {selectedDay
                  ? `${fmtDate(selectedDay.notice_date)} 상품별 출고/패스 현황`
                  : `상품별 출고/패스 현황 (${filterLabel})`}
                <span className="ml-2 font-normal text-gray-400">상품을 누르면 패스한 지점이 보입니다</span>
              </h2>
              <ProductStatsTable matrixParams={matrixParams} storeFilter={effectiveStoreFilter} />
            </>
          )}
        </div>
      </div>

      {/* 일별 패스율 추이 그래프 — 리스트 하단, 기본 접힘 */}
      <DailyPassRateChart daily={filteredDaily} storeFilter={effectiveStoreFilter} />

      {/* 최근 상태 변경 이력 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={toggleHistory}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-bold text-gray-700">최근 상태 변경 이력</span>
          <span className="text-gray-400 text-base">{showHistory ? "▲" : "▼"}</span>
        </button>
        {showHistory && (
          <div className="border-t border-gray-100 px-4 lg:px-5 py-3">
            {historyLoading ? (
              <p className="text-[13px] text-gray-400 py-3">불러오는 중...</p>
            ) : history.length === 0 ? (
              <p className="text-[13px] text-gray-400 py-3">아직 변경 이력이 없습니다.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {history.map((h, i) => (
                  <div key={i} className="py-2.5 text-[13px] text-gray-600 flex items-start gap-2">
                    <span className="font-mono text-gray-400 flex-shrink-0">{fmtHistoryTime(h.created_at)}</span>
                    <span>— {h.summary} <span className="text-gray-400">({h.actor_name})</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
