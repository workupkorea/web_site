"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  type ArchiveRow as Row, type WeeklyRow, n, fmt, todayKst, dDayLabel, seasonRank, inRange, aggregate,
  addDays, useArchiveRows, useWeeklyRows,
} from "@/lib/arrival-stats";
import ArrivalDateFilter from "../_components/ArrivalDateFilter";

// 시기·속도 분석 — 시트의 주차별 주문·판매(주간 증분)를 기반으로
//  (1) 어떤 시기(주)에 어떤 제품의 주문·판매가 이루어졌는지,
//  (2) 입고일 이후 얼마만에 주문·판매가 일어났는지를 본다. 주차는 월~일, 입고 주 = 0주차.
const C = { order: "#64748b", sales: "#1e293b" } as const;
const WEEK_MS = 7 * 86_400_000;

// 날짜가 속한 주의 월요일 (시트 주차 라벨이 월~일 기준)
const mondayOf = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return addDays(iso, -((d.getUTCDay() + 6) % 7));
};
const weeksBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / WEEK_MS);
const md = (iso: string) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;
// 월요일 시작 주 → "8월 2주차". 주의 목요일이 속한 달·그 달의 몇 번째 주인지로 정한다(ISO 방식).
// 입고일 필터의 N주차(1일이 속한 주 = 1주차)와 같은 결과다.
const weekOfMonth = (mondayIso: string) => {
  const thu = addDays(mondayIso, 3);
  return { month: +thu.slice(5, 7), nth: Math.floor((+thu.slice(8, 10) - 1) / 7) + 1 };
};
const relLabel = (k: number) => (k < 0 ? "입고 전" : k === 0 ? "입고 주" : `${k}주차`);

type Tab = "period" | "speed";
type SpeedSort = "firstSales" | "half" | "w4";
const SPEED_SORTS: { key: SpeedSort; label: string }[] = [
  { key: "firstSales", label: "첫 판매 빠른 순" },
  { key: "half", label: "50% 도달 빠른 순" },
  { key: "w4", label: "4주차 누적 판매순" },
];
const ALL_SEASONS = "ALL";
const CUM_WEEKS = [0, 1, 2, 4] as const;

interface ProdWeekly {
  meta: Row;
  rel: Map<number, { o: number; s: number }>; // 입고 주 기준 상대 주차(0 이상) → 그 주 증분. 입고 전 기록은 0주차에 합산
  byWeek: Map<string, { o: number; s: number }>; // 달력 주(월요일 날짜) → 그 주 증분 (시기별 보기용, 입고 전 주 포함)
  totalO: number; totalS: number;
  firstOrder: number | null; firstSales: number | null; halfAt: number | null;
  arrivalWeek: string;
}

