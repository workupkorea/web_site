"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  type ArchiveRow as Row, n, fmt, salesRateOf, orderRateOf, todayKst, dDayLabel,
  seasonRank, inRange, aggregate, useArchiveRows,
} from "@/lib/arrival-stats";
import ArrivalDateFilter from "../_components/ArrivalDateFilter";

// 제품별 상세 분석 — 브랜드·카테고리·기간으로 좁혀서 제품 단위 입고/주문/판매/재고를 차트와 표로 본다.
// 주문 → 판매는 한 가지 색(슬레이트)의 연한 → 진한 단계로 표현한다. 입고량은 그래프에 넣지 않고 숫자로만 보여준다.
const C = { order: "#64748b", sales: "#1e293b" } as const;

type SortKey = "sales" | "order" | "inQty" | "stock" | "salesRate" | "orderRate" | "amount" | "date";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "sales", label: "판매량" },
  { key: "salesRate", label: "판매율" },
  { key: "order", label: "주문량" },
  { key: "orderRate", label: "주문율" },
  { key: "inQty", label: "입고량" },
  { key: "stock", label: "재고" },
  { key: "amount", label: "판매액" },
  { key: "date", label: "입고일" },
];

const rowKey = (r: Row) => `${r.product_code}::${r.arrival_date}`;
const amountOf = (r: Row) => n(r.sales_quantity) * n(r.price);
const won = (v: number) => (v >= 100_000_000 ? `${(v / 100_000_000).toFixed(1)}억` : v >= 10_000 ? `${Math.round(v / 10_000).toLocaleString("ko-KR")}만` : fmt(v));

