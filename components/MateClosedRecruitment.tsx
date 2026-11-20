"use client";

import { useState, type ReactNode } from "react";

export default function MateClosedRecruitment({ selector, actions, settings, applicants, applicantsTitle, initialApplicantsOpen }: {
  selector: ReactNode;
  actions: ReactNode;
  settings: ReactNode;
  applicants: ReactNode;
  applicantsTitle: string;
  initialApplicantsOpen: boolean;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [applicantsOpen, setApplicantsOpen] = useState(initialApplicantsOpen);
  const button = "inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold hover:bg-slate-50 aria-expanded:border-blue-300 aria-expanded:text-blue-800";

  return (
    <>
      <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1">
        {selector}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {actions}
          <button type="button" className={button} aria-expanded={settingsOpen} aria-controls="closed-mate-settings"
            onClick={() => setSettingsOpen(!settingsOpen)}>
            모집 설정 편집 <span aria-hidden="true">{settingsOpen ? "▴" : "▾"}</span>
          </button>
          <button type="button" className={button} aria-expanded={applicantsOpen} aria-controls="closed-mate-applicants"
            onClick={() => setApplicantsOpen(!applicantsOpen)}>
            {applicantsTitle}<span aria-hidden="true">{applicantsOpen ? "▴" : "▾"}</span>
          </button>
        </div>
      </section>
      <div id="closed-mate-settings" hidden={!settingsOpen}>{settings}</div>
      <div id="closed-mate-applicants" hidden={!applicantsOpen}>{applicants}</div>
    </>
  );
}