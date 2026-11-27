import { rankMateRatings, type MateRating } from "@/lib/mate-ratings";

const cell = "whitespace-nowrap px-3 py-1.5 tabular-nums";

export default function MateScoreSummary({ activities, mates, ratings, note, emptyText, open }: {
  activities: { activity_no: number }[];
  mates: { id: string; name: string; sns_id: string }[];
  ratings: MateRating[];
  note: string;
  emptyText: string;
  open?: boolean;
}) {
  const numbers = [...new Set([...activities, ...ratings].map((item) => item.activity_no))].sort((a, b) => a - b);
  const rows = rankMateRatings(mates, ratings);

  return (
    <details open={open} className="group min-w-0 overflow-hidden rounded-lg border border-slate-200">
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-2 font-bold hover:bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-800 [&::-webkit-details-marker]:hidden">
        메이트별 평가결과
        <span className="ml-auto text-xs font-normal text-slate-700">{note}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"
          className="size-4 text-slate-600 group-open:rotate-180">
          <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      {rows.length ? <div role="region" aria-label="메이트별 평가결과표 스크롤 영역" tabIndex={0} className="overflow-x-auto border-t border-slate-200">
        <table className="w-full text-center text-sm">
          <thead className="bg-slate-100">
            <tr>
              {["순위", "이름", "SNS", ...numbers.map((number) => `${number}회차`), "합계"].map((label) =>
                <th key={label} scope="col" className="whitespace-nowrap px-3 py-1.5">{label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map(({ mate, scores, total, rank }) => <tr key={mate.id}>
              <td className={cell}>{rank ?? "—"}</td>
              <th scope="row" className={cell}>{mate.name}</th>
              <td className={cell}>@{mate.sns_id}</td>
              {numbers.map((number) => <td key={number} className={cell}>{scores.get(number) ?? "—"}</td>)}
              <td className={cell + " font-bold"}>{scores.size ? `${total}점` : "—"}</td>
            </tr>)}
          </tbody>
        </table>
      </div> : <p className="border-t border-slate-200 p-4 text-sm">{emptyText}</p>}
    </details>
  );
}
