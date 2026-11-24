"use client";

import { Fragment, useState, useTransition, type ReactNode } from "react";
import { removeMateApplications } from "@/app/admin/mate/actions";
import { MATE_STATUSES, MATE_STYLES } from "@/lib/mate";
import MateDisclosureIcon from "./MateDisclosureIcon";
import MateFeedStyleIcon from "./MateFeedStyleIcon";

type FeedStyle = keyof typeof MATE_STYLES;

const statusColors = {
  received: "border-slate-200 bg-slate-50 text-slate-700",
  reviewing: "border-amber-200 bg-amber-50 text-amber-900",
  selected: "border-blue-200 bg-blue-50 text-blue-900",
  not_selected: "border-rose-200 bg-rose-50 text-rose-900",
} satisfies Record<keyof typeof MATE_STATUSES, string>;
const summaryCell = "inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-1";
const applicantColumns = ["지원자", "아이디", "피드 스타일", "연락처", "주소지 지역", "성별", "심사 상태"];
const applicantColumnCount = applicantColumns.length + 2;

type Row = {
  id: string;
  name: string;
  snsId: string;
  primaryFeedStyle?: FeedStyle;
  feedStyle: string;
  phone: string;
  region: string;
  gender: string;
  reviewStatus: keyof typeof MATE_STATUSES;
  participantLink: ReactNode;
  detail: ReactNode;
};

export default function MateApplicantsTable({ rows, round, title, quotas, paginated, filter, children }: {
  rows: Row[];
  round: number;
  title: string;
  quotas: Record<FeedStyle, number | null>;
  paginated: boolean;
  filter: ReactNode;
  children?: ReactNode;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [copyStatus, setCopyStatus] = useState<{ id: string; copied: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = checked.filter((id) => rows.some((row) => row.id === id));
  const all = rows.length > 0 && selected.length === rows.length;
  const groups = [
    ...(Object.keys(MATE_STYLES) as FeedStyle[]).map((style) => ({
      style, label: MATE_STYLES[style], members: rows.filter((row) => row.primaryFeedStyle === style),
    })),
    { style: null, label: "미분류", members: rows.filter((row) => !row.primaryFeedStyle || !Object.hasOwn(MATE_STYLES, row.primaryFeedStyle)) },
  ].filter((group) => group.members.length > 0);

  async function copyId(row: Row) {
    try {
      await navigator.clipboard.writeText(row.snsId);
      setCopyStatus({ id: row.id, copied: true });
    } catch {
      setCopyStatus({ id: row.id, copied: false });
    }
  }

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
        <h2 className="text-lg font-bold">{title}</h2>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {filter}
          <button type="button" disabled={!selected.length || pending} onClick={remove}
            className="min-h-11 rounded-md border border-red-200 px-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-40 md:min-h-9">
            {pending ? "삭제 중…" : `선택 삭제${selected.length ? ` (${selected.length})` : ""}`}
          </button>
        </div>
      </div>
      {message && <p role="status" className="mt-2 text-sm">{message}</p>}
      <p role="status" className="sr-only">{copyStatus?.copied ? "인스타그램 아이디를 복사했습니다." : ""}</p>
      {paginated && rows.length > 0 && <p className="mt-2 text-xs text-slate-600">그룹별 지원자 수는 현재 페이지 기준입니다.</p>}
      {rows.length > 0 && (
        <div className="mt-2 overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[900px] text-center text-sm [&_tr>*:not(:last-child)]:border-r [&_tr>*]:border-slate-200" aria-label="지원자 목록">
            <thead className="bg-slate-100 text-slate-800">
              <tr>
                <th className="w-10 px-2 py-1" scope="col">
                  <label className="flex cursor-pointer items-center justify-center">
                    <input type="checkbox" aria-label="현재 목록 전체 선택" checked={all} disabled={pending}
                      onChange={() => setChecked(all ? [] : rows.map((row) => row.id))} />
                  </label>
                </th>
                {applicantColumns.map((label) => (
                  <th key={label} scope="col" className="px-3 py-2 font-bold">{label}</th>
                ))}
                <th scope="col" className="min-w-32 px-3 py-2 text-center font-bold">개인 링크</th>
              </tr>
            </thead>
            {groups.map(({ style, label, members }) => <tbody key={label} className="divide-y divide-slate-200">
              <tr className="border-t border-slate-200 bg-blue-50/70">
                <th scope="rowgroup" colSpan={applicantColumnCount} className="px-3 py-2 text-sm text-blue-950">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-1.5 font-bold">
                      {style && <span aria-hidden="true"><MateFeedStyleIcon style={style} /></span>}
                      {label}
                    </span>
                    <span className="ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs font-normal text-slate-700">
                      <span className="inline-flex gap-1">
                        {style && <span className={`${summaryCell} border-slate-200 bg-white`}>
                          모집 <strong>{quotas[style] === null ? "미정" : `${quotas[style]}명`}</strong>
                        </span>}
                        <span className={`${summaryCell} border-slate-200 bg-white`}>지원 <strong>{members.length}명</strong></span>
                      </span>
                      <span className="inline-flex gap-1 border-l border-slate-300 pl-2">
                        {(Object.keys(MATE_STATUSES) as Row["reviewStatus"][]).map((status) => (
                          <span key={status} className={`${summaryCell} ${statusColors[status]}`}>
                            {MATE_STATUSES[status]} <strong>{members.filter((row) => row.reviewStatus === status).length}명</strong>
                          </span>
                        ))}
                      </span>
                    </span>
                  </div>
                </th>
              </tr>
              {members.map((row) => {
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
                      <td className="whitespace-nowrap px-3 py-0.5">
                        <div className="inline-flex items-center gap-1">
                          <a href={`https://www.instagram.com/${encodeURIComponent(row.snsId)}/`} target="_blank" rel="noreferrer"
                            className="inline-flex min-h-11 items-center font-medium text-blue-800 underline underline-offset-2 md:min-h-9">@{row.snsId}</a>
                          <button type="button" onClick={() => void copyId(row)} aria-label={`${row.snsId} 아이디 복사`}
                            className="inline-flex size-9 items-center justify-center rounded text-slate-600 hover:bg-slate-100 hover:text-blue-800 md:size-7"
                            title={copyStatus?.id === row.id && copyStatus.copied ? "복사 완료" : "아이디 복사"}>
                            <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                              {copyStatus?.id === row.id && copyStatus.copied
                                ? <path d="m4 10 4 4 8-8" />
                                : <><rect x="7" y="7" width="9" height="9" rx="1.5" /><path d="M12 4H5.5A1.5 1.5 0 0 0 4 5.5V12" /></>}
                            </svg>
                          </button>
                        </div>
                        {copyStatus?.id === row.id && !copyStatus.copied && <p role="alert" className="text-xs text-red-700">아이디를 복사하지 못했습니다.</p>}
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
                      <td className="px-3 py-1 [&>div]:justify-center [&_a]:whitespace-nowrap [&_a]:md:min-h-7 [&_a]:md:px-2 [&_a]:md:text-xs [&_button]:whitespace-nowrap [&_button]:min-h-11 [&_button]:md:min-h-7 [&_button]:md:px-2 [&_button]:md:text-xs">
                        {row.participantLink}
                      </td>
                    </tr>
                    {open && <tr id={detailId}><td colSpan={applicantColumnCount} className="bg-slate-50 p-2 text-left">{row.detail}</td></tr>}
                  </Fragment>
                );
              })}
            </tbody>)}
          </table>
        </div>
      )}
      {children}
    </>
  );
}
