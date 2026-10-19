"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";

// 시즌별 판매 통계 — arrival_sales_archive(동기화 때마다 누적, 삭제 안 됨) 기반.
// 작년 같은 시즌과 비교해 "어느 시기에 어떤 브랜드·카테고리·상품이 잘 팔렸는지" 본다.
import {
  type ArchiveRow as Row, type Agg, n, fmt, rate, salesRateOf, orderRateOf, avgRate, avgOrderRate, todayKst, dDayLabel,
  prevYearSeason, seasonRank, shiftYear, inRange, aggregate, useArchiveRows,
} from "@/lib/arrival-stats";
import ArrivalDateFilter from "./_components/ArrivalDateFilter";

type Tab = "brand" | "category" | "month" | "product";
const TABS: { key: Tab; label: string }[] = [
  { key: "brand", label: "브랜드" },
  { key: "category", label: "카테고리" },
  { key: "month", label: "입고월" },
  { key: "product", label: "상품" },
];


export default function ArrivalStatsPage() {
  const { rows, loading, error } = useArchiveRows();
  const [season, setSeason] = useState("");
  const [compare, setCompare] = useState("");
  const [brand, setBrand] = useState(""); // 빈 값 = 전체 브랜드
  const [tab, setTab] = useState<Tab>("brand");
  // 브랜드를 하나로 좁히면 "브랜드" 탭은 그룹이 1개뿐이라 의미가 없어 숨기고, 제품 목록은 전체를 보여준다
  const visibleTabs = brand ? TABS.filter(t => t.key !== "brand") : TABS;
  useEffect(() => { if (brand && tab === "brand") setTab("category"); }, [brand, tab]);
  const today = useMemo(todayKst, []);

  const seasons = useMemo(
    () => [...new Set(rows.map(r => r.season).filter(Boolean))].sort((a, b) => seasonRank(b) - seasonRank(a)),
    [rows],
  );

  // 최초 로드 시 최신 시즌 선택, 전년 같은 시즌이 있으면 비교 대상으로 자동 선택
  useEffect(() => {
    if (!season && seasons.length > 0) setSeason(seasons[0]);
  }, [seasons, season]);
  useEffect(() => {
    if (!season) return;
    const prev = prevYearSeason(season);
    setCompare(seasons.includes(prev) ? prev : "");
  }, [season, seasons]);

  // 입고일 기간 필터 (시즌 안에서 추가로 좁힌다). 비교 시즌에는 시즌 연도 차이만큼 이동한 같은 기간을 적용
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  useEffect(() => { setDateStart(""); setDateEnd(""); }, [season]);

  const yearGap = useMemo(() => {
    const a = /^(\d{2})/.exec(season), b = /^(\d{2})/.exec(compare);
    return a && b ? +a[1] - +b[1] : 0;
  }, [season, compare]);

  const seasonDates = useMemo(() => rows.filter(r => r.season === season).map(r => r.arrival_date), [rows, season]);
  const cur = useMemo(
    () => rows.filter(r => r.season === season && (!brand || r.brand === brand) && inRange(r.arrival_date, dateStart, dateEnd)),
    [rows, season, brand, dateStart, dateEnd],
  );
  const cmp = useMemo(() => {
    if (!compare) return [];
    const s = shiftYear(dateStart, yearGap), e = shiftYear(dateEnd, yearGap);
    return rows.filter(r => r.season === compare && (!brand || r.brand === brand) && inRange(r.arrival_date, s, e));
  }, [rows, compare, brand, dateStart, dateEnd, yearGap]);

  // 브랜드 필터 후보 — 선택한 시즌에 상품이 있는 브랜드(판매량 많은 순)
  const brands = useMemo(
    () => aggregate(rows.filter(r => r.season === season), r => r.brand).sort((x, y) => y.salesQty - x.salesQty).map(a => a.key),
    [rows, season],
  );
  useEffect(() => { if (brand && !brands.includes(brand)) setBrand(""); }, [brands, brand]);

  const total = useMemo(() => aggregate(cur, () => "all")[0], [cur]);
  const cmpTotal = useMemo(() => (cmp.length ? aggregate(cmp, () => "all")[0] : null), [cmp]);

  // 탭별 그룹 기준 (미분류는 aggregate와 동일하게 "(미분류)"로 묶는다)
  const groupKeyOf = useMemo(() => {
    const f = tab === "brand" ? (r: Row) => r.brand
      : tab === "category" ? (r: Row) => r.category
      : (r: Row) => r.arrival_date.slice(0, 7);
    return (r: Row) => f(r) || "(미분류)";
  }, [tab]);

  // 펼친 그룹 — 탭·시즌이 바뀌면 접는다
  const [openKey, setOpenKey] = useState<string | null>(null);
  useEffect(() => { setOpenKey(null); }, [tab, season]);

  const groups = useMemo(() => {
    if (tab === "product") return [];
    const list = aggregate(cur, groupKeyOf);
    return tab === "month" ? list.sort((a, b) => a.key.localeCompare(b.key)) : list.sort((a, b) => b.salesQty - a.salesQty);
  }, [cur, tab, groupKeyOf]);

  // 펼친 그룹의 세부: 상품 목록(판매순) + 다른 기준(브랜드↔카테고리) 소계
  const detail = useMemo(() => {
    if (!openKey) return null;
    const members = cur.filter(r => groupKeyOf(r) === openKey);
    const subs = aggregate(members, (r: Row) => r.brand).sort((a, b) => b.salesQty - a.salesQty);
    const items = [...members].sort((a, b) => n(b.sales_quantity) - n(a.sales_quantity));
    return { subs, items };
  }, [openKey, cur, groupKeyOf, tab]);

  const cmpMap = useMemo(() => {
    if (tab === "product" || !cmp.length) return new Map<string, Agg>();
    // 월별 비교는 "월" 숫자 기준(25-09 ↔ 26-09 대신 09월끼리)
    const keyOf = tab === "brand" ? (r: Row) => r.brand
      : tab === "category" ? (r: Row) => r.category
      : (r: Row) => r.arrival_date.slice(5, 7);
    return new Map(aggregate(cmp, keyOf).map(a => [a.key, a]));
  }, [cmp, tab]);

  const products = useMemo(() => {
    if (tab !== "product") return [];
    // 같은 상품코드는 입고일이 달라도 합산하지 않고 행 그대로(재진행 구분)
    return [...cur].sort((a, b) => n(b.sales_quantity) - n(a.sales_quantity)).slice(0, brand ? undefined : 30);
  }, [cur, tab, brand]);

  const lastUpdated = useMemo(
    () => rows.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), ""),
    [rows],
  );
  // 주문·판매 막대가 같은 눈금을 쓰도록 둘 중 큰 값을 기준으로 한다
  const maxQty = Math.max(1, ...groups.map(g => Math.max(g.orderQty, g.salesQty)));
  const delta = (a: number | null, b: number | null) => (a == null || b == null ? null : a - b);

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">시즌별 판매 통계</h1>
          <p className="text-base text-gray-400 mt-1">
            입고 스케쥴 동기화 때 누적된 데이터입니다. 시트에서 빠진 지난 시즌도 보존됩니다.
            {lastUpdated && <> 최근 갱신 {new Date(lastUpdated).toLocaleString("ko-KR")}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/arrival/stats/products${brand ? `?brand=${encodeURIComponent(brand)}` : ""}`} className="px-4 py-2.5 bg-[#303236] text-white text-[15px] font-semibold rounded hover:bg-[#243d5e]">
            제품별 상세 분석
          </Link>
          <Link href={`/admin/arrival/stats/timeline${brand ? `?brand=${encodeURIComponent(brand)}` : ""}`} className="px-4 py-2.5 bg-[#303236] text-white text-[15px] font-semibold rounded hover:bg-[#243d5e]">
            시기·속도 분석
          </Link>
          <Link href="/admin/arrival" className="px-4 py-2.5 border border-gray-300 text-[15px] font-semibold text-gray-700 rounded hover:bg-gray-50">
            ← 입고 스케쥴
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl text-base font-semibold text-amber-800">⚠ {error}</div>
      )}

      {loading ? (
        <div className="py-20 text-center text-gray-400">불러오는 중...</div>
      ) : !error && seasons.length === 0 ? (
        <div className="py-20 text-center text-gray-400">
          아직 쌓인 데이터가 없습니다. 입고 스케쥴에서 시트 동기화를 실행하세요. (입고일이 없는 상품은 제외됩니다)
        </div>
      ) : !error && (
        <>
          {/* 시즌 선택 */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-4 flex items-center flex-wrap gap-4">
            <label className="flex items-center gap-2 text-[15px] font-semibold text-gray-700">
              시즌
              <select value={season} onChange={e => setSeason(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-[15px] min-h-[44px]">
                {seasons.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[15px] font-semibold text-gray-700">
              브랜드
              <select value={brand} onChange={e => setBrand(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-[15px] min-h-[44px]">
                <option value="">전체</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[15px] font-semibold text-gray-700">
              비교
              <select value={compare} onChange={e => setCompare(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-[15px] min-h-[44px]">
                <option value="">비교 안 함</option>
                {seasons.filter(s => s !== season).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <ArrivalDateFilter dates={seasonDates} start={dateStart} end={dateEnd} onChange={(a, b) => { setDateStart(a); setDateEnd(b); }} />
            {!compare && prevYearSeason(season) && (
              <span className="text-sm text-gray-400">전년 {prevYearSeason(season)} 데이터는 아직 없습니다 (올해부터 누적)</span>
            )}
          </div>

          {/* 요약 */}
          {total && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                { label: "상품 수", v: total.products, c: cmpTotal?.products ?? null, unit: "개" },
                { label: "입고량", v: total.inQty, c: cmpTotal?.inQty ?? null, unit: "" },
                { label: "주문량", v: total.orderQty, c: cmpTotal?.orderQty ?? null, unit: "" },
                { label: "판매량", v: total.salesQty, c: cmpTotal?.salesQty ?? null, unit: "" },
                { label: "평균 주문율", v: avgOrderRate(total), c: avgOrderRate(cmpTotal), unit: "%" },
                { label: "평균 판매율", v: avgRate(total), c: avgRate(cmpTotal), unit: "%" },
              ].map(k => {
                const d = delta(k.v, k.c);
                return (
                  <div key={k.label} className="bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-4">
                    <div className="text-sm text-gray-400 font-semibold">{k.label}</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{k.v == null ? "—" : `${fmt(k.v)}${k.unit}`}</div>
                    {d != null && (
                      <div className={`text-sm font-semibold mt-1 ${d > 0 ? "text-emerald-600" : d < 0 ? "text-red-500" : "text-gray-400"}`}>
                        {compare} 대비 {d > 0 ? "+" : ""}{fmt(d)}{k.unit === "%" ? "%p" : k.unit}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 탭 */}
          <div className="flex gap-1 border-b border-gray-200">
            {visibleTabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-5 min-h-[44px] text-[15px] font-semibold border-b-2 -mb-px ${tab === t.key ? "border-[#303236] text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
            {tab !== "product" ? (
              <table className="w-full text-[15px] min-w-[720px]">
                <thead className="bg-gray-50 text-gray-500 text-sm">
                  <tr>
                    <th className="text-left px-4 py-3">{tab === "brand" ? "브랜드" : tab === "category" ? "카테고리" : "입고월"}</th>
                    <th className="text-right px-4 py-3">상품</th>
                    <th className="text-right px-4 py-3">입고</th>
                    <th className="text-right px-4 py-3">주문</th>
                    <th className="text-right px-4 py-3">판매</th>
                    <th className="px-4 py-3 w-[220px]">
                      <span className="inline-flex items-center gap-3">
                        주문·판매
                        <span className="inline-flex items-center gap-1 font-normal"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "#64748b" }} />주문</span>
                        <span className="inline-flex items-center gap-1 font-normal"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "#1e293b" }} />판매</span>
                      </span>
                    </th>
                    <th className="text-right px-4 py-3">주문율</th>
                    <th className="text-right px-4 py-3">판매율</th>
                    {compare && <th className="text-right px-4 py-3">{compare} 판매</th>}
                  </tr>
                </thead>
                <tbody>
                  {groups.map(g => {
                    const prev = cmpMap.get(tab === "month" ? g.key.slice(5, 7) : g.key);
                    const label = tab === "month" ? `${+g.key.slice(5, 7) || g.key}월` : g.label;
                    const isOpen = openKey === g.key;
                    return (<Fragment key={g.key}>
                      <tr
                        className="border-t border-gray-100 cursor-pointer hover:bg-gray-50"
                        onClick={() => setOpenKey(isOpen ? null : g.key)}
                        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenKey(isOpen ? null : g.key); } }}
                        tabIndex={0}
                        aria-expanded={isOpen}
                      >
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          <span className="inline-block w-4 text-gray-400">{isOpen ? "▾" : "▸"}</span>{label}
                        </td>
                        <td className="px-4 py-3 text-right">{fmt(g.products)}</td>
                        <td className="px-4 py-3 text-right">{fmt(g.inQty)}</td>
                        <td className="px-4 py-3 text-right">{fmt(g.orderQty)}</td>
                        <td className="px-4 py-3 text-right font-bold">{fmt(g.salesQty)}</td>
                        <td className="px-4 py-3">
                          <div className="space-y-[3px]" title={`주문 ${fmt(g.orderQty)} / 판매 ${fmt(g.salesQty)}`}>
                            <div className="h-2 bg-gray-100 rounded"><div className="h-2 rounded" style={{ width: `${(g.orderQty / maxQty) * 100}%`, background: "#64748b" }} /></div>
                            <div className="h-2 bg-gray-100 rounded"><div className="h-2 rounded" style={{ width: `${(g.salesQty / maxQty) * 100}%`, background: "#1e293b" }} /></div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600">{avgOrderRate(g) ?? "—"}{avgOrderRate(g) != null && "%"}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{avgRate(g) ?? "—"}{avgRate(g) != null && "%"}</td>
                        {compare && <td className="px-4 py-3 text-right text-gray-500">{prev ? fmt(prev.salesQty) : "—"}</td>}
                      </tr>
                      {isOpen && detail && (
                        <tr className="bg-gray-50/70">
                          <td colSpan={compare ? 9 : 8} className="px-4 py-4">
                            {/* 다른 기준 소계 (브랜드 탭이면 카테고리별, 카테고리·월별 탭이면 브랜드별) */}
                            {/* 브랜드 탭은 바로 제품 목록만 보여준다 */}
                            {tab !== "brand" && !brand && (<>
                              <div className="text-sm font-semibold text-gray-500 mb-2">브랜드별</div>
                              <div className="flex flex-wrap gap-2 mb-4">
                                {detail.subs.map(s => (
                                  <span key={s.key} className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm">
                                    <b className="text-gray-900">{s.label}</b>{" "}
                                    <span className="text-gray-500">주문 {fmt(s.orderQty)} · 판매 {fmt(s.salesQty)} · {avgRate(s) ?? "—"}{avgRate(s) != null && "%"}</span>
                                  </span>
                                ))}
                              </div>
                            </>)}
                            <div className="text-sm font-semibold text-gray-500 mb-2">상품 {detail.items.length}개 (판매순)</div>
                            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500">
                                  <tr>
                                    <th className="text-left px-3 py-2">상품</th>
                                    <th className="text-left px-3 py-2">입고일</th>
                                    <th className="text-right px-3 py-2">입고</th>
                                    <th className="text-right px-3 py-2">주문</th>
                                    <th className="text-right px-3 py-2">판매</th>
                                    <th className="text-right px-3 py-2">주문율</th>
                                    <th className="text-right px-3 py-2">판매율</th>
                                    <th className="text-right px-3 py-2">재고</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detail.items.map(p => {
                                    const r = salesRateOf(p);
                                    return (
                                      <tr key={`${p.product_code}-${p.arrival_date}`} className="border-t border-gray-100">
                                        <td className="px-3 py-2">
                                          {/* 브랜드가 이미 선택돼 있으면 브랜드명은 생략, 카테고리 탭에서는 카테고리 생략 */}
                                          <div className="text-xs text-gray-400">{[brand || tab === "brand" ? "" : p.brand, tab === "category" ? "" : p.category].filter(Boolean).join(" · ")}</div>
                                          <div className="font-semibold text-gray-900">{p.product_name || p.product_code}</div>
                                        </td>
                                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{p.arrival_date} <b className="text-gray-900">{dDayLabel(p.arrival_date, today)}</b></td>
                                        <td className="px-3 py-2 text-right">{fmt(n(p.quantity))}</td>
                                        <td className="px-3 py-2 text-right">{fmt(n(p.order_quantity))}</td>
                                        <td className="px-3 py-2 text-right font-bold">{fmt(n(p.sales_quantity))}</td>
                                        <td className="px-3 py-2 text-right font-bold text-blue-600">{orderRateOf(p) == null ? "—" : `${orderRateOf(p)}%`}</td>
                                        <td className="px-3 py-2 text-right font-bold text-emerald-600">{r == null ? "—" : `${r}%`}</td>
                                        <td className="px-3 py-2 text-right text-gray-500">{fmt(n(p.stock_quantity))}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>);
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-[15px] min-w-[720px]">
                <thead className="bg-gray-50 text-gray-500 text-sm">
                  <tr>
                    <th className="text-left px-4 py-3 w-12">#</th>
                    <th className="text-left px-4 py-3">상품</th>
                    <th className="text-left px-4 py-3">입고일</th>
                    <th className="text-right px-4 py-3">입고</th>
                    <th className="text-right px-4 py-3">주문</th>
                    <th className="text-right px-4 py-3">판매</th>
                    <th className="text-right px-4 py-3">주문율</th>
                    <th className="text-right px-4 py-3">판매율</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr key={`${p.product_code}-${p.arrival_date}`} className="border-t border-gray-100">
                      <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-400">{[brand ? "" : p.brand, p.category].filter(Boolean).join(" · ")}</div>
                        <div className="font-semibold text-gray-900">{p.product_name || p.product_code}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{p.arrival_date} <b className="text-gray-900">{dDayLabel(p.arrival_date, today)}</b></td>
                      <td className="px-4 py-3 text-right">{fmt(n(p.quantity))}</td>
                      <td className="px-4 py-3 text-right">{fmt(n(p.order_quantity))}</td>
                      <td className="px-4 py-3 text-right font-bold">{fmt(n(p.sales_quantity))}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600">{orderRateOf(p) ?? "—"}{orderRateOf(p) != null && "%"}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">{salesRateOf(p) ?? "—"}{salesRateOf(p) != null && "%"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="text-sm text-gray-400">
            판매율은 상품별 판매율(시트 값)의 평균이며, 주문이 있는 상품만 포함합니다. 판매량은 동기화 시점의 누적값이라, 입고가 오래된 상품일수록 높게 나오는 점을 감안해서 보세요.
          </p>
        </>
      )}
    </div>
  );
}