export default function ArrivalTimelinePage() {
  const arch = useArchiveRows();
  const wk = useWeeklyRows();
  const today = useMemo(todayKst, []);

  const [tab, setTab] = useState<Tab>("period");
  const [season, setSeason] = useState(ALL_SEASONS); // 기본은 전체 기간(모든 시즌)
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [q, setQ] = useState("");
  const [week, setWeek] = useState<string | null>(null);
  const [dotMetric, setDotMetric] = useState<"s" | "o">("s"); // 카테고리×시기 도트: 판매 / 주문
  const [weekSort, setWeekSort] = useState<"sales" | "order">("sales");
  const [speedSort, setSpeedSort] = useState<SpeedSort>("firstSales");
  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get("brand");
    if (b) setBrand(b);
  }, []);

  const seasons = useMemo(
    () => [...new Set(arch.rows.map(r => r.season).filter(Boolean))].sort((a, b) => seasonRank(b) - seasonRank(a)),
    [arch.rows],
  );
  useEffect(() => { setDateStart(""); setDateEnd(""); setWeek(null); }, [season]);

  const inSeason = useMemo(() => (season === ALL_SEASONS ? arch.rows : arch.rows.filter(r => r.season === season)), [arch.rows, season]);
  const seasonDates = useMemo(() => inSeason.map(r => r.arrival_date), [inSeason]);
  const brands = useMemo(() => aggregate(inSeason, r => r.brand).sort((a, b) => b.salesQty - a.salesQty).map(a => a.key), [inSeason]);
  const categories = useMemo(
    () => aggregate(inSeason.filter(r => !brand || r.brand === brand), r => r.category).sort((a, b) => b.salesQty - a.salesQty).map(a => a.key),
    [inSeason, brand],
  );
  useEffect(() => { if (brand && brands.length && !brands.includes(brand)) setBrand(""); }, [brands, brand]);
  useEffect(() => { if (category && !categories.includes(category)) setCategory(""); }, [categories, category]);

  // 필터를 통과한 제품 (키: 상품코드::입고일)
  const metas = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return inSeason.filter(r =>
      (!brand || r.brand === brand) && (!category || r.category === category) &&
      inRange(r.arrival_date, dateStart, dateEnd) &&
      (!kw || r.product_name.toLowerCase().includes(kw) || r.product_code.toLowerCase().includes(kw)));
  }, [inSeason, brand, category, dateStart, dateEnd, q]);

  // 데이터가 있는 가장 최근 주 (시트의 진행 중인 주는 아직 비어 있을 수 있다)
  const lastWeek = useMemo(() => wk.rows.reduce((m, r) => (r.week_start > m ? r.week_start : m), ""), [wk.rows]);

  const prods = useMemo(() => {
    const byKey = new Map(metas.map(m => [`${m.product_code}::${m.arrival_date}`, m]));
    const map = new Map<string, ProdWeekly>();
    for (const w of wk.rows) {
      const key = `${w.product_code}::${w.arrival_date}`;
      const meta = byKey.get(key);
      if (!meta) continue;
      const aw = mondayOf(meta.arrival_date);
      const p = map.get(key) ?? { meta, rel: new Map(), byWeek: new Map(), totalO: 0, totalS: 0, firstOrder: null, firstSales: null, halfAt: null, arrivalWeek: aw };
      // 입고 전(선주문·선판매·조기 출고 등) 소량 기록이 "첫 주문/첫 판매"를 입고 몇 주 전으로 보이게 하므로 입고 주(0주차)에 합산한다
      const k = Math.max(0, weeksBetween(aw, w.week_start));
      const cur = p.rel.get(k) ?? { o: 0, s: 0 };
      cur.o += n(w.order_qty); cur.s += n(w.sales_qty);
      p.rel.set(k, cur);
      const cw = p.byWeek.get(w.week_start) ?? { o: 0, s: 0 };
      cw.o += n(w.order_qty); cw.s += n(w.sales_qty);
      p.byWeek.set(w.week_start, cw);
      map.set(key, p);
    }
    for (const p of map.values()) {
      const ks = [...p.rel.keys()].sort((a, b) => a - b);
      let cum = 0;
      for (const k of ks) { const v = p.rel.get(k)!; p.totalO += v.o; p.totalS += v.s; }
      for (const k of ks) {
        const v = p.rel.get(k)!;
        if (p.firstOrder == null && v.o > 0) p.firstOrder = k;
        if (p.firstSales == null && v.s > 0) p.firstSales = k;
        cum += v.s;
        if (p.halfAt == null && p.totalS > 0 && cum >= p.totalS / 2) p.halfAt = k;
      }
    }
    return [...map.values()];
  }, [metas, wk.rows]);

  // ── 시기별: 주 단위 합계 ──
  const weeks = useMemo(() => {
    const keySet = new Set(prods.map(p => `${p.meta.product_code}::${p.meta.arrival_date}`));
    const m = new Map<string, { o: number; s: number }>();
    for (const w of wk.rows) {
      if (!keySet.has(`${w.product_code}::${w.arrival_date}`)) continue;
      const cur = m.get(w.week_start) ?? { o: 0, s: 0 };
      cur.o += n(w.order_qty); cur.s += n(w.sales_qty);
      m.set(w.week_start, cur);
    }
    return [...m.entries()].map(([start, v]) => ({ start, ...v })).sort((a, b) => a.start.localeCompare(b.start));
  }, [prods, wk.rows]);
  const weekMax = Math.max(1, ...weeks.map(w => Math.max(w.o, w.s)));

  // 카테고리 × 주 집계 (도트 그래프). 합계가 큰 카테고리가 위로 오도록 정렬
  const catDots = useMemo(() => {
    const map = new Map<string, { total: { o: number; s: number }; byWeek: Map<string, { o: number; s: number }> }>();
    for (const p of prods) {
      const cat = p.meta.category || "(미분류)";
      const row = map.get(cat) ?? { total: { o: 0, s: 0 }, byWeek: new Map() };
      for (const [wk, v] of p.byWeek) {
        const cur = row.byWeek.get(wk) ?? { o: 0, s: 0 };
        cur.o += v.o; cur.s += v.s;
        row.byWeek.set(wk, cur);
        row.total.o += v.o; row.total.s += v.s;
      }
      map.set(cat, row);
    }
    return [...map.entries()].map(([cat, v]) => ({ cat, ...v }));
  }, [prods]);
  // 마지막 데이터 주 이후 ~ 이번 주 중 값이 아직 없는 주 (시트 수식 오류·진행 중인 주). 빈 공간 대신 "집계 전"으로 표시한다
  const pendingWeeks = useMemo(() => {
    const out: string[] = [];
    if (!lastWeek) return out;
    for (let w = addDays(lastWeek, 7); w <= mondayOf(today) && out.length < 8; w = addDays(w, 7)) out.push(w);
    return out;
  }, [lastWeek, today]);
  const activeWeek = week && weeks.some(w => w.start === week) ? week : weeks.length ? weeks[weeks.length - 1].start : null;

  const weekProducts = useMemo(() => {
    if (!activeWeek) return [];
    const list: { meta: Row; o: number; s: number; co: number; cs: number }[] = [];
    for (const p of prods) {
      const v = p.byWeek.get(activeWeek);
      if (v && (v.o > 0 || v.s > 0)) {
        // 그 주까지의 누적 (주 값은 증분이라, 선주문이 앞선 주에 몰린 제품의 "주문 0"이 누락으로 보이지 않게 함께 보여준다)
        let co = 0, cs = 0;
        for (const [wk, x] of p.byWeek) if (wk <= activeWeek) { co += x.o; cs += x.s; }
        list.push({ meta: p.meta, o: v.o, s: v.s, co, cs });
      }
    }
    return list.sort((a, b) => (weekSort === "sales" ? b.s - a.s || b.o - a.o : b.o - a.o || b.s - a.s));
  }, [prods, activeWeek, weekSort]);

  // ── 입고 후 속도: 입고 주 기준 상대 주차별 제품당 평균 ──
  const curve = useMemo(() => {
    const MAXK = 9;
    return Array.from({ length: MAXK + 1 }, (_, k) => {
      let o = 0, s = 0, cnt = 0;
      for (const p of prods) {
        // 그 주가 이미 지난(데이터 범위 안인) 제품만 평균에 넣어 최근 입고 제품이 평균을 깎지 않게 한다
        if (!lastWeek || addDays(p.arrivalWeek, k * 7) > lastWeek) continue;
        const v = p.rel.get(k);
        o += v?.o ?? 0; s += v?.s ?? 0; cnt++;
      }
      return { k, o: cnt ? o / cnt : 0, s: cnt ? s / cnt : 0, cnt };
    });
  }, [prods, lastWeek]);
  const curveMax = Math.max(1, ...curve.map(c => Math.max(c.o, c.s)));

  const speedList = useMemo(() => {
    const val = (p: ProdWeekly) => {
      switch (speedSort) {
        case "firstSales": return p.firstSales ?? 99;
        case "half": return p.halfAt ?? 99;
        case "w4": return -cumTo(p, 4).s;
      }
    };
    return [...prods].sort((a, b) => val(a) - val(b) || b.totalS - a.totalS);
  }, [prods, speedSort, lastWeek]);

  // 입고 후 k주차까지 누적 (아직 그 주가 지나지 않았으면 null)
  function cumTo(p: ProdWeekly, k: number) {
    let o = 0, s = 0;
    for (const [rk, v] of p.rel) if (rk <= k) { o += v.o; s += v.s; }
    return { o, s, ready: !!lastWeek && addDays(p.arrivalWeek, k * 7) <= lastWeek };
  }
  const avg = (vals: (number | null)[]) => {
    const xs = vals.filter((v): v is number => v != null);
    return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
  };

  const loading = arch.loading || wk.loading;
  const error = arch.error || wk.error;
  const filtered = !!(brand || category || dateStart || dateEnd || q);

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">시기 · 속도 분석</h1>
          <p className="text-base text-gray-400 mt-1">언제 어떤 제품이 주문·판매됐는지, 입고 후 얼마만에 반응이 왔는지 봅니다. (시트 주차별 데이터, 월~일 기준)</p>
        </div>
        <Link href="/admin/arrival/stats" className="px-4 py-2.5 border border-gray-300 text-[15px] font-semibold text-gray-700 rounded hover:bg-gray-50">
          ← 시즌별 판매 통계
        </Link>
      </div>

      {error && <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl text-base font-semibold text-amber-800">⚠ {error}</div>}

      {loading ? (
        <div className="py-20 text-center text-gray-400">불러오는 중...</div>
      ) : !error && wk.rows.length === 0 ? (
        <div className="py-20 text-center text-gray-400">
          아직 주차별 데이터가 없습니다. 입고 스케쥴에서 시트 동기화를 실행하세요.
        </div>
      ) : !error && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-4 flex items-center flex-wrap gap-4">
            <Sel label="시즌" value={season} onChange={setSeason} options={[[ALL_SEASONS, "전체"], ...seasons.map(s => [s, s] as [string, string])]} />
            <Sel label="브랜드" value={brand} onChange={setBrand} options={[["", "전체"], ...brands.map(b => [b, b] as [string, string])]} />
            <Sel label="카테고리" value={category} onChange={setCategory} options={[["", "전체"], ...categories.map(c => [c, c] as [string, string])]} />
            <ArrivalDateFilter dates={seasonDates} start={dateStart} end={dateEnd} onChange={(a, b) => { setDateStart(a); setDateEnd(b); }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="제품명·코드 검색" className="border border-gray-300 rounded px-3 py-2 text-[15px] min-h-[44px] min-w-[180px]" aria-label="제품명 또는 코드 검색" />
            {filtered && (
              <button onClick={() => { setBrand(""); setCategory(""); setDateStart(""); setDateEnd(""); setQ(""); }} className="px-3 min-h-[44px] text-sm text-gray-500 underline">필터 해제</button>
            )}
          </div>

          <div className="flex gap-1 border-b border-gray-200">
            {([["period", "시기별 (언제)"], ["speed", "입고 후 속도 (얼마만에)"]] as [Tab, string][]).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`px-5 min-h-[44px] text-[15px] font-semibold border-b-2 -mb-px ${tab === k ? "border-[#303236] text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"}`}>{l}</button>
            ))}
          </div>

          {prods.length === 0 ? (
            <div className="py-16 text-center text-gray-400 bg-white border border-gray-200 rounded-xl">조건에 맞는 주문·판매 기록이 없습니다.</div>
          ) : tab === "period" ? (
            <>
              <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <h2 className="text-lg font-bold text-gray-900">주별 주문 · 판매</h2>
                  <Legend />
                </div>
                <p className="text-sm text-gray-400 mb-4">주를 누르면 그 주에 주문·판매가 이루어진 제품이 아래에 나옵니다.</p>
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-2 h-[200px] w-full min-w-max px-1">
                    {weeks.map(w => {
                      const on = w.start === activeWeek;
                      return (
                        <button
                          key={w.start} onClick={() => setWeek(w.start)}
                          className={`flex flex-col items-center justify-end h-full flex-1 min-w-[64px] rounded-lg px-1 ${on ? "bg-slate-100" : "hover:bg-gray-50"}`}
                          title={`${md(w.start)}~${md(addDays(w.start, 6))} · 주문 ${fmt(w.o)} / 판매 ${fmt(w.s)}`}
                          aria-pressed={on}
                        >
                          <div className="text-[11px] tabular-nums text-gray-500 leading-tight text-center">
                            <div>{fmt(w.o)}</div><div className="font-bold text-gray-900">{fmt(w.s)}</div>
                          </div>
                          <div className="flex items-end gap-[2px] flex-1 w-full mt-1">
                            <div className="flex-1 rounded-t" style={{ height: `${(w.o / weekMax) * 100}%`, background: C.order, minHeight: w.o ? 2 : 0 }} />
                            <div className="flex-1 rounded-t" style={{ height: `${(w.s / weekMax) * 100}%`, background: C.sales, minHeight: w.s ? 2 : 0 }} />
                          </div>
                          <div className="text-[11px] text-gray-500 mt-1 whitespace-nowrap">{md(w.start)}~</div>
                        </button>
                      );
                    })}
                    {pendingWeeks.map(w => (
                      <div key={w} className="flex flex-col items-center justify-end h-full flex-1 min-w-[64px] px-1" title={`${md(w)}~${md(addDays(w, 6))} · 시트에 아직 집계값이 없습니다`}>
                        <div className="flex-1 w-full flex items-center justify-center text-[11px] text-gray-300 text-center leading-tight">집계<br />전</div>
                        <div className="text-[11px] text-gray-300 mt-1 whitespace-nowrap">{md(w)}~</div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* 카테고리 × 시기 도트 그래프 */}
              <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <h2 className="text-lg font-bold text-gray-900">카테고리별 판매 시기</h2>
                  <div className="flex items-center gap-1" role="group" aria-label="도트 기준">
                    {([["s", "판매"], ["o", "주문"]] as ["s" | "o", string][]).map(([k, l]) => (
                      <button key={k} onClick={() => setDotMetric(k)} className={`px-3 min-h-[36px] rounded text-sm font-semibold ${dotMetric === k ? "bg-[#303236] text-white" : "text-gray-500 hover:text-gray-900"}`}>{l}량</button>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-400 mb-3">가로는 시기, 세로는 그 주의 {dotMetric === "s" ? "판매" : "주문"}량이고 점 색이 카테고리입니다. 한 주 칸 안에 카테고리별 점이 나란히 놓입니다. 범례나 점에 마우스를 올리면 그 카테고리만 강조되며 수량이 보이고, 범례를 누르면 카테고리를 켜고 끌 수 있습니다.</p>
                <CategoryScatter data={catDots} weeks={weeks.map(w => w.start)} metric={dotMetric} />
              </section>

              {activeWeek && (
                <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
                  <div className="px-5 py-3 flex items-center gap-2 flex-wrap border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">{md(activeWeek)}~{md(addDays(activeWeek, 6))} 주문·판매 제품 <span className="text-sm font-medium text-gray-400">그 주에 새로 들어온 수량과 그 주까지의 누적</span></h2>
                    <span className="text-sm text-gray-400">{fmt(weekProducts.length)}개</span>
                    <span className="ml-auto text-sm font-semibold text-gray-500">정렬</span>
                    {([["sales", "판매량"], ["order", "주문량"]] as ["sales" | "order", string][]).map(([k, l]) => (
                      <button key={k} onClick={() => setWeekSort(k)} className={`px-3 min-h-[36px] rounded text-sm font-semibold ${weekSort === k ? "bg-[#303236] text-white" : "text-gray-500 hover:text-gray-900"}`}>{l}{weekSort === k ? " ▼" : ""}</button>
                    ))}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="text-left px-4 py-3">제품</th>
                          <th className="text-left px-3 py-3">입고일</th>
                          <th className="text-left px-3 py-3">입고 후 경과</th>
                          <th className="text-right px-3 py-3">그 주 주문</th>
                          <th className="text-right px-3 py-3">그 주 판매</th>
                          <th className="text-right px-3 py-3">누적 주문</th>
                          <th className="text-right px-3 py-3">누적 판매</th>
                          <th className="px-3 py-3 w-[160px]">주문·판매</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weekProducts.slice(0, 50).map(r => {
                          const mx = Math.max(1, weekProducts[0] ? Math.max(...weekProducts.map(x => Math.max(x.o, x.s))) : 1);
                          return (
                            <tr key={`${r.meta.product_code}-${r.meta.arrival_date}`} className="border-t border-gray-100">
                              <td className="px-4 py-2.5">
                                <div className="text-xs text-gray-400">{[brand ? "" : r.meta.brand, r.meta.category].filter(Boolean).join(" · ")}</div>
                                <div className="font-semibold text-gray-900">{r.meta.product_name || r.meta.product_code}</div>
                              </td>
                              <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.meta.arrival_date} <b className="text-gray-900">{dDayLabel(r.meta.arrival_date, today)}</b></td>
                              <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{relLabel(weeksBetween(mondayOf(r.meta.arrival_date), activeWeek))}</td>
                              <td className="px-3 py-2.5 text-right">{fmt(r.o)}</td>
                              <td className="px-3 py-2.5 text-right font-bold">{fmt(r.s)}</td>
                              <td className="px-3 py-2.5 text-right text-gray-500">{fmt(r.co)}</td>
                              <td className="px-3 py-2.5 text-right text-gray-500">{fmt(r.cs)}</td>
                              <td className="px-3 py-2.5">
                                <div className="space-y-[3px]">
                                  <div className="h-2 bg-gray-100 rounded"><div className="h-2 rounded" style={{ width: `${(r.o / mx) * 100}%`, background: C.order }} /></div>
                                  <div className="h-2 bg-gray-100 rounded"><div className="h-2 rounded" style={{ width: `${(r.s / mx) * 100}%`, background: C.sales }} /></div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {weekProducts.length > 50 && <p className="px-5 py-3 text-sm text-gray-400">상위 50개만 표시합니다. 필터로 좁혀 보세요.</p>}
                </section>
              )}
            </>
          ) : (
            <>
              <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <h2 className="text-lg font-bold text-gray-900">입고 후 주차별 제품당 평균 주문 · 판매</h2>
                  <Legend />
                </div>
                <p className="text-sm text-gray-400 mb-4">입고 주 = 0주차. 그 주가 이미 지난 제품만 평균에 넣습니다(막대 아래 숫자는 평균에 쓴 제품 수).</p>
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-3 h-[200px] w-full min-w-max px-1">
                    {curve.map(c => (
                      <div key={c.k} className="flex flex-col items-center justify-end h-full flex-1 min-w-[64px]" title={`${relLabel(c.k)} · 제품 ${c.cnt}개 · 평균 주문 ${c.o.toFixed(1)} / 판매 ${c.s.toFixed(1)}`}>
                        <div className="text-[11px] tabular-nums text-gray-500 leading-tight text-center">
                          <div>{c.cnt ? Math.round(c.o).toLocaleString("ko-KR") : "—"}</div>
                          <div className="font-bold text-gray-900">{c.cnt ? Math.round(c.s).toLocaleString("ko-KR") : "—"}</div>
                        </div>
                        <div className="flex items-end gap-[2px] flex-1 w-full mt-1">
                          <div className="flex-1 rounded-t" style={{ height: `${(c.o / curveMax) * 100}%`, background: C.order, minHeight: c.o ? 2 : 0 }} />
                          <div className="flex-1 rounded-t" style={{ height: `${(c.s / curveMax) * 100}%`, background: C.sales, minHeight: c.s ? 2 : 0 }} />
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1 whitespace-nowrap">{relLabel(c.k)}</div>
                        <div className="text-[10px] text-gray-400">{c.cnt}개</div>
                      </div>
                    ))}
                  </div>
                </div>
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 text-sm">
                  <Stat l="첫 주문까지(평균)" v={fmtWeek(avg(prods.map(p => p.firstOrder)))} />
                  <Stat l="첫 판매까지(평균)" v={fmtWeek(avg(prods.map(p => p.firstSales)))} />
                  <Stat l="판매 50% 도달(평균)" v={fmtWeek(avg(prods.map(p => p.halfAt)))} />
                  <Stat l="분석 제품" v={`${fmt(prods.length)}개`} />
                </dl>
              </section>

              <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
                <div className="px-5 py-3 flex items-center gap-2 flex-wrap border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900">제품별 반응 속도</h2>
                  <span className="ml-auto text-sm font-semibold text-gray-500">정렬</span>
                  {SPEED_SORTS.map(o => (
                    <button key={o.key} onClick={() => setSpeedSort(o.key)} className={`px-3 min-h-[36px] rounded text-sm font-semibold ${speedSort === o.key ? "bg-[#303236] text-white" : "text-gray-500 hover:text-gray-900"}`}>{o.label}</button>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[1000px]">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="text-left px-4 py-3">제품</th>
                        <th className="text-left px-3 py-3">입고일</th>
                        <th className="text-right px-3 py-3">첫 주문</th>
                        <th className="text-right px-3 py-3">첫 판매</th>
                        <th className="text-right px-3 py-3">50% 도달</th>
                        {CUM_WEEKS.map(k => (
                          <th key={k} className="text-right px-3 py-3">
                            {k === 0 ? "입고 주" : `${k}주차`} 누적
                            <div className="font-normal text-xs whitespace-nowrap">주문 / 판매</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {speedList.map(p => (
                        <tr key={`${p.meta.product_code}-${p.meta.arrival_date}`} className="border-t border-gray-100">
                          <td className="px-4 py-2.5">
                            <div className="text-xs text-gray-400">{[brand ? "" : p.meta.brand, p.meta.category].filter(Boolean).join(" · ")}</div>
                            <div className="font-semibold text-gray-900">{p.meta.product_name || p.meta.product_code}</div>
                          </td>
                          <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{p.meta.arrival_date} <b className="text-gray-900">{dDayLabel(p.meta.arrival_date, today)}</b></td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">{p.firstOrder == null ? "—" : relLabel(p.firstOrder)}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">{p.firstSales == null ? "—" : relLabel(p.firstSales)}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">{p.halfAt == null ? "—" : relLabel(p.halfAt)}</td>
                          {CUM_WEEKS.map(k => {
                            const c = cumTo(p, k);
                            return <td key={k} className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">{c.ready ? <>{fmt(c.o)} / <b>{fmt(c.s)}</b></> : <span className="text-gray-300">—</span>}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          <p className="text-sm text-gray-400">
            시트 주차 열의 주간 증분 값입니다. 입고 주 이전의 주문·판매는 "입고 후 속도" 분석에서 입고 주(0주차)에 합산하며, 시트에 주 열이 생기기 전의 주문·판매나 오류("#REF!") 상태인 주는 포함되지 않습니다.
            {lastWeek && <> 데이터가 있는 마지막 주: {md(lastWeek)}~{md(addDays(lastWeek, 6))}.</>}
          </p>
        </>
      )}
    </div>
  );
}

// 평균 주차 표기. 입고 주(0주차) 기준이라 ±0.5주 안이면 "입고 주", 음수는 입고 전(선주문·선판매)을 뜻한다
const fmtWeek = (v: number | null) =>
  v == null ? "—" : Math.abs(v) < 0.5 ? "입고 주" : v < 0 ? `입고 ${Math.abs(v)}주 전` : `입고 후 ${v}주차`;

// 카테고리별 주차 산점도: X = 시기(월·주차), Y = 판매(또는 주문)량, 점 색 = 카테고리. 범례를 눌러 카테고리를 켜고 끈다.
// 카테고리 색은 합계 순서대로 고정 배정하고, 8개를 넘는 카테고리는 "기타"로 묶는다(색이 돌려 쓰이지 않도록).
const CAT_COLORS = ["#E8A33D", "#2F7D32", "#2563EB", "#9333EA", "#DC2626", "#0891B2", "#92400E", "#DB2777"];
const OTHER_COLOR = "#9CA3AF";

function CategoryScatter({ data, weeks, metric }: {
  data: { cat: string; total: { o: number; s: number }; byWeek: Map<string, { o: number; s: number }> }[];
  weeks: string[]; metric: "s" | "o";
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<string | null>(null); // 강조할 카테고리 (범례·점에 마우스를 올리면 나머지는 흐려진다)

  const series = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.total[metric] - a.total[metric]);
    const top = sorted.slice(0, CAT_COLORS.length);
    const rest = sorted.slice(CAT_COLORS.length);
    const out = top.map((d, i) => ({ name: d.cat, color: CAT_COLORS[i], byWeek: d.byWeek }));
    if (rest.length) {
      const merged = new Map<string, { o: number; s: number }>();
      for (const d of rest) for (const [w, v] of d.byWeek) {
        const cur = merged.get(w) ?? { o: 0, s: 0 };
        cur.o += v.o; cur.s += v.s; merged.set(w, cur);
      }
      out.push({ name: "기타", color: OTHER_COLOR, byWeek: merged });
    }
    return out;
  }, [data, metric]);

  const shown = series.filter(x => !hidden.has(x.name));
  const rawMax = Math.max(1, ...shown.flatMap(x => weeks.map(w => x.byWeek.get(w)?.[metric] ?? 0)));
  // 보기 좋은 눈금: 1·2·5 × 10^n
  const step = (() => {
    const raw = rawMax / 4, pow = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / pow;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  })();
  const yMax = Math.ceil(rawMax / step) * step;
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);

  const W = 960, H = 380, L = 64, R = 20, T = 14, B = 56;
  const iw = W - L - R, ih = H - T - B;
  const colW = iw / Math.max(1, weeks.length);
  const x = (i: number) => L + (i + 0.5) * colW;
  // 한 주 칸 안에서 보이는 카테고리 수만큼 좌우로 나눠 점이 겹치지 않게 한다 (점 지름 이하로는 좁히지 않는다)
  const R_DOT = 6;
  const gap = shown.length > 1 ? Math.min(2 * R_DOT + 2, (colW * 0.82) / (shown.length - 1)) : 0;
  const dodge = (k: number) => (k - (shown.length - 1) / 2) * gap;
  const y = (v: number) => T + ih - (v / yMax) * ih;
  const toggle = (name: string) => setHidden(cur => { const nx = new Set(cur); if (nx.has(name)) nx.delete(name); else nx.add(name); return nx; });

  if (series.length === 0 || weeks.length === 0) return <div className="py-10 text-center text-gray-400">표시할 데이터가 없습니다.</div>;
  return (
    <div>
      <div className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap mb-2" role="group" aria-label="카테고리 선택">
        {series.map(x => {
          const off = hidden.has(x.name);
          return (
            <button key={x.name} onClick={() => toggle(x.name)} onMouseEnter={() => setHover(x.name)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(x.name)} onBlur={() => setHover(null)} aria-pressed={!off} className={`inline-flex items-center gap-1.5 px-2 min-h-[32px] text-sm ${off ? "text-gray-300" : "text-gray-700"}`}>
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: off ? "#e5e7eb" : x.color }} />{x.name}
            </button>
          );
        })}
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 640 }} role="img" aria-label={`카테고리별 주차별 ${metric === "s" ? "판매" : "주문"}량 산점도`}>
          {/* 점선 격자 + Y 눈금 */}
          {ticks.map(t => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#d1d5db" strokeDasharray="3 3" />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="#4b5563">{fmt(t)}</text>
            </g>
          ))}
          {weeks.map((w, i) => (
            <g key={w}>
              <line x1={x(i)} x2={x(i)} y1={T} y2={T + ih} stroke="#e5e7eb" strokeDasharray="3 3" />
              <text x={x(i)} y={H - 32} textAnchor="middle" fontSize="12" fontWeight={600} fill="#374151">
                <tspan x={x(i)} dy="0">{weekOfMonth(w).month}월</tspan>
                <tspan x={x(i)} dy="15">{weekOfMonth(w).nth}주차</tspan>
                <title>{`${md(w)}~${md(addDays(w, 6))}`}</title>
              </text>
            </g>
          ))}
          <line x1={L} x2={L} y1={T} y2={T + ih} stroke="#6b7280" />
          <line x1={L} x2={W - R} y1={T + ih} y2={T + ih} stroke="#6b7280" />
          {/* 점: 주 칸 안에서 카테고리별로 나란히 배치. 점에서 바닥선까지 가는 줄을 그어 높이를 읽기 쉽게 한다 */}
          {shown.map((sr, k) => weeks.map((w, i) => {
            const v = sr.byWeek.get(w)?.[metric] ?? 0;
            if (!v) return null;
            const faded = hover != null && hover !== sr.name;
            const cx = x(i) + dodge(k), cy = y(v);
            return (
              <g key={`${sr.name}-${w}`} opacity={faded ? 0.15 : 1} onMouseEnter={() => setHover(sr.name)} onMouseLeave={() => setHover(null)}>
                <line x1={cx} x2={cx} y1={cy} y2={T + ih} stroke={sr.color} strokeOpacity={0.35} strokeWidth={2} />
                <circle cx={cx} cy={cy} r={hover === sr.name ? R_DOT + 2 : R_DOT} fill={sr.color} stroke="#fff" strokeWidth={1.5}>
                  <title>{`${sr.name} · ${weekOfMonth(w).month}월 ${weekOfMonth(w).nth}주차 (${md(w)}~${md(addDays(w, 6))}) · ${metric === "s" ? "판매" : "주문"} ${fmt(v)}`}</title>
                </circle>
                {/* 강조 중인 카테고리는 값을 점 위에 표시 */}
                {hover === sr.name && <text x={cx} y={cy - 12} textAnchor="middle" fontSize="11" fontWeight={700} fill="#111827">{fmt(v)}</text>}
              </g>
            );
          }))}
        </svg>
      </div>
    </div>
  );
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex items-center gap-2 text-[15px] font-semibold text-gray-700">
      {label}
      <select value={value} onChange={e => onChange(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-[15px] min-h-[44px]">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-sm text-gray-600">
      {([["주문", C.order], ["판매", C.sales]] as const).map(([l, c]) => (
        <span key={l} className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: c }} />{l}</span>
      ))}
    </div>
  );
}

function Stat({ l, v }: { l: string; v: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3">
      <dt className="text-gray-400">{l}</dt>
      <dd className="font-bold text-gray-900 text-lg">{v}</dd>
    </div>
  );
}
