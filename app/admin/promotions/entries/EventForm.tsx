"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { savePromotionEvent } from "./actions";
import { eventStatuses, type PromotionEvent } from "./events";

const input = "mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal";

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
      <fieldset disabled={pending} className="space-y-4">
        <legend className="text-base font-bold text-slate-900">{event ? "이벤트 수정" : "이벤트 추가"}</legend>
        <input type="hidden" name="id" value={event?.id ?? ""} />
        <div className="grid gap-3 text-sm font-semibold text-slate-700 sm:grid-cols-2">
          <label>이벤트 이름<input {...field("name")} required maxLength={80} className={input} /></label>
          <label>
            상태
            <select {...field("status")} className={input}>
              {Object.entries(eventStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>시작일<input {...field("start")} type="date" className={input} /></label>
          <label>종료일<input {...field("end")} type="date" className={input} /></label>
          <label className="sm:col-span-2">
            공개 안내·응모 링크
            <input {...field("publicUrl")} placeholder="/이벤트 경로 또는 https://…" maxLength={500} className={input} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white">
            {pending ? "저장 중…" : "저장"}
          </button>
          <Link href={cancelHref} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">취소</Link>
        </div>
      </fieldset>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    </form>
  );
}
