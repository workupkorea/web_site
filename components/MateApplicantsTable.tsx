"use client";

import { Fragment, useState, useTransition, type ReactNode } from "react";
import { removeMateApplications } from "@/app/admin/mate/actions";
import { MATE_STATUSES } from "@/lib/mate";
import MateDisclosureIcon from "./MateDisclosureIcon";

type Row = {
  id: string;
  name: string;
  snsId: string;
  feedStyle: string;
  phone: string;
  region: string;
  gender: string;
  reviewStatus: keyof typeof MATE_STATUSES;
  detail: ReactNode;
};

export default function MateApplicantsTable({ rows, round, title, filter, defaultOpen, alwaysOpen = false, children }: {
  rows: Row[]; round: number; title: string; filter: ReactNode; defaultOpen: boolean; alwaysOpen?: boolean; children?: ReactNode;
}) {
  const [listExpanded, setListOpen] = useState(defaultOpen);
  const listOpen = alwaysOpen || listExpanded;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const selected = checked.filter((id) => rows.some((row) => row.id === id));
  const all = rows.length > 0 && selected.length === rows.length;

  function remove() {
    if (!selected.length || !window.confirm(`선택한 지원서 ${selected.length}건을 영구 삭제하시겠습니까?`)) return;
    startTransition(async () => {
      const result = await removeMateApplications(round, selected);
      setMessage(result.error ?? result.success ?? "");
      if (result.success) setChecked([]);
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {!alwaysOpen && <h2>
          <button type="button" onClick={() => setListOpen(!listOpen)} aria-expanded={listOpen} aria-controls="mate-applicant-list"
            className="inline-flex min-h-9 items-center gap-2 whitespace-nowrap text-lg font-bold hover:text-blue-800">
            {title}<span className="text-sm" aria-hidden="true">{listOpen ? "▾" : "▸"}</span>
          </button>
        </h2>}
        {listOpen && <div className="ml-auto flex flex-wrap items-center gap-2">
          {filter}
          <button type="button" disabled={!selected.length || pending} onClick={remove}
            className="min-h-11 rounded-md border border-red-200 px-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-40 md:min-h-9">
            {pending ? "삭제 중…" : `선택 삭제${selected.length ? ` (${selected.length})` : ""}`}
          </button>
        </div>}
      </div>
      <div id="mate-applicant-list" hidden={!listOpen}>
      {message && <p role="status" className="mt-2 text-sm">{message}</p>}
      {rows.length > 0 && (
        <div className="mt-2 overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[760px] text-left text-sm" aria-label="지원자 목록">
            <thead className="bg-slate-100 text-slate-800">
              <tr>
                <th className="w-10 px-2 py-1" scope="col">
                  <label className="flex cursor-pointer items-center justify-center">
                    <input type="checkbox" aria-label="현재 목록 전체 선택" checked={all} disabled={pending}
                      onChange={() => setChecked(all ? [] : rows.map((row) => row.id))} />
                  </label>
                </th>
                {["지원자", "아이디", "피드 스타일", "연락처", "주소지 지역", "성별", "심사 상태"].map((label) => (
                  <th key={label} scope="col" className="px-3 py-2 font-bold">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row) => {
                const open = expanded === row.id;
                const detailId = `applicant-detail-${row.id}`;
                return (
                  <Fragment key={row.id}>
                    <tr className={open || selected.includes(row.id) ? "bg-blue-50" : "hover:bg-slate-50"}>
                      <td className="px-2 py-0.5">
                        <label className="flex cursor-pointer items-center justify-center">
                          <input type="checkbox" aria-label={`${row.name} 지원서 선택`} disabled={pending} checked={selected.includes(row.id)}
                            onChange={(event) => setChecked(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))} />
                        </label>
                      </td>
                      <th scope="row" className="px-3 py-0.5">
                        <button type="button" onClick={() => setExpanded(open ? null : row.id)}
                          aria-expanded={open} aria-controls={open ? detailId : undefined}
                          className="inline-flex min-h-11 items-center gap-2 font-bold text-blue-800 md:min-h-9">
                          <MateDisclosureIcon open={open} />
                          <span className="underline underline-offset-4">{row.name}</span><span className="sr-only"> 상세 보기</span>
                        </button>
                      </th>
                      <td className="px-3 py-0.5">
                        <a href={`https://www.instagram.com/${encodeURIComponent(row.snsId)}/`} target="_blank" rel="noreferrer"
                          className="inline-flex min-h-11 items-center font-medium text-blue-800 underline underline-offset-2 md:min-h-9">@{row.snsId}</a>
                      </td>
                      <td className="px-3 py-0.5">{row.feedStyle}</td>
                      <td className="whitespace-nowrap px-3 py-0.5 tabular-nums">{row.phone}</td>
                      <td className="px-3 py-0.5">{row.region}</td>
                      <td className="px-3 py-0.5">{row.gender}</td>
                      <td className="whitespace-nowrap px-3 py-0.5">
                        <span className={row.reviewStatus === "selected" ? "rounded bg-blue-50 px-2 py-0.5 font-semibold text-blue-800" : "text-slate-700"}>
                          {MATE_STATUSES[row.reviewStatus]}
                        </span>
                      </td>
                    </tr>
                    {open && <tr id={detailId}><td colSpan={8} className="bg-slate-50 p-2">{row.detail}</td></tr>}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {children}
      </div>
    </>
  );
}