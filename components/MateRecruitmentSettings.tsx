"use client";

import { useState, type ReactNode } from "react";

export default function MateRecruitmentSettings({ title, actions, children, creating, alwaysOpen = false }: {
  title: string; actions?: ReactNode; children: ReactNode; creating: boolean; alwaysOpen?: boolean;
}) {
  const [open, setOpen] = useState(creating);
  return <>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {actions}
        {!creating && !alwaysOpen && <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mate-recruitment-form"
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">
          모집 설정 편집 <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>}
      </div>
    </div>
    <div id="mate-recruitment-form" hidden={!alwaysOpen && !open}>{children}</div>
  </>;
}