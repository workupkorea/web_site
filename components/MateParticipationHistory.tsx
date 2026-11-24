"use client";

import { useState, type FormEvent } from "react";
import { formatMateSize, type MatePortal } from "@/lib/mate-activities";
import { formatMateDateTime, formatMateShortDate } from "@/lib/mate";

type Save = (payload: object) => Promise<string | null>;

export function MateActivityResult({ activity, save }: { activity: MatePortal["activities"][number]; save: Save }) {
  const [url, setUrl] = useState(activity.response?.result_instagram_url ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const submitted = activity.response?.result_instagram_url;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(await save({ type: "result", activity_no: activity.activity_no, instagram_url: url }) ?? "결과물 링크를 저장했습니다.");
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="mt-5 grid items-end gap-2 border-t border-[#e5e1d9] bg-[#f7f5ef] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-4">
      <label className="grid min-w-0 gap-2 text-sm font-bold">인스타그램 결과물 링크
        <input type="url" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)}
          className="min-h-11 w-full min-w-0 rounded-sm border border-[#bfbcb3] bg-white px-3 py-2 text-base font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#95501f]"
          maxLength={500} placeholder="https://www.instagram.com/…" required />
      </label>
      <button className="min-h-11 justify-self-end rounded-sm border border-[#bfbcb3] bg-white px-4 py-2 text-sm font-bold text-[#221f1b] hover:bg-[#f9eee1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#95501f] disabled:opacity-60" disabled={pending}>
          {submitted ? "결과물 링크 수정" : "결과물 제출"}
      </button>
      {submitted && <a href={submitted} target="_blank" rel="noreferrer" className="inline-flex min-h-11 w-fit items-center text-sm font-semibold underline underline-offset-4 sm:col-span-2">제출한 링크 열기</a>}
      {message && <p role="status" className="text-sm sm:col-span-2">{message}</p>}
    </form>
  );
}

export type MateHistoryEntry = Omit<MatePortal["history"][number], "response"> & {
  response: MatePortal["history"][number]["response"] | null;
  product_info?: string | null;
  product_url?: string | null;
};

export function MateParticipationHistory({ history }: { history: MateHistoryEntry[] }) {
  return (
    <details className="group bg-white">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-sm px-4 py-2.5 text-sm font-bold hover:bg-[#f3f1ed] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#95501f] [&::-webkit-details-marker]:hidden">
        내 참여 이력
        <span aria-hidden="true" className="size-2 shrink-0 rotate-45 border-r border-b border-[#63574b] group-open:rotate-[225deg]" />
      </summary>
      {history.length === 0 ? <p className="border-t border-[#e5e1d9] p-4 text-sm text-[#645b51]">아직 확인할 참여 이력이 없습니다.</p> : (
        <ul className="divide-y divide-[#e5e1d9] border-t border-[#e5e1d9] px-4">
          {history.map(({ activity_no, product_name, product_info, product_url, response }) => (
            <li key={activity_no} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
              <div className="min-w-0">
                <p className="break-words font-bold">{activity_no}회차 · {product_name}</p>
                {product_info && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#645b51]">{product_info}</p>}
                {product_url && <a href={product_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm underline">제품 정보</a>}
                <p className="mt-0.5 text-sm text-[#645b51]">{response ? [response.choice === "yes" ? "참여" : "불참", response.size ? formatMateSize(response.size) : null, response.color].filter(Boolean).join(" · ") : "미응답"}</p>
                {response?.updated_at && <p className="text-sm text-[#645b51]">응답 <time dateTime={response.updated_at} title={formatMateDateTime(response.updated_at)}>{formatMateShortDate(response.updated_at)}</time></p>}
                {response?.result_submitted_at && <p className="text-sm text-[#645b51]">결과물 제출 <time dateTime={response.result_submitted_at} title={formatMateDateTime(response.result_submitted_at)}>{formatMateShortDate(response.result_submitted_at)}</time></p>}
                {response?.choice === "yes" && response.additional_selections?.map((product) => <p key={product.product_id} className="text-sm text-[#645b51]">
                  {[product.product_name, formatMateSize(product.size), product.color].filter(Boolean).join(" · ")}
                </p>)}
              </div>
              {response?.result_instagram_url
                ? <a href={response.result_instagram_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center text-sm font-bold underline">인스타그램 결과물</a>
                : response?.choice === "yes" && <span className="text-sm text-[#645b51]">결과물 미제출</span>}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
