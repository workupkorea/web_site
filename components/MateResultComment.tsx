"use client";

import { useId, useRef, useState, useTransition } from "react";
import { commentMateResult } from "@/app/admin/mate/activities/actions";
import { MATE_COMMENT_MAX } from "@/lib/mate-ratings";

const button = "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md border px-3 text-sm font-bold disabled:opacity-50 md:min-h-9";

export default function MateResultComment({ round, activity, applicationId, comment, name }: {
  round: number; activity: number; applicationId: string; comment: string; name: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [draft, setDraft] = useState(comment);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function open() {
    setDraft(comment);
    setError("");
    dialog.current?.showModal();
  }

  function save() {
    startTransition(async () => {
      try {
        const result = await commentMateResult(round, activity, applicationId, draft);
        setError(result.error ?? "");
        if (!result.error) dialog.current?.close();
      } catch {
        setError("코멘트 저장 여부를 확인하지 못했습니다. 새로고침해 주세요.");
      }
    });
  }

  return (
    <>
      <button type="button" onClick={open} title={comment || undefined}
        aria-label={`${name} ${activity}회차 코멘트 ${comment ? "보기 및 수정" : "추가"}`}
        className={`inline-flex min-h-11 items-center whitespace-nowrap rounded border px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-blue-800 md:min-h-6 md:px-1.5 ${comment
          ? "border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100" : "border-slate-200 text-slate-600 hover:bg-slate-100"}`}>
        {comment ? "코멘트 있음" : "코멘트"}
      </button>
      <dialog ref={dialog} aria-labelledby={titleId}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] whitespace-normal rounded-lg border border-slate-200 bg-white p-4 text-left text-slate-900 backdrop:bg-slate-900/40">
        <div className="space-y-3">
          <h3 id={titleId} className="text-base font-black">{name} · {activity}회차 코멘트</h3>
          <textarea aria-labelledby={titleId} value={draft} onChange={(event) => setDraft(event.target.value)} rows={5}
            maxLength={MATE_COMMENT_MAX} placeholder="내용을 비우고 저장하면 코멘트가 삭제됩니다."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <span className="mr-auto text-xs tabular-nums text-slate-500">{draft.length}/{MATE_COMMENT_MAX}</span>
            <button type="button" onClick={() => dialog.current?.close()} className={button + " border-slate-300"}>닫기</button>
            <button type="button" onClick={save} disabled={pending} className={button + " border-slate-900 bg-slate-900 text-white"}>
              {pending ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
