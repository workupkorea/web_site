"use client";
import { useEffect, useMemo, useState } from "react";
import { HOME_SUB_EXHIBITION_LABEL } from "@/lib/home-layout";

type NavRow = {
  label: string;
  clicks: number;
  prevClicks: number | null;
  visitors: number;
  converted: number | null;
  dwellSamples: number;
  avgDwellSec: number | null;
};
type DeviceRow = { key: string; label: string; clicks: number; visitors: number; converted: number | null; avgDwellSec: number | null };
type KeyCount = { key: string; count: number };
type Detail = {
  menu: string | null;
  clicks: number;
  visitors: number;
  returningVisitors: number | null;
  newVisitors: number | null;
  avgDwellSec: number | null;
  trend: { key: string; clicks: number }[];
  heat: number[][];
  pages: KeyCount[];
  devices: DeviceRow[];
};
type Resp = {
  range: { from: string; to: string; unit: "hour" | "day"; all: boolean };
  totals: { clicks: number; visitors: number; prevClicks: number | null; prevVisitors: number | null };
  rows: NavRow[];
  meta: { deviceAvailable: boolean; conversionAvailable: boolean };
  home: {
    total: number;
    visitors: number;
    sections: KeyCount[];
    exhibitions: Record<string, { total: number; products: { key: string; name: string; count: number }[] }>;
    defaultExhibitions: string[];
    otherItems?: KeyCount[];
    storeSearch?: { total: number; unique: number; keywords: KeyCount[] };
  };
  detail: Detail;
};

// daysAgoEnd: 종료일이 오늘에서 며칠 전인지 (0=오늘, 1=어제), days: 기간 길이(0=전체)
const PRESETS = [
  { label: "오늘", days: 1, daysAgoEnd: 0 },
  { label: "어제", days: 1, daysAgoEnd: 1 },
  { label: "최근 7일", days: 7, daysAgoEnd: 0 },
  { label: "최근 30일", days: 30, daysAgoEnd: 0 },
  { label: "최근 90일", days: 90, daysAgoEnd: 0 },
  { label: "전체", days: 0, daysAgoEnd: 0 },
];
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const ACCENT = "#E5541B";
const exhibitionPanelId = (section: string) => `exhibition-products-${encodeURIComponent(section)}`;

