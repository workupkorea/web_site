"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { savePromotionEvent } from "./actions";
import type { PromotionEvent } from "./events";

const fieldRow = "flex min-w-0 items-center gap-3";
const fieldLabel = "shrink-0 whitespace-nowrap";
const input = "block min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal";

export default function EventForm({ event, cancelHref }: { event?: PromotionEvent; cancelHref: string }) {
  const [error, save, pending] = useActionState(savePromotionEvent, "");
  const [fields, setFields] = useState({
    name: event?.name ?? "",
    start: event?.start ?? "",
    end: event?.end ?? "",
    publicUrl: event?.publicUrl ?? "",
  });
  const [flags, setFlags] = useState({ entry: event?.entry ?? false, archived: event?.status === "archived" });
  function flag(name: keyof typeof flags) {
    return {
      name,
      type: "checkbox" as const,
      checked: flags[name],
      onChange: (change: React.ChangeEvent<HTMLInputElement>) => setFlags((current) => ({ ...current, [name]: change.target.checked })),
      className: "size-4 accent-blue-700",
    };
  }
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
          <div className={`${fieldRow} flex-wrap gap-x-5`}>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2"><input {...flag("entry")} />영수증 응모</label>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2"><input {...flag("archived")} />보관 (지난 이벤트 · 고객 응모 중단)</label>
          </div>
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