export default function ArrivalProductStatsPage() {
  const { rows, loading, error } = useArchiveRows();
  const today = useMemo(todayKst, []);

  const [season, setSeason] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sales");
  const [selected, setSelected] = useState<string | null>(null);

  // 통계 화면에서 넘어온 브랜드(?brand=)를 초기값으로 반영 (Suspense 없이 읽기 위해 마운트 후 1회만)
  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get("brand");
    if (b) setBrand(b);
  }, []);

  const seasons = useMemo(
    () => [...new Set(rows.map(r => r.season).filter(Boolean))].sort((a, b) => seasonRank(b) - seasonRank(a)),
    [rows],
  );
  useEffect(() => { if (!season && seasons.length) setSeason(seasons[0]); }, [seasons, season]);
  useEffect(() => { setDateStart(""); setDateEnd(""); setSelected(null); }, [season]);

  const inSeason = useMemo(() => rows.filter(r => r.season === season), [rows, season]);
  const seasonDates = useMemo(() => inSeason.map(r => r.arrival_date), [inSeason]);
  const brands = useMemo(() => aggregate(inSeason, r => r.brand).sort((a, b) => b.salesQty - a.salesQty).map(a => a.key), [inSeason]);
  const categories = useMemo(
    () => aggregate(inSeason.filter(r => !brand || r.brand === brand), r => r.category).sort((a, b) => b.salesQty - a.salesQty).map(a => a.key),
    [inSeason, brand],
  );
  useEffect(() => { if (brand && brands.length && !brands.includes(brand)) setBrand(""); }, [brands, brand]);
  useEffect(() => { if (category && !categories.includes(category)) setCategory(""); }, [categories, category]);

  const list = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const val = (r: Row): number => {
      switch (sortKey) {
        case "sales": return n(r.sales_quantity);
        case "order": return n(r.order_quantity);
        case "inQty": return n(r.quantity);
        case "stock": return n(r.stock_quantity);
        case "salesRate": return salesRateOf(r) ?? -1;
        case "orderRate": return orderRateOf(r) ?? -1;
        case "amount": return amountOf(r);
        case "date": return Date.parse(r.arrival_date) || 0;
      }
    };
    return inSeason
      .filter(r => (!brand || r.brand === brand) && (!category || r.category === category) && inRange(r.arrival_date, dateStart, dateEnd))
      .filter(r => !kw || r.product_name.toLowerCase().includes(kw) || r.product_code.toLowerCase().includes(kw))
      .sort((a, b) => val(b) - val(a));
  }, [inSeason, brand, category, dateStart, dateEnd, q, sortKey]);

  const sum = useMemo(() => aggregate(list, () => "all")[0], [list]);
  const picked = useMemo(() => list.find(r => rowKey(r) === selected) ?? null, [list, selected]);

  // 차트 1: 상위 15개 제품 (현재 정렬 기준)
  const top = list.slice(0, 15);
  const topMax = Math.max(1, ...top.map(r => Math.max(n(r.order_quantity), n(r.sales_quantity))));

  const filtered = !!(brand || category || dateStart || dateEnd || q);

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">제품별 상세 분석</h1>
          <p className="text-base text-gray-400 mt-1">브랜드·카테고리·기간으로 좁혀 제품 단위로 입고·주문·판매·재고를 확인합니다.</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/arrival/stats/timeline${brand ? `?brand=${encodeURIComponent(brand)}` : ""}`} className="px-4 py-2.5 bg-[#303236] text-white text-[15px] font-semibold rounded hover:bg-[#243d5e]">
            시기·속도 분석
          </Link>
          <Link href="/admin/arrival/stats" className="px-4 py-2.5 border border-gray-300 text-[15px] font-semibold text-gray-700 rounded hover:bg-gray-50">
            ← 시즌별 판매 통계
          </Link>
        </div>
      </div>

      {error && <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl text-base font-semibold text-amber-800">⚠ {error}</div>}

      {loading ? (
        <div className="py-20 text-center text-gray-400">불러오는 중...</div>
      ) : !error && seasons.length === 0 ? (
        <div className="py-20 text-center text-gray-400">아직 쌓인 데이터가 없습니다. 입고 스케쥴에서 시트 동기화를 실행하세요.</div>
      ) : !error && (
        <>
          {/* 필터 */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-4 flex items-center flex-wrap gap-4">
            <Sel label="시즌" value={season} onChange={setSeason} options={seasons.map(s => [s, s])} />
            <Sel label="브랜드" value={brand} onChange={setBrand} options={[["", "전체"], ...brands.map(b => [b, b] as [string, string])]} />
            <Sel label="카테고리" value={category} onChange={setCategory} options={[["", "전체"], ...categories.map(c => [c, c] as [string, string])]} />
            <ArrivalDateFilter dates={seasonDates} start={dateStart} end={dateEnd} onChange={(a, b) => { setDateStart(a); setDateEnd(b); }} />
            <input
              value={q} onChange={e => setQ(e.target.value)} placeholder="제품명·코드 검색"
              className="border border-gray-300 rounded px-3 py-2 text-[15px] min-h-[44px] min-w-[180px]" aria-label="제품명 또는 코드 검색"
            />
            {filtered && (
              <button onClick={() => { setBrand(""); setCategory(""); setDateStart(""); setDateEnd(""); setQ(""); }} className="px-3 min-h-[44px] text-sm text-gray-500 underline">
                필터 해제
              </button>
            )}
          </div>

          {/* 요약 */}
          {sum ? (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                ["제품", `${fmt(sum.products)}개`],
                ["입고량", fmt(sum.inQty)],
                ["주문량", fmt(sum.orderQty)],
                ["판매량", fmt(sum.salesQty)],
                ["재고", fmt(sum.stockQty)],
                ["판매액(추정)", won(list.reduce((t, r) => t + amountOf(r), 0))],
              ].map(([l, v]) => (
                <div key={l} className="bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3">
                  <div className="text-sm text-gray-400 font-semibold">{l}</div>
                  <div className="text-xl font-bold text-gray-900 mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-gray-400 bg-white border border-gray-200 rounded-xl">조건에 맞는 제품이 없습니다.</div>
          )}

          {sum && (
            <>
              {/* 선택 제품 상세 */}
              {picked && <ProductDetail r={picked} today={today} onClose={() => setSelected(null)} />}

              {/* 표 */}
              <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
                <div className="px-5 py-3 flex items-center gap-2 flex-wrap border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-500">정렬</span>
                  {SORTS.map(s => (
                    <button
                      key={s.key} onClick={() => setSortKey(s.key)}
                      className={`px-3 min-h-[36px] rounded text-sm font-semibold ${sortKey === s.key ? "bg-[#303236] text-white" : "text-gray-500 hover:text-gray-900"}`}
                    >
                      {s.label}{sortKey === s.key ? " ▼" : ""}
                    </button>
                  ))}
                  <span className="ml-auto text-sm text-gray-400">{fmt(list.length)}개</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[980px]">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="text-left px-4 py-3">제품</th>
                        <th className="text-left px-3 py-3">입고일</th>
                        <th className="text-right px-3 py-3">입고</th>
                        <th className="text-right px-3 py-3">주문</th>
                        <th className="text-right px-3 py-3">주문율</th>
                        <th className="text-right px-3 py-3">판매</th>
                        <th className="text-right px-3 py-3">판매율</th>
                        <th className="text-right px-3 py-3">재고</th>
                        <th className="text-right px-4 py-3">판매액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map(r => {
                        const k = rowKey(r);
                        return (
                          <tr
                            key={k} onClick={() => setSelected(k === selected ? null : k)}
                            className={`border-t border-gray-100 cursor-pointer ${k === selected ? "bg-slate-100" : "hover:bg-gray-50"}`}
                          >
                            <td className="px-4 py-2.5">
                              <div className="text-xs text-gray-400">{r.brand} · {r.category}</div>
                              <div className="font-semibold text-gray-900">{r.product_name || r.product_code}</div>
                            </td>
                            <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.arrival_date} <b className="text-gray-900">{dDayLabel(r.arrival_date, today)}</b></td>
                            <td className="px-3 py-2.5 text-right">{fmt(n(r.quantity))}</td>
                            <td className="px-3 py-2.5 text-right">{fmt(n(r.order_quantity))}</td>
                            <td className="px-3 py-2.5 text-right text-blue-600 font-semibold">{orderRateOf(r) ?? "—"}{orderRateOf(r) != null && "%"}</td>
                            <td className="px-3 py-2.5 text-right font-bold">{fmt(n(r.sales_quantity))}</td>
                            <td className="px-3 py-2.5 text-right text-emerald-600 font-bold">{salesRateOf(r) ?? "—"}{salesRateOf(r) != null && "%"}</td>
                            <td className="px-3 py-2.5 text-right text-gray-500">{fmt(n(r.stock_quantity))}</td>
                            <td className="px-4 py-2.5 text-right text-gray-500">{won(amountOf(r))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
              {/* 차트 1: 제품별 입고·주문·판매 */}
              <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <h2 className="text-lg font-bold text-gray-900">제품별 주문 · 판매 <span className="text-sm font-medium text-gray-400">상위 {top.length}개 ({SORTS.find(s => s.key === sortKey)?.label} 순)</span></h2>
                  <Legend items={[["주문", C.order], ["판매", C.sales]]} />
                </div>
                <p className="text-sm text-gray-400 mb-4">막대를 누르면 아래에 제품 상세가 열립니다.</p>
                <div className="space-y-2">
                  {top.map(r => {
                    const k = rowKey(r);
                    const on = k === selected;
                    return (
                      <button
                        key={k} onClick={() => setSelected(on ? null : k)}
                        className={`w-full text-left grid grid-cols-[minmax(120px,240px)_1fr_150px] items-center gap-3 rounded-lg px-2 py-1.5 min-h-[44px] ${on ? "bg-slate-100" : "hover:bg-gray-50"}`}
                        title={`${r.product_name} · 주문 ${fmt(n(r.order_quantity))} / 판매 ${fmt(n(r.sales_quantity))}`}
                      >
                        <span className="min-w-0">
                          <span className="block text-xs text-gray-400 truncate">{r.brand} · {r.category}</span>
                          <span className="block text-sm font-semibold text-gray-900 truncate">{r.product_name || r.product_code}</span>
                        </span>
                        <span className="space-y-[2px]">
                          <Bar v={n(r.order_quantity)} max={topMax} color={C.order} />
                          <Bar v={n(r.sales_quantity)} max={topMax} color={C.sales} />
                        </span>
                        <span className="text-right text-sm tabular-nums text-gray-500 w-[150px] leading-snug">
                          <span className="block">주문 <b className="text-gray-900">{fmt(n(r.order_quantity))}</b> <span className="text-blue-600 font-semibold">{orderRateOf(r) ?? "—"}{orderRateOf(r) != null && "%"}</span></span>
                          <span className="block">판매 <b className="text-gray-900">{fmt(n(r.sales_quantity))}</b> <span className="text-emerald-600 font-semibold">{salesRateOf(r) ?? "—"}{salesRateOf(r) != null && "%"}</span></span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <p className="text-sm text-gray-400">
                판매액은 판매량 × 판매가로 추정한 값입니다(할인 미반영). 판매량은 동기화 시점의 누적값이라 입고가 오래된 제품일수록 높게 나옵니다.
              </p>
            </>
          )}
        </>
      )}
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

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="flex items-center gap-3 text-sm text-gray-600">
      {items.map(([l, c]) => (
        <span key={l} className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: c }} />{l}</span>
      ))}
    </div>
  );
}

// 가로 막대 한 줄 (데이터 끝만 둥글게, 0이면 그리지 않음)
function Bar({ v, max, color }: { v: number; max: number; color: string }) {
  return (
    <span className="block h-[8px]">
      <span className="block h-full rounded-r" style={{ width: `${(v / max) * 100}%`, background: color, minWidth: v > 0 ? 2 : 0 }} />
    </span>
  );
}

function ProductDetail({ r, today, onClose }: { r: Row; today: string; onClose: () => void }) {
  // 대표 이미지(쉼표로 이어진 URL 중 첫 번째). 불러오기에 실패하면 자리만 비워 둔다
  const img = (r.image ?? "").split(",")[0]?.trim() || "";
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => { setImgFailed(false); }, [img]);
  const inQ = n(r.quantity), ord = n(r.order_quantity), sold = n(r.sales_quantity), stock = n(r.stock_quantity);
  const max = Math.max(1, ord, sold);
  const steps: [string, number, string][] = [["주문", ord, C.order], ["판매", sold, C.sales]];
  const margin = n(r.price) > 0 && n(r.supply_price) > 0 ? Math.round(((n(r.price) - n(r.supply_price)) / n(r.price)) * 100) : null;
  return (
    <section className="bg-white border-2 border-slate-300 rounded-xl shadow-sm p-5 flex flex-col sm:flex-row gap-5">
      {img && !imgFailed && (
        <div className="shrink-0 w-full sm:w-[180px] aspect-[4/5] bg-[#EDEDED] rounded-lg overflow-hidden">
          <img
            src={img} alt={r.product_name || r.product_code}
            className="w-full h-full object-contain" loading="lazy" decoding="async"
            onError={() => setImgFailed(true)}
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-sm text-gray-400">{r.brand} · {r.category} · {r.product_code}</div>
          <h2 className="text-xl font-bold text-gray-900">{r.product_name || r.product_code}</h2>
          <div className="text-sm text-gray-500 mt-1">
            입고일 {r.arrival_date} <b className="text-gray-900">{dDayLabel(r.arrival_date, today)}</b> · {r.season}
          </div>
        </div>
        <button onClick={onClose} className="px-3 min-h-[44px] text-sm text-gray-500 underline">닫기</button>
      </div>
      <div className="grid md:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-3">
          {steps.map(([l, v, c]) => (
            <div key={l} className="grid grid-cols-[40px_1fr_72px] items-center gap-3">
              <span className="text-sm font-semibold text-gray-600">{l}</span>
              <span className="block h-5 bg-gray-50 rounded-r"><span className="block h-full rounded-r" style={{ width: `${(v / max) * 100}%`, background: c, minWidth: v > 0 ? 2 : 0 }} /></span>
              <span className="text-right font-bold tabular-nums text-gray-900">{fmt(v)}</span>
            </div>
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm content-start">
          <Stat l="입고" v={fmt(inQ)} />
          <Stat l="재고" v={fmt(stock)} />
          <Stat l="주문율" v={orderRateOf(r) != null ? `${orderRateOf(r)}%` : "—"} />
          <Stat l="판매율" v={salesRateOf(r) != null ? `${salesRateOf(r)}%` : "—"} />
          <Stat l="주문 대비 판매" v={ord > 0 ? `${Math.round((sold / ord) * 100)}%` : "—"} />
          <Stat l="재고율" v={inQ > 0 ? `${Math.round((stock / inQ) * 100)}%` : "—"} />
          <Stat l="판매가" v={n(r.price) ? `${fmt(n(r.price))}원` : "—"} />
          <Stat l="공급가" v={n(r.supply_price) ? `${fmt(n(r.supply_price))}원` : "—"} />
          <Stat l="마진율" v={margin != null ? `${margin}%` : "—"} />
          <Stat l="판매액(추정)" v={won(amountOf(r))} />
        </dl>
      </div>
      </div>
    </section>
  );
}

function Stat({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <dt className="text-gray-400">{l}</dt>
      <dd className="font-bold text-gray-900 text-base">{v}</dd>
    </div>
  );
}
