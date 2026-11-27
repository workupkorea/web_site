"use client";

import { useRouter } from "next/navigation";
import { entriesPath, eventPhase, eventStatuses, type PromotionEvent } from "./events";

export default function EventSelect({ events, selectedId }: { events: PromotionEvent[]; selectedId: string }) {
  const router = useRouter();
  if (events.length === 1) return null; // 이벤트가 하나면 이름을 따로 보여주지 않는다.
  return (
    <select
      aria-label="이벤트 선택"
      value={selectedId}
      onChange={(event) => router.push(`${entriesPath}?${new URLSearchParams({ event: event.target.value })}`)}
      className="min-h-11 min-w-0 max-w-full border border-[var(--admin-line)] bg-white px-2.5 text-sm font-semibold text-slate-900 sm:min-h-9 sm:max-w-56"
    >
      {events.map((event) => <option key={event.id} value={event.id}>{event.name} · {eventStatuses[eventPhase(event)]}</option>)}
    </select>
  );
}
