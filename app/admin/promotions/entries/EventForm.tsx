"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { savePromotionEvent } from "./actions";
import { eventStatuses, type PromotionEvent } from "./events";

const fieldRow = "flex min-w-0 items-center gap-3";
const fieldLabel = "shrink-0 whitespace-nowrap";
const input = "block min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal";

export default function EventForm({ event, cancelHref }: { event?: PromotionEvent; cancelHref: string }) {
  const [error, save, pending] = useActionState(savePromotionEvent, "");
  const [fields, setFields] = useState({
    name: event?.name ?? "",
    status: event?.status ?? "planned",
    start: event?.start ?? "",
    end: event?.end ?? "",
    publicUrl: event?.publicUrl ?? "",
  });
  function field(name: keyof typeof fields) {
    return {
      name,
      value: fields[name],
      onChange: (change: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setFields((current) => ({ ...current, [name]: change.target.value })),
    };
  }
  return (
    <form action={save} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <fieldset disabled={pending} aria-label={event ? "이벤트 수정" : "이벤트 추가"} className="min-w-0 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">{event ? "이벤트 수정" : "이벤트 추가"}</h2>
          <div className="flex shrink-0 gap-2">
            <button type="submit" className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white">
              {pending ? "저장 중…" : "저장"}
            </button>
            <Link href={cancelHref} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">취소</Link>
          </div>
        </div>
        <input type="hidden" name="id" value={event?.id ?? ""} />
        <div className="grid gap-3 text-sm font-semibold text-slate-700 sm:grid-cols-2 lg:grid-cols-[minmax(10rem,2fr)_minmax(7rem,1fr)_minmax(11.5rem,1fr)_minmax(11.5rem,1fr)]">
          <label className={fieldRow}>
            <span className={fieldLabel}>이벤트명</span>
            <input {...field("name")} required maxLength={80} className={input} />
          </label>
          <label className={fieldRow}>
            <span className={fieldLabel}>상태</span>
            <select {...field("status")} className={input}>
              {Object.entries(eventStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={fieldRow}>
            <span className={fieldLabel}>시작일</span>
            <input {...field("start")} type="date" className={input} />
          </label>
          <label className={fieldRow}>
            <span className={fieldLabel}>종료일</span>
            <input {...field("end")} type="date" className={input} />
          </label>
          <label className={`${fieldRow} col-span-full`}>
            <span className={fieldLabel}>공개 안내·응모 링크</span>
            <input {...field("publicUrl")} placeholder="/이벤트 경로 또는 https://…" maxLength={500} className={input} />
          </label>
        </div>
      </fieldset>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    </form>
  );
}
