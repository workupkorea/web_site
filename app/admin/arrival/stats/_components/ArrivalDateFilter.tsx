"use client";
import { useEffect, useMemo, useState } from "react";

// 입고일 필터 — 월을 고른 뒤 "1주차·2주차…" 칩으로 좁히거나, 날짜를 직접 지정한다.
// 주차는 시트 주차 라벨과 같은 월~일 기준이며, 1주차 = 그 달 1일이 속한 주(월 경계에서 잘라 표시).
const pad = (n: number) => String(n).padStart(2, "0");

export function monthWeeks(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const weeks: { start: string; end: string }[] = [];
  for (let day = 1; day <= last;) {
    const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay(); // 0=일
    const end = Math.min(day + ((7 - dow) % 7), last); // 그 주 일요일 또는 월말
    weeks.push({ start: `${ym}-${pad(day)}`, end: `${ym}-${pad(end)}` });
    day = end + 1;
  }
  // 월초·월말에 걸친 4일 미만의 토막 주는 이웃 주에 합쳐 "1일짜리 6주차" 같은 어색한 구간을 막는다
  const len = (w: { start: string; end: string }) => +w.end.slice(8) - +w.start.slice(8) + 1;
  if (weeks.length > 1 && len(weeks[0]) < 4) {
    const first = weeks.shift()!;
    weeks[0] = { start: first.start, end: weeks[0].end };
  }
  if (weeks.length > 1 && len(weeks[weeks.length - 1]) < 4) {
    const lastW = weeks.pop()!;
    weeks[weeks.length - 1] = { start: weeks[weeks.length - 1].start, end: lastW.end };
  }
  return weeks;
}

const md = (iso: string) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;

interface Props {
  /** 선택 가능한 월을 만들기 위한 입고일(YYYY-MM-DD) 목록 */
  dates: string[];
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}

export default function ArrivalDateFilter({ dates, start, end, onChange }: Props) {
  const months = useMemo(
    () => [...new Set(dates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).map(d => d.slice(0, 7)))].sort(),
    [dates],
  );
  const [month, setMonth] = useState("");
  const [showDates, setShowDates] = useState(false); // 날짜 직접 지정은 기본으로 접어 둔다

  // 기간이 바깥에서 비워지면(시즌 변경·필터 해제) 월 선택도 푼다
  useEffect(() => { if (!start && !end) setMonth(""); }, [start, end]);

  const weeks = useMemo(() => (month ? monthWeeks(month) : []), [month]);
  const lastDay = weeks.length ? weeks[weeks.length - 1].end : "";
  const monthAll = !!month && start === `${month}-01` && end === lastDay;

  return (
    <div className="flex items-center gap-2 flex-wrap text-[15px] font-semibold text-gray-700">
      입고일
      <select
        value={month}
        onChange={e => {
          const m = e.target.value;
          setMonth(m);
          if (!m) onChange("", "");
          else onChange(`${m}-01`, monthWeeks(m).slice(-1)[0].end);
        }}
        className="border border-gray-300 rounded px-3 py-2 text-[15px] min-h-[44px]"
        aria-label="입고월"
      >
        <option value="">전체 기간</option>
        {months.map(m => <option key={m} value={m}>{+m.slice(5)}월</option>)}
      </select>

      {month && (
        <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="주차 선택">
          <button
            onClick={() => onChange(`${month}-01`, lastDay)}
            className={`px-3 min-h-[44px] rounded text-sm font-semibold ${monthAll ? "bg-[#303236] text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
          >
            월 전체
          </button>
          {weeks.map((w, i) => {
            const on = start === w.start && end === w.end;
            return (
              <button
                key={w.start}
                onClick={() => onChange(w.start, w.end)}
                title={`${md(w.start)}~${md(w.end)}`}
                className={`px-3 min-h-[44px] rounded text-sm font-semibold ${on ? "bg-[#303236] text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
              >
                {i + 1}주차
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setShowDates(v => !v)}
        aria-expanded={showDates}
        className="px-3 min-h-[44px] text-sm text-gray-500 hover:text-gray-900 font-semibold"
      >
        직접 날짜 지정 {showDates ? "▴" : "▾"}
      </button>
      {showDates && (
        <span className="inline-flex items-center gap-2">
          <input type="date" value={start} max={end || undefined} onChange={e => onChange(e.target.value, end)} className="border border-gray-300 rounded px-3 py-2 text-[15px] min-h-[44px]" aria-label="입고일 시작" />
          ~
          <input type="date" value={end} min={start || undefined} onChange={e => onChange(start, e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-[15px] min-h-[44px]" aria-label="입고일 종료" />
        </span>
      )}
      {/* 접힌 상태에서도 적용 중인 기간은 알 수 있게 요약 */}
      {!showDates && (start || end) && (
        <span className="text-sm font-normal text-gray-400">{start ? md(start) : ""}~{end ? md(end) : ""}</span>
      )}
      {(start || end) && (
        <button onClick={() => onChange("", "")} className="px-3 min-h-[44px] text-sm text-gray-500 underline font-normal">기간 해제</button>
      )}
    </div>
  );
}
