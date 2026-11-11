"use client";
import { useEffect, useMemo, useState } from "react";

type NavRow = {
  label: string;
  clicks: number;
  prevClicks: number | null;
  visitors: number;
  dwellSamples: number;
  avgDwellSec: number | null;
};
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
};
type Resp = {
  range: { from: string; to: string; unit: "hour" | "day"; all: boolean };
  totals: { clicks: number; visitors: number; prevClicks: number | null; prevVisitors: number | null };
  rows: NavRow[];
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

// 관리자는 한국 시간 기준으로 본다 (API와 동일)
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const shiftDate = (d: string, days: number) => new Date(Date.parse(`${d}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

function fmtDwell(sec: number | null) {
  if (sec == null) return "–";
  const s = Math.round(sec);
  return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`;
}

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

function BarList({ items, labels, total }: { items: KeyCount[]; labels?: Record<string, string>; total: number }) {
  if (!items.length) return <p className="text-[13px] text-gray-400">데이터가 없습니다.</p>;
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.key} className="text-[13px]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-semibold text-gray-800 truncate">{labels?.[i.key] ?? (i.key || "미수집")}</span>
            <span className="tabular-nums text-gray-500 shrink-0">
              {i.count.toLocaleString()} <span className="text-gray-300">· {total > 0 ? ((i.count / total) * 100).toFixed(0) : 0}%</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full" style={{ width: `${(i.count / max) * 100}%`, background: ACCENT }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-4 ${className}`}>
      <h3 className="text-[13px] font-bold text-gray-900 mb-3">{title}</h3>
      {children}
    </div>
  );
}

// 마케팅/분석 → 메뉴 분석: 기간 지정, 메뉴별 상세(추이·요일/시간대·유입 페이지·신규/재방문)
export default function NavTab() {
  const today = useMemo(kstToday, []);
  const [from, setFrom] = useState(today); // 기본값: 오늘
  const [to, setTo] = useState(today);
  const [all, setAll] = useState(false);
  const [menu, setMenu] = useState("");
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

  const rows = data?.rows ?? [];
  const detail = data?.detail;
  const totals = data?.totals;
  const maxClicks = Math.max(1, ...rows.map((r) => r.clicks));
  const topRow = rows[0];
  const longest = [...rows].filter((r) => r.avgDwellSec != null).sort((a, b) => (b.avgDwellSec ?? 0) - (a.avgDwellSec ?? 0))[0];
  const heatMax = Math.max(1, ...(detail?.heat.flat() ?? [0]));
  const trendMax = Math.max(1, ...(detail?.trend.map((t) => t.clicks) ?? [0]));
  const unit = data?.range.unit ?? "day";

  const downloadCsv = () => {
    if (!data) return;
    const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push(`기간,${data.range.from} ~ ${data.range.to}`);
    lines.push("");
    lines.push(["메뉴", "클릭 수", "이전 기간 클릭", "방문자", "평균 체류(초)", "체류 측정 건수"].map(esc).join(","));
    for (const r of data.rows) lines.push([r.label, r.clicks, r.prevClicks, r.visitors, r.avgDwellSec, r.dwellSamples].map(esc).join(","));
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
              <table className="w-full text-[13px] min-w-[680px]">
                <thead>
                  <tr className="text-left text-gray-400 text-[12px] border-b border-gray-100">
                    <th className="px-4 py-3 font-semibold w-10">#</th>
                    <th className="px-4 py-3 font-semibold">메뉴</th>
                    <th className="px-4 py-3 font-semibold">클릭 수</th>
                    <th className="px-4 py-3 font-semibold text-right">클릭 비율</th>
                    <th className="px-4 py-3 font-semibold text-right">이전 기간 대비</th>
                    <th className="px-4 py-3 font-semibold text-right">방문자</th>
                    <th className="px-4 py-3 font-semibold text-right">평균 체류시간</th>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {rows.length > 0 && <p className="text-[12px] text-gray-400 -mt-2">메뉴 행을 누르면 아래 상세 분석이 그 메뉴 기준으로 바뀝니다.</p>}

          {/* 상세 분석 */}
          {detail && rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15px] font-extrabold text-gray-900">상세 분석 · {detail.menu ?? "전체 메뉴"}</h2>
                {detail.menu && (
                  <button onClick={() => setMenu("")} className="px-3 min-h-[44px] rounded-full border border-gray-200 bg-white text-[12px] font-bold text-gray-600 hover:border-gray-400">
                    전체 메뉴 보기
                  </button>
                )}
                <span className="text-[12px] text-gray-400">
                  클릭 {detail.clicks.toLocaleString()} · 방문자 {detail.visitors.toLocaleString()} · 평균 체류 {fmtDwell(detail.avgDwellSec)}
                </span>
              </div>

              <Card title={unit === "hour" ? "시간대별 클릭 (하루)" : "일별 클릭 추이"}>
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
              </Card>

              <Card title="요일 · 시간대별 클릭">
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Card title="어느 페이지에서 눌렀나 (클릭 발생 페이지)">
                  <BarList items={detail.pages} total={detail.clicks} />
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
