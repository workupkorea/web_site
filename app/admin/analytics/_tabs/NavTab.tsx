"use client";
import { useEffect, useMemo, useState } from "react";

type NavRow = {
  label: string;
  clicks: number;
  visitors: number;
  dwellSamples: number;
  avgDwellSec: number | null;
};

const PRESETS = [
  { label: "최근 7일", days: 7 },
  { label: "최근 30일", days: 30 },
  { label: "최근 90일", days: 90 },
  { label: "전체", days: 0 },
];

function fmtDwell(sec: number | null) {
  if (sec == null) return "–";
  const s = Math.round(sec);
  return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`;
}

// 마케팅/분석 → 메뉴 분석: 상단 메뉴별 클릭 수·클릭 비율·방문자 수·이동 페이지 평균 체류시간
export default function NavTab() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<NavRow[]>([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/admin/analytics/nav?days=${days}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.error ?? "불러오지 못했습니다");
        setRows(d.rows ?? []);
        setTotalClicks(d.totalClicks ?? 0);
      })
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, [days]);

  const maxClicks = useMemo(() => Math.max(1, ...rows.map((r) => r.clicks)), [rows]);
  const topRow = rows[0];
  const longest = useMemo(
    () => [...rows].filter((r) => r.avgDwellSec != null).sort((a, b) => (b.avgDwellSec ?? 0) - (a.avgDwellSec ?? 0))[0],
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            onClick={() => setDays(p.days)}
            className={`px-3.5 py-2 min-h-[44px] rounded-full text-[13px] font-bold border transition-colors ${
              days === p.days ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-[12px] text-gray-400 font-semibold">메뉴 클릭 합계</p>
          <p className="text-2xl font-extrabold text-[#E5541B] mt-1">{totalClicks.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-[12px] text-gray-400 font-semibold">가장 많이 클릭된 메뉴</p>
          <p className="text-xl font-extrabold text-gray-900 mt-1 truncate">{topRow?.label ?? "–"}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-[12px] text-gray-400 font-semibold">체류시간이 가장 긴 메뉴</p>
          <p className="text-xl font-extrabold text-gray-900 mt-1 truncate">
            {longest ? `${longest.label} · ${fmtDwell(longest.avgDwellSec)}` : "–"}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        {error ? (
          <p className="p-6 text-[13px] text-red-500">
            {error}
            <br />
            <span className="text-gray-400">nav_events 테이블/집계 함수가 아직 없다면 SQL 에디터에서 migrate_add_nav_events.sql 을 실행하세요.</span>
          </p>
        ) : loading ? (
          <p className="p-6 text-[13px] text-gray-400">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-[13px] text-gray-400">이 기간에 기록된 메뉴 클릭이 없습니다.</p>
        ) : (
          <table className="w-full text-[13px] min-w-[560px]">
            <thead>
              <tr className="text-left text-gray-400 text-[12px] border-b border-gray-100">
                <th className="px-4 py-3 font-semibold w-10">#</th>
                <th className="px-4 py-3 font-semibold">메뉴</th>
                <th className="px-4 py-3 font-semibold">클릭 수</th>
                <th className="px-4 py-3 font-semibold text-right">클릭 비율</th>
                <th className="px-4 py-3 font-semibold text-right">방문자</th>
                <th className="px-4 py-3 font-semibold text-right">평균 체류시간</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.label} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 text-gray-400 font-bold">{i + 1}</td>
                  <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{r.label}</td>
                  <td className="px-4 py-3 min-w-[160px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-[#E5541B]" style={{ width: `${(r.clicks / maxClicks) * 100}%` }} />
                      </div>
                      <span className="font-bold tabular-nums w-10 text-right">{r.clicks.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {totalClicks > 0 ? `${((r.clicks / totalClicks) * 100).toFixed(1)}%` : "–"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.visitors.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmtDwell(r.avgDwellSec)}
                    {r.dwellSamples > 0 && <span className="text-[11px] text-gray-300 ml-1">({r.dwellSamples})</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[12px] text-gray-400 leading-relaxed">
        체류시간은 해당 메뉴로 이동한 페이지에서 화면이 보인 시간만 측정하며(괄호는 측정 건수), 30분 초과는 30분으로 처리합니다. 새 창으로 열리는 메뉴는 클릭만 집계됩니다.
      </p>
    </div>
  );
}