// 관리자는 한국 시간 기준으로 본다 (API와 동일)
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const shiftDate = (d: string, days: number) => new Date(Date.parse(`${d}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

function fmtDwell(sec: number | null) {
  if (sec == null) return "–";
  const s = Math.round(sec);
  return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`;
}

const pctOf = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
const median = (arr: number[]) => {
  const a = [...arr].sort((x, y) => x - y);
  return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : 0;
};

// 클릭(관심) × 체류(몰입) 4분면 진단
type Quad = "core" | "gem" | "bait" | "low";
const QUADS: Record<Quad, { label: string; desc: string; cls: string }> = {
  core: { label: "핵심 메뉴", desc: "클릭도 많고 오래 머묾 — 유지·강화", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  gem: { label: "숨은 보석", desc: "클릭은 적지만 깊이 읽음 — 노출 위치·문구 개선", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  bait: { label: "이탈 의심", desc: "클릭은 많지만 금방 나감 — 이동 페이지 내용 점검", cls: "bg-red-50 text-red-600 border-red-200" },
  low: { label: "저효율", desc: "클릭도 체류도 낮음 — 메뉴 정리·통합 검토", cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

function Delta({ cur, prev }: { cur: number; prev: number | null }) {
  if (prev == null) return null;
  if (prev === 0) return cur > 0 ? <span className="text-[11px] text-gray-400">이전 기간 기록 없음</span> : null;
  const pct = ((cur - prev) / prev) * 100;
  if (Math.abs(pct) < 0.05) return <span className="text-[11px] text-gray-400">±0%</span>;
  const up = pct > 0;
  return (
    <span className={`text-[11px] font-bold ${up ? "text-[#E5541B]" : "text-blue-500"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function BarList({
  items, labels, total, descriptions, selection, showClickShare = false, twoColumns = false,
}: {
  items: KeyCount[];
  labels?: Record<string, string>;
  total: number;
  descriptions?: Record<string, string>;
  selection?: { keys: string[]; active: string; onChange: (key: string) => void };
  showClickShare?: boolean;
  twoColumns?: boolean;
}) {
  if (!items.length) return <p className="text-[13px] text-gray-400">데이터가 없습니다.</p>;
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className={twoColumns ? "grid grid-cols-2 gap-x-3 gap-y-2" : "space-y-2"}>
      {items.map((i) => {
        const selectable = selection?.keys.includes(i.key);
        const selected = selection?.active === i.key;
        const content = (
          <>
            <span className={`mb-1 flex items-center justify-between ${twoColumns ? "flex-wrap gap-x-2 gap-y-0.5" : "gap-2"}`}>
              <span className={`min-w-0 break-keep font-semibold text-gray-800 ${twoColumns ? "wrap-anywhere" : ""}`}>{labels?.[i.key] ?? (i.key || "미수집")}</span>
              <span className="flex shrink-0 items-center gap-1 tabular-nums text-gray-500">
                {i.count.toLocaleString()}{showClickShare && "회"}
                <span className={showClickShare ? "font-bold text-gray-800" : "text-gray-500"}>· {pctOf(i.count, total).toFixed(showClickShare ? 1 : 0)}%</span>
                {selectable && <span aria-hidden="true" className="ml-1 text-base leading-none text-[#B74416]">›</span>}
              </span>
            </span>
            <span className="block h-1.5 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
              <span className="block h-full" style={{ width: `${pctOf(i.count, showClickShare ? total : max)}%`, background: ACCENT }} />
            </span>
          </>
        );
        return (
          <li key={i.key} className="text-[13px]">
            {selectable ? (
              <button
                type="button"
                aria-pressed={selected}
                aria-controls={exhibitionPanelId(i.key)}
                onClick={() => selection?.onChange(selected ? "" : i.key)}
                className={`block w-full min-h-11 rounded-lg px-2 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B74416] ${selected ? "bg-orange-50 ring-1 ring-orange-300" : "hover:bg-gray-50"}`}
              >
                {content}
              </button>
            ) : selection ? (
              <div className="flex min-h-11 flex-col justify-center px-2 py-1.5">{content}</div>
            ) : content}
            {descriptions?.[i.key] && (
              <p className={`mt-1 break-keep text-[11px] leading-relaxed text-gray-500 ${selection ? "px-2" : ""}`}>{descriptions[i.key]}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Card({ title, children, collapsible = false }: { title: string; children: React.ReactNode; collapsible?: boolean }) {
  if (collapsible) {
    return (
      <details className="group rounded-2xl border border-gray-100 bg-white">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 py-2 text-[13px] font-bold text-gray-900 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
          {title}
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-4 shrink-0 text-gray-500 group-open:rotate-180">
            <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <div className="px-4 pb-4">{children}</div>
      </details>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <h3 className="text-[13px] font-bold text-gray-900 mb-3">{title}</h3>
      {children}
    </div>
  );
}

// 마케팅/분석 → 메뉴 분석: 기간 지정, 메뉴별 상세(추이·요일/시간대·유입 페이지·신규/재방문)
export default function NavTab() {
  const [today] = useState(kstToday);
  const [from, setFrom] = useState(today); // 기본값: 오늘
  const [to, setTo] = useState(today);
  const [all, setAll] = useState(false);
  const [menu, setMenu] = useState("");
  const [exhibition, setExhibition] = useState("");
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError("");
    const qs = new URLSearchParams();
    if (!all) {
      qs.set("from", from);
      qs.set("to", to);
    }
    if (menu) qs.set("menu", menu);
    fetch(`/api/admin/analytics/nav?${qs}`, { signal: ctrl.signal })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.error ?? "불러오지 못했습니다");
        setData(d);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setError(String(e.message ?? e));
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [from, to, all, menu]);

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    if (p.days === 0) {
      setAll(true);
      return;
    }
    const end = shiftDate(today, -p.daysAgoEnd);
    setAll(false);
    setTo(end);
    setFrom(shiftDate(end, -(p.days - 1)));
  };
  const isActive = (p: (typeof PRESETS)[number]) => {
    if (p.days === 0) return all;
    if (all) return false;
    const end = shiftDate(today, -p.daysAgoEnd);
    return to === end && from === shiftDate(end, -(p.days - 1));
  };
  const onFrom = (v: string) => {
    if (!v) return;
    setAll(false);
    setFrom(v);
    if (v > to) setTo(v);
  };
  const onTo = (v: string) => {
    if (!v) return;
    setAll(false);
    setTo(v);
    if (v < from) setFrom(v);
  };

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const detail = data?.detail;
  const totals = data?.totals;
  const maxClicks = Math.max(1, ...rows.map((r) => r.clicks));
  const topRow = rows[0];
  const longest = [...rows].filter((r) => r.avgDwellSec != null).sort((a, b) => (b.avgDwellSec ?? 0) - (a.avgDwellSec ?? 0))[0];
  const heatMax = Math.max(1, ...(detail?.heat.flat() ?? [0]));
  const trendMax = Math.max(1, ...(detail?.trend.map((t) => t.clicks) ?? [0]));
  const unit = data?.range.unit ?? "day";
  const conversionOn = data?.meta.conversionAvailable ?? false;
  const storeSearch = data?.home.storeSearch;
  const exhibitionSections = (data?.home.sections ?? [])
    .filter(({ key }) => key === HOME_SUB_EXHIBITION_LABEL || key.startsWith(`${HOME_SUB_EXHIBITION_LABEL} - `))
    .map(({ key }) => key);
  const selectedExhibition = exhibitionSections.includes(exhibition) ? exhibition : "";
  const defaultExhibitions = [...new Set([...(data?.home.defaultExhibitions ?? []), ...exhibitionSections])].slice(0, 4);
  const displayExhibitions = selectedExhibition && !defaultExhibitions.includes(selectedExhibition)
    ? [...defaultExhibitions, selectedExhibition]
    : defaultExhibitions;

  useEffect(() => {
    if (!selectedExhibition) return;
    document.getElementById(exhibitionPanelId(selectedExhibition))?.scrollIntoView({ block: "nearest" });
  }, [selectedExhibition]);
  const otherItems = data?.home.otherItems ?? [];
  const otherCount = data?.home.sections.find((section) => section.key === "기타")?.count ?? 0;
  const otherRemaining = otherCount - otherItems.reduce((sum, item) => sum + item.count, 0);
  const otherDetails = otherItems.map((item) => `${item.key} ${item.count.toLocaleString()}회`).join(" · ");
  const otherDescription = otherDetails && otherRemaining > 0
    ? `${otherDetails} · 외 ${otherRemaining.toLocaleString()}회`
    : otherDetails;

  // 4분면 진단: 체류 측정이 3건 이상인 메뉴만 대상 (표본 부족 시 오판 방지)
  const quadByLabel = useMemo(() => {
    const m = new Map<string, Quad>();
    const eligible = rows.filter((r) => r.avgDwellSec != null && r.dwellSamples >= 3);
    if (eligible.length < 4) return m;
    const mc = median(eligible.map((r) => r.clicks));
    const md = median(eligible.map((r) => r.avgDwellSec as number));
    for (const r of eligible) {
      const hi = r.clicks >= mc;
      const long = (r.avgDwellSec as number) >= md;
      m.set(r.label, hi && long ? "core" : !hi && long ? "gem" : hi ? "bait" : "low");
    }
    return m;
  }, [rows]);

  const downloadCsv = () => {
    if (!data) return;
    const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push(`기간,${data.range.from} ~ ${data.range.to}`);
    lines.push("");
    lines.push(["메뉴", "클릭 수", "이전 기간 클릭", "방문자", "매장 전환 방문자", "평균 체류(초)", "체류 측정 건수"].map(esc).join(","));
    for (const r of data.rows) lines.push([r.label, r.clicks, r.prevClicks, r.visitors, r.converted, r.avgDwellSec, r.dwellSamples].map(esc).join(","));
    lines.push("");
    lines.push([data.detail.menu ? `추이(${data.detail.menu})` : "추이(전체 메뉴)", "클릭 수"].map(esc).join(","));
    for (const t of data.detail.trend) lines.push([unit === "hour" ? `${t.key}시` : t.key, t.clicks].map(esc).join(","));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `menu-analytics_${data.range.from}_${data.range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputCls = "min-h-[44px] px-3 rounded-xl border border-gray-200 bg-white text-[13px] font-semibold text-gray-700 focus:outline-none focus:border-gray-900";

  return (
    <div className="space-y-4">
      {/* 기간 선택 */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className={`px-3.5 py-2 min-h-[44px] rounded-full text-[13px] font-bold border transition-colors ${
                isActive(p) ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {p.label}
            </button>
          ))}
          <span className="hidden sm:block w-px h-6 bg-gray-200 mx-1" aria-hidden />
          <input type="date" aria-label="시작일" className={inputCls} value={all ? data?.range.from ?? from : from} max={today} onChange={(e) => onFrom(e.target.value)} />
          <span className="text-gray-400">~</span>
          <input type="date" aria-label="종료일" className={inputCls} value={all ? data?.range.to ?? to : to} max={today} onChange={(e) => onTo(e.target.value)} />
          <button
            onClick={downloadCsv}
            disabled={!data}
            className="ml-auto px-3.5 min-h-[44px] rounded-xl border border-gray-200 bg-white text-[13px] font-bold text-gray-600 hover:border-gray-400 disabled:opacity-40"
          >
            CSV 내려받기
          </button>
        </div>
        <p className="text-[12px] text-gray-400">
          {unit === "hour" ? "하루(오늘/어제)는 시간대별로, 오늘은 지금까지의 데이터입니다." : "최근 N일은 오늘을 포함해 일 단위로 표시됩니다."} 한국 시간(KST) 기준 · 로그는 최근 90일까지 보관됩니다.
        </p>
      </div>

      {error ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-[13px] text-red-500">
          {error}
          <br />
          <span className="text-gray-400">nav_events 테이블이 아직 없다면 SQL 에디터에서 migrate_add_nav_events.sql 을 실행하세요.</span>
        </div>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity space-y-4" : "space-y-4"}>
          {/* KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-[12px] text-gray-400 font-semibold">메뉴 클릭 합계</p>
              <p className="text-2xl font-extrabold mt-1" style={{ color: ACCENT }}>
                {(totals?.clicks ?? 0).toLocaleString()}
              </p>
              <div className="mt-1 min-h-[16px]">{totals && <Delta cur={totals.clicks} prev={totals.prevClicks} />}<span className="text-[11px] text-gray-300 ml-1">{totals?.prevClicks != null ? "직전 동일 기간 대비" : ""}</span></div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-[12px] text-gray-400 font-semibold">방문자 수</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1">{(totals?.visitors ?? 0).toLocaleString()}</p>
              <div className="mt-1 min-h-[16px]">{totals && <Delta cur={totals.visitors} prev={totals.prevVisitors} />}</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-[12px] text-gray-400 font-semibold">가장 많이 클릭된 메뉴</p>
              <p className="text-xl font-extrabold text-gray-900 mt-1 truncate">{topRow?.label ?? "–"}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-[12px] text-gray-400 font-semibold">체류시간이 가장 긴 메뉴</p>
              <p className="text-xl font-extrabold text-gray-900 mt-1 truncate">{longest ? `${longest.label} · ${fmtDwell(longest.avgDwellSec)}` : "–"}</p>
            </div>
          </div>

          {/* 메뉴 표 */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
            {!data && loading ? (
              <p className="p-6 text-[13px] text-gray-400">불러오는 중…</p>
            ) : rows.length === 0 ? (
              <p className="p-6 text-[13px] text-gray-400">이 기간에 기록된 메뉴 클릭이 없습니다.</p>
            ) : (
              <table className="w-full text-[13px] min-w-[820px]">
                <thead>
                  <tr className="text-left text-gray-400 text-[12px] border-b border-gray-100">
                    <th className="px-4 py-3 font-semibold w-10">#</th>
                    <th className="px-4 py-3 font-semibold">메뉴</th>
                    <th className="px-4 py-3 font-semibold">클릭 수</th>
                    <th className="px-4 py-3 font-semibold text-right">클릭 비율</th>
                    <th className="px-4 py-3 font-semibold text-right">이전 기간 대비</th>
                    <th className="px-4 py-3 font-semibold text-right">방문자</th>
                    <th className="px-4 py-3 font-semibold text-right">평균 체류시간</th>
                    {conversionOn && <th className="px-4 py-3 font-semibold text-right">매장 전환율</th>}
                    {quadByLabel.size > 0 && <th className="px-4 py-3 font-semibold">진단</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const selected = menu === r.label;
                    return (
                      <tr
                        key={r.label}
                        onClick={() => setMenu(selected ? "" : r.label)}
                        className={`border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 ${selected ? "bg-orange-50" : ""}`}
                      >
                        <td className="px-4 py-3 text-gray-400 font-bold">{i + 1}</td>
                        <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{r.label}</td>
                        <td className="px-4 py-3 min-w-[160px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full" style={{ width: `${(r.clicks / maxClicks) * 100}%`, background: ACCENT }} />
                            </div>
                            <span className="font-bold tabular-nums w-10 text-right">{r.clicks.toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{totals && totals.clicks > 0 ? `${((r.clicks / totals.clicks) * 100).toFixed(1)}%` : "–"}</td>
                        <td className="px-4 py-3 text-right tabular-nums"><Delta cur={r.clicks} prev={r.prevClicks} /></td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.visitors.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {fmtDwell(r.avgDwellSec)}
                          {r.dwellSamples > 0 && <span className="text-[11px] text-gray-300 ml-1">({r.dwellSamples})</span>}
                        </td>
                        {conversionOn && (
                          <td className="px-4 py-3 text-right tabular-nums">
                            {r.converted != null && r.visitors > 0 ? (
                              <>
                                <span className="font-bold">{pctOf(r.converted, r.visitors).toFixed(1)}%</span>
                                <span className="text-[11px] text-gray-300 ml-1">({r.converted})</span>
                              </>
                            ) : (
                              "–"
                            )}
                          </td>
                        )}
                        {quadByLabel.size > 0 && (
                          <td className="px-4 py-3 whitespace-nowrap">
                            {quadByLabel.get(r.label) && (
                              <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-bold ${QUADS[quadByLabel.get(r.label) as Quad].cls}`} title={QUADS[quadByLabel.get(r.label) as Quad].desc}>
                                {QUADS[quadByLabel.get(r.label) as Quad].label}
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {data && (
            <>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h2 className="text-[15px] font-extrabold text-gray-900">메인 페이지 분석 (본문 클릭)</h2>
                {!!data?.home.total && (
                  <span className="text-[12px] text-gray-400">
                    총 {data.home.total.toLocaleString()}회 · 방문자 {data.home.visitors.toLocaleString()}명 (상단/하단 메뉴 제외)
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 items-start gap-3">
                <div className="min-w-0 space-y-3">
                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    {!data?.home.total ? (
                      <p className="text-[13px] text-gray-400">이 기간에 기록된 메인 페이지 클릭이 없습니다. (수집은 배포 후부터 시작됩니다)</p>
                    ) : (
                      <BarList
                        items={data.home.sections}
                        total={data.home.total}
                        descriptions={{ 기타: otherDescription }}
                        selection={{ keys: exhibitionSections, active: selectedExhibition, onChange: setExhibition }}
                      />
                    )}
                  </div>
                  <Card title="매장 검색 키워드" collapsible>
                    {storeSearch?.total ? (
                      <>
                        <p className="mb-3 text-[12px] text-gray-500">
                          검색 {storeSearch.total.toLocaleString()}회 · 키워드 {storeSearch.unique.toLocaleString()}개
                          {storeSearch.unique > storeSearch.keywords.length && ` · 상위 ${storeSearch.keywords.length}개 표시`}
                        </p>
                        <BarList items={storeSearch.keywords} total={storeSearch.total} />
                      </>
                    ) : (
                      <p className="text-[13px] text-gray-400">이 기간에 기록된 매장 검색 키워드가 없습니다.</p>
                    )}
                  </Card>
                </div>
                <div className="min-w-0">
                  {displayExhibitions.length > 0 && (
                    <section aria-label="서브 기획전 상품 클릭 상세" className="space-y-3">
                      {displayExhibitions.map((section) => {
                        const exhibitionDetail = data.home.exhibitions?.[section];
                        const selected = selectedExhibition === section;
                        return (
                          <div
                            key={section}
                            id={exhibitionPanelId(section)}
                            className={`scroll-m-20 rounded-2xl ${selected ? "ring-1 ring-orange-400" : ""}`}
                          >
                            <Card title={section}>
                              {exhibitionDetail?.total ? (
                                <>
                                  <p className="mb-3 text-[12px] text-gray-500">
                                    상품 클릭 {exhibitionDetail.total.toLocaleString()}회 · 기획전 상세의 전체 상품 클릭 기준
                                  </p>
                                  <BarList
                                    items={exhibitionDetail.products}
                                    labels={Object.fromEntries(exhibitionDetail.products.map(({ key, name }) => [key, name]))}
                                    total={exhibitionDetail.total}
                                    showClickShare
                                    twoColumns
                                  />
                                </>
                              ) : (
                                <p className="text-[13px] text-gray-500">
                                  {exhibitionDetail
                                    ? "이 기간에 기록된 상품 클릭이 없습니다."
                                    : "연결된 기획전 상세 페이지를 확인할 수 없습니다."}
                                </p>
                              )}
                            </Card>
                          </div>
                        );
                      })}
                    </section>
                  )}
                </div>
              </div>
            </>
          )}

          {/* 상세 분석 */}
          {detail && rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15px] font-extrabold text-gray-900">기기 및 방문 유형 분석 · {detail.menu ?? "전체 메뉴"}</h2>
                {detail.menu && (
                  <button onClick={() => setMenu("")} className="px-3 min-h-[44px] rounded-full border border-gray-200 bg-white text-[12px] font-bold text-gray-600 hover:border-gray-400">
                    전체 메뉴 보기
                  </button>
                )}
                <span className="text-[12px] text-gray-400">
                  클릭 {detail.clicks.toLocaleString()} · 방문자 {detail.visitors.toLocaleString()} · 평균 체류 {fmtDwell(detail.avgDwellSec)}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Card title="기기별 (모바일 · 태블릿 · PC)">
                  {!detail.devices.length ? (
                    <p className="text-[13px] text-gray-400">기기 정보가 있는 기록이 없습니다.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[13px] min-w-[360px]">
                        <thead>
                          <tr className="text-left text-gray-400 text-[12px] border-b border-gray-100">
                            <th className="py-2 font-semibold">기기</th>
                            <th className="py-2 font-semibold text-right">클릭</th>
                            <th className="py-2 font-semibold text-right">방문자</th>
                            <th className="py-2 font-semibold text-right">평균 체류</th>
                            {conversionOn && <th className="py-2 font-semibold text-right">매장 전환율</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {detail.devices.map((d) => (
                            <tr key={d.key} className="border-b border-gray-50 last:border-0">
                              <td className="py-2.5 font-bold text-gray-900">{d.label}</td>
                              <td className="py-2.5 text-right tabular-nums">
                                {d.clicks.toLocaleString()} <span className="text-gray-300">· {pctOf(d.clicks, detail.devices.reduce((n, x) => n + x.clicks, 0)).toFixed(0)}%</span>
                              </td>
                              <td className="py-2.5 text-right tabular-nums">{d.visitors.toLocaleString()}</td>
                              <td className="py-2.5 text-right tabular-nums">{fmtDwell(d.avgDwellSec)}</td>
                              {conversionOn && <td className="py-2.5 text-right tabular-nums">{d.converted != null && d.visitors > 0 ? `${pctOf(d.converted, d.visitors).toFixed(1)}%` : "–"}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {data && !data.meta.deviceAvailable ? (
                        <p className="mt-2 text-[11px] text-gray-400">기기 구분을 쓰려면 SQL 에디터에서 migrate_add_nav_events_device.sql 을 실행하세요. 실행 후부터 수집됩니다.</p>
                      ) : (
                        detail.devices.some((d) => d.key === "unknown") && <p className="mt-2 text-[11px] text-gray-400">미수집은 기기 구분 도입 이전 기록입니다.</p>
                      )}
                    </div>
                  )}
                </Card>
                <Card title="신규 / 재방문 방문자">
                  {detail.newVisitors == null ? (
                    <p className="text-[13px] text-gray-400">기간을 지정하면 신규/재방문이 구분됩니다. (전체 기간은 구분 불가)</p>
                  ) : (
                    <BarList
                      total={detail.visitors}
                      labels={{ new: "신규 (이 기간 처음)", ret: "재방문 (이전 기록 있음)" }}
                      items={[
                        { key: "new", count: detail.newVisitors },
                        { key: "ret", count: detail.returningVisitors ?? 0 },
                      ]}
                    />
                  )}
                </Card>
              </div>

              <Card title="시간대·요일별 클릭" collapsible>
                <h3 className="mb-3 text-[13px] font-bold text-gray-900">
                  {unit === "hour" ? "시간대별 클릭 (하루)" : "일별 클릭 추이"}
                </h3>
                <div className="overflow-x-auto">
                  {(() => {
                    const hourly = unit === "hour";
                    const minW = hourly ? 24 * 30 : Math.max(280, detail.trend.length * 12);
                    return (
                      <>
                        <div className="flex items-end gap-[3px] h-44" style={{ minWidth: minW }}>
                          {detail.trend.map((t) => (
                            <div key={t.key} className="flex-1 h-full flex flex-col items-center justify-end" title={`${hourly ? `${t.key}시` : t.key} · ${t.clicks.toLocaleString()}회`}>
                              {hourly && <span className="text-[10px] font-bold tabular-nums text-gray-600 mb-0.5">{t.clicks > 0 ? t.clicks.toLocaleString() : ""}</span>}
                              <div className="w-full rounded-t-sm" style={{ height: `${(t.clicks / trendMax) * (hourly ? 82 : 100)}%`, minHeight: t.clicks ? 2 : 0, background: ACCENT }} />
                            </div>
                          ))}
                        </div>
                        {hourly ? (
                          // 0~23시 모든 시간대를 막대 아래에 표기
                          <div className="flex gap-[3px] mt-1" style={{ minWidth: minW }}>
                            {detail.trend.map((t) => (
                              <span key={t.key} className="flex-1 text-center text-[11px] text-gray-500 font-semibold tabular-nums">{t.key}시</span>
                            ))}
                          </div>
                        ) : (
                          <div className="flex justify-between text-[11px] text-gray-400 mt-1" style={{ minWidth: minW }}>
                            <span>{detail.trend[0]?.key.slice(5)}</span>
                            <span>{detail.trend[detail.trend.length - 1]?.key.slice(5)}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                <h3 className="mb-3 mt-4 border-t border-gray-100 pt-4 text-[13px] font-bold text-gray-900">
                  요일 · 시간대별 클릭
                </h3>
                <div className="overflow-x-auto">
                  <div className="min-w-[560px]">
                    <div className="grid gap-[2px]" style={{ gridTemplateColumns: "24px repeat(24, minmax(0, 1fr))" }}>
                      <span />
                      {Array.from({ length: 24 }, (_, h) => (
                        <span key={h} className="text-[10px] text-gray-400 text-center">{h % 3 === 0 ? h : ""}</span>
                      ))}
                      {detail.heat.map((row, d) => (
                        <div key={d} className="contents">
                          <span className="text-[11px] text-gray-500 font-semibold leading-6">{DOW[d]}</span>
                          {row.map((v, h) => (
                            <div
                              key={h}
                              className="h-6 rounded-[3px]"
                              title={`${DOW[d]}요일 ${h}시 · ${v}회`}
                              style={{ background: v ? ACCENT : "#F3F4F6", opacity: v ? 0.15 + 0.85 * (v / heatMax) : 1 }}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      <p className="text-[12px] text-gray-400 leading-relaxed">
        체류시간은 해당 메뉴로 이동한 페이지에서 화면이 보인 시간만 측정하며(괄호는 측정 건수), 30분 초과는 30분으로 처리합니다. 새 창으로 열리는 메뉴는 클릭만 집계됩니다.
      </p>
    </div>
  );
}
