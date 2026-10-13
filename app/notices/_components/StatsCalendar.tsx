"use client";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 통계 상단 캘린더 — 공지가 있는 날짜만 클릭 가능하며, 선택하면 그 날짜의 상세(오픈 목록 +
// 지점별 패스 현황)를 드릴다운해서 보여준다(부모 컴포넌트가 처리). 라이브러리 없이 순수 그리드.
export default function StatsCalendar({
  viewMonth,
  onViewMonthChange,
  markedDates,
  selectedDate,
  onSelectDate,
}: {
  viewMonth: Date;
  onViewMonthChange: (d: Date) => void;
  markedDates: Record<string, number>;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}) {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const startOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  const cells: (string | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 w-full lg:w-64">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => onViewMonthChange(new Date(year, month - 1, 1))}
          className="w-5 h-5 max-lg:w-11 max-lg:h-11 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 text-[12px] max-lg:text-lg"
        >
          ‹
        </button>
        <span className="text-[12px] max-lg:text-sm font-bold text-gray-900">
          {year}년 {month + 1}월
        </span>
        <button
          type="button"
          onClick={() => onViewMonthChange(new Date(year, month + 1, 1))}
          className="w-5 h-5 max-lg:w-11 max-lg:h-11 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 text-[12px] max-lg:text-lg"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[9px] max-lg:text-[11px] font-semibold text-gray-400 py-0.5">
            {w}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const count = markedDates[date] ?? 0;
          const isToday = date === todayStr;
          const isSelected = date === selectedDate;
          return (
            <button
              key={date}
              type="button"
              onClick={() => count > 0 && onSelectDate(isSelected ? null : date)}
              disabled={count === 0}
              title={count > 0 ? `${count}건 오픈` : undefined}
              className={`relative aspect-square rounded text-[11px] max-lg:text-sm flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isSelected
                  ? "bg-[#303236] text-white font-bold"
                  : count > 0
                  ? "text-gray-900 hover:bg-gray-100 font-semibold cursor-pointer"
                  : "text-gray-300 cursor-default"
              } ${isToday && !isSelected ? "ring-1 ring-inset ring-[#E5541B]" : ""}`}
            >
              <span>{Number(date.slice(-2))}</span>
              {count > 0 && <span className={`w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-[#E5541B]"}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
