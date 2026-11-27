"use client";

import { useOptimistic, useState, useTransition } from "react";
import { rateMateResult } from "@/app/admin/mate/activities/actions";
import { MATE_RATING_MAX } from "@/lib/mate-ratings";

export default function MateStarRating({ round, activity, applicationId, score, name }: {
  round: number; activity: number; applicationId: string; score: number | null; name: string;
}) {
  const [shown, setShown] = useOptimistic(score);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function rate(value: number) {
    const next = value === shown ? null : value;
    startTransition(async () => {
      setShown(next);
      try {
        const result = await rateMateResult(round, activity, applicationId, next);
        setError(result.error ?? "");
      } catch {
        setError("평가결과 저장 여부를 확인하지 못했습니다. 새로고침해 주세요.");
      }
    });
  }

  return (
    <div role="group" aria-label={`${name} ${activity}회차 평가결과`} className="inline-flex flex-col items-center">
      <div className="flex">
        {Array.from({ length: MATE_RATING_MAX }, (_, index) => index + 1).map((value) => (
          <button key={value} type="button" disabled={pending} onClick={() => rate(value)}
            aria-label={`${value}점${value === shown ? " (선택됨, 누르면 취소)" : ""}`} aria-pressed={value === shown}
            className={`inline-flex size-11 items-center justify-center rounded text-xl leading-none hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-blue-800 md:h-6 md:w-4 md:text-sm ${value <= (shown ?? 0) ? "text-amber-500" : "text-slate-300"}`}>
            <span aria-hidden="true">★</span>
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
