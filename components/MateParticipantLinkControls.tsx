"use client";

import { useState, useTransition } from "react";
import { issueMateParticipantLink } from "@/app/admin/mate/actions";
import { formatMateDateTime, formatMateShortDate } from "@/lib/mate";

const button = "inline-flex min-h-9 items-center rounded-md border border-slate-300 px-3 text-sm font-bold disabled:opacity-50";

export default function MateParticipantLinkControls({ round, id, version, firstIssuedAt, issuedAt, expired, path }: {
  round: number; id: string; version: number; firstIssuedAt: string | null; issuedAt: string | null; expired: boolean; path: string | null;
}) {
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();

  function issue() {
    if (issuedAt && !window.confirm("재발급하면 기존 링크가 만료됩니다. 새 링크를 발급하시겠습니까?")) return;
    startTransition(async () => {
      try {
        const result = await issueMateParticipantLink(round, id, version, Boolean(issuedAt));
        setStatus(result.error ?? "");
      } catch {
        setStatus("링크 발급 상태를 확인하지 못했습니다. 다시 시도해 주세요.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {expired ? <span className="text-xs text-slate-600">활동 종료</span> : <button type="button" className={button} disabled={pending} onClick={issue}>
        {pending ? "처리 중…" : issuedAt ? "재발급" : "링크 발급"}
      </button>}
      {issuedAt && <span className="whitespace-nowrap text-xs text-slate-700">
        {version > 0 && firstIssuedAt && <> <time dateTime={firstIssuedAt} title={formatMateDateTime(firstIssuedAt)}>{formatMateShortDate(firstIssuedAt)}</time> 최초 발급 · </>}
        <time dateTime={issuedAt} title={formatMateDateTime(issuedAt)}>{formatMateShortDate(issuedAt)}</time> {version > 0 ? "재발급" : "발급"}
      </span>}
      {!expired && path && <a href={path} target="_blank" rel="noreferrer" className={button}>링크 열기</a>}
      {status && <span role="status" className="break-all text-xs">{status}</span>}
    </div>
  );
}
