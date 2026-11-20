"use client";

import { useActionState } from "react";
import { saveMateResultMetrics } from "@/app/admin/mate/activities/actions";
import { MATE_RESULT_METRIC_KEYS, MATE_RESULT_METRICS, type MateResponse } from "@/lib/mate-activities";

type Answer = Pick<MateResponse, "round" | "activity_no" | "application_id" | "result_instagram_url" | "result_metrics">;

export default function MateResultMetricsEditor({ answer }: { answer: Answer }) {
  const [state, action, pending] = useActionState(saveMateResultMetrics, {});
  return <div className="min-w-0 text-left">
    <details>
      <summary className="cursor-pointer px-1 py-0.5 text-xs font-semibold text-slate-700">지표 입력</summary>
      <form action={action} className="mt-1 grid gap-1 whitespace-normal rounded border border-slate-200 bg-white p-2">
        <input type="hidden" name="round" value={answer.round} />
        <input type="hidden" name="activity_no" value={answer.activity_no} />
        <input type="hidden" name="application_id" value={answer.application_id} />
        <input type="hidden" name="result_url" value={answer.result_instagram_url ?? ""} />
        {MATE_RESULT_METRIC_KEYS.map((key) => <label key={key} className="flex items-center justify-between gap-2 text-xs font-semibold">
          {MATE_RESULT_METRICS[key]}
          <input name={key} type="number" min={0} max={999999999} step={1} defaultValue={answer.result_metrics?.[key] ?? ""}
            className="w-24 rounded border border-slate-300 px-2 py-1 text-right" />
        </label>)}
        <button disabled={pending} className="rounded bg-slate-900 px-2 py-1.5 text-xs font-bold text-white disabled:opacity-60">
          {pending ? "저장 중…" : "지표 저장"}
        </button>
      </form>
    </details>
    {state.error && <p role="alert" className="whitespace-normal text-xs text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-xs text-emerald-800">{state.success}</p>}
  </div>;
}
