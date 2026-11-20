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
    <form onSubmit={submit} className="mt-5 space-y-2 border-t border-[#d8dfd7] pt-4">
      <label className="grid gap-2 text-sm font-bold">인스타그램 결과물 링크
        <input type="url" value={url} onChange={(event) => setUrl(event.target.value)}
          className="min-h-11 w-full rounded-md border border-[#a7b8ac] px-3 py-2 font-normal"
          maxLength={500} placeholder="https://www.instagram.com/reel/…" required />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className="min-h-11 rounded-md bg-[#285746] px-4 py-2 font-bold text-white disabled:opacity-50" disabled={pending}>
          {submitted ? "결과물 링크 수정" : "결과물 제출"}
        </button>
        {submitted && <a href={submitted} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-bold underline">제출한 링크 열기</a>}
      </div>
      {message && <p role="status" className="text-sm">{message}</p>}
    </form>
  );
}

export function MateParticipationHistory({ history }: { history: MatePortal["history"] }) {
  return (
    <details className="rounded-lg border border-[#d8dfd7] bg-white p-4 sm:p-6">
      <summary className="cursor-pointer text-base font-black">내 참여 이력</summary>
      {history.length === 0 ? <p className="mt-3 text-sm text-[#4d6258]">아직 저장한 회차 응답이 없습니다.</p> : (
        <ul className="mt-3 divide-y divide-[#d8dfd7]">
          {history.map(({ activity_no, product_name, response }) => (
            <li key={activity_no} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
              <div className="min-w-0">
                <p className="break-words font-bold">{activity_no}회차 · {product_name}</p>
                <p className="mt-0.5 text-sm text-[#4d6258]">{[response.choice === "yes" ? "참여" : "불참", response.size ? formatMateSize(response.size) : null, response.color].filter(Boolean).join(" · ")}</p>
                {response.updated_at && <p className="text-sm text-[#4d6258]">응답 <time dateTime={response.updated_at} title={formatMateDateTime(response.updated_at)}>{formatMateShortDate(response.updated_at)}</time></p>}
                {response.result_submitted_at && <p className="text-sm text-[#4d6258]">결과물 제출 <time dateTime={response.result_submitted_at} title={formatMateDateTime(response.result_submitted_at)}>{formatMateShortDate(response.result_submitted_at)}</time></p>}
                {response.choice === "yes" && response.additional_selections?.map((product) => <p key={product.product_id} className="text-sm text-[#4d6258]">
                  {[product.product_name, formatMateSize(product.size), product.color].filter(Boolean).join(" · ")}
                </p>)}
              </div>
              {response.result_instagram_url
                ? <a href={response.result_instagram_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center text-sm font-bold underline">인스타그램 결과물</a>
                : response.choice === "yes" && <span className="text-sm text-[#4d6258]">결과물 미제출</span>}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
