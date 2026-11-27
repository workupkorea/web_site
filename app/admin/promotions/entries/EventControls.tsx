"use client";

import { useState, useTransition } from "react";
import { setPromotionOverride } from "./actions";
import type { EventOverride, EventPhase } from "./events";

/** 영수증 응모 이벤트의 시작·종료 버튼. 날짜 자동 규칙보다 우선한다. */
export default function EventControls({ id, phase, override, ended, className }: {
  id: string; phase: EventPhase; override: EventOverride; ended: boolean; className: string;
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function change(next: EventOverride, question: string) {
    if (!window.confirm(question)) return;
    start(async () => setError(await setPromotionOverride(id, next)));
  }

  return (
    <>
      {phase === "active" ? (
        <button type="button" disabled={pending} className={className}
          onClick={() => change("closed", "이벤트를 지금 종료할까요?\n고객 응모가 바로 막힙니다.")}>이벤트 종료</button>
      ) : phase !== "archived" && (
        <button type="button" disabled={pending || ended} title={ended ? "종료일을 늘린 뒤 시작할 수 있어요." : undefined} className={className + " disabled:opacity-50"}
          onClick={() => change("open", "이벤트를 지금 시작할까요?\n고객이 바로 응모할 수 있습니다.")}>이벤트 시작</button>
      )}
      {override && (
        <button type="button" disabled={pending} className={className}
          onClick={() => change("", "시작·종료를 설정한 날짜에 맞춰 자동으로 바꿀까요?")}>날짜 자동</button>
      )}
      {error && <span role="alert" className="self-center pl-2 text-sm text-rose-700">{error}</span>}
    </>
  );
}
