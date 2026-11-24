import Link from "next/link";
import {
  formatMateWon, hasMateActivityStarted, mateActivityCosts, mateActivityStatus, MATE_SHIPPING_COST, summarizeMateActivities,
  type MateActivity, type MateActivityProgress,
} from "@/lib/mate-activities";
import ActivitySummary from "./activity-summary";

const number = new Intl.NumberFormat("ko-KR");
const percent = new Intl.NumberFormat("ko-KR", { style: "percent", maximumFractionDigits: 1 });
const columnNames = ["대상", "참여", "불참", "미응답", "응답률", "결과물", "제출률", "제품비", "택배비", "총비용"];
const cell = "whitespace-nowrap px-3 py-2.5 text-right tabular-nums";
const panel = "rounded-xl border border-slate-200 bg-white";

function rate(value: number, population: number) {
  return population > 0 ? percent.format(value / population) : "—";
}

export default function ActivityStatistics({ round, activities, progress, failed = false, archived = false }: {
  round: number;
  activities: MateActivity[];
  progress: MateActivityProgress[];
  failed?: boolean;
  archived?: boolean;
}) {
  const byActivity = new Map(progress.map((item) => [item.activity_no, item]));
  const rows = activities.flatMap((activity) => {
    const entry = byActivity.get(activity.activity_no);
    return entry && hasMateActivityStarted(activity, entry) ? [{ activity, progress: entry }] : [];
  }).sort((a, b) => a.activity.activity_no - b.activity.activity_no);
  const { counts, costs } = summarizeMateActivities(rows);
  const replied = counts.joined + counts.declined;
  const management = `/admin/mate?round=${round}`;
  const results = `/admin/mate/results?round=${round}`;

  if (failed || activities.some((activity) => hasMateActivityStarted(activity) && !byActivity.has(activity.activity_no))) {
    return <p role="alert" className={panel + " p-4 text-sm text-red-800"}>회차 통계를 불러오지 못했습니다.</p>;
  }
  if (!rows.length) return <p className={panel + " p-4 text-sm text-slate-700"}>집계할 활동 회차가 없습니다.</p>;

  return (
    <div className="space-y-4">
      <section aria-labelledby="mate-overview-totals" className="space-y-2">
        <h2 id="mate-overview-totals" className="text-base font-bold">{round}기 누적 합계</h2>
        <ActivitySummary label="회차 누적 합계" fields={[
          { label: "집계 회차", value: `${number.format(rows.length)}회` },
          { label: "참여", value: `${number.format(counts.joined)}명` },
          { label: "결과물", value: `${number.format(counts.submitted)}건` },
          { label: "총비용", value: formatMateWon(costs.total), emphasize: true },
        ]} />
      </section>

      <section aria-labelledby="mate-overview-detail" className="space-y-2">
        <h2 id="mate-overview-detail" className="text-base font-bold">회차별 비교</h2>
        <div role="region" aria-label="회차별 비교표 스크롤 영역" tabIndex={0} className={panel + " overflow-x-auto focus-visible:outline-2 focus-visible:outline-blue-800"}>
          <table aria-labelledby="mate-overview-detail" className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th scope="col" className="px-3 py-2.5 text-left">회차 / 제품</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left">공개 상태</th>
                {columnNames.map((label) => <th scope="col" key={label} className={cell}>{label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map(({ activity, progress: entry }) => {
                const responded = entry.joined + entry.declined;
                const expense = mateActivityCosts(activity, entry.joined);
                return <tr key={activity.activity_no}>
                  <th scope="row" className="min-w-48 px-3 py-2.5 text-left">
                    {archived ? <span>{activity.activity_no}회차 · {activity.product_name}</span> : <Link href={`${management}&activity=${activity.activity_no}`} className="font-semibold text-blue-900 underline-offset-2 hover:underline">
                      {activity.activity_no}회차 · {activity.product_name}
                    </Link>}
                  </th>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{mateActivityStatus(activity)}</td>
                  {[entry.eligible, entry.joined, entry.declined, entry.eligible - responded].map((value, index) => (
                    <td key={index} className={cell}>{number.format(value)}</td>
                  ))}
                  <td className={cell}>{rate(responded, entry.eligible)}</td>
                  <td className={cell}>{entry.submitted > 0 && !archived ? (
                    <Link href={`${results}&activity=${activity.activity_no}`} aria-label={`${activity.activity_no}회차 결과물 ${entry.submitted}건 보기`}
                      className="font-semibold text-emerald-800 underline underline-offset-2">{number.format(entry.submitted)}</Link>
                  ) : number.format(entry.submitted)}</td>
                  <td className={cell}>{rate(entry.submitted, entry.joined)}</td>
                  <td className={cell}>{formatMateWon(expense.products)}</td>
                  <td className={cell}>{formatMateWon(expense.shipping)}</td>
                  <td className={cell + " font-bold"}>{formatMateWon(expense.total)}</td>
                </tr>;
              })}
            </tbody>
            <tfoot className="border-t border-slate-300 bg-slate-200 font-semibold [&_td:last-child]:bg-blue-100 [&_td:last-child]:text-blue-950">
              <tr>
                <th scope="row" colSpan={2} className="px-3 py-2.5 text-left">회차 합계</th>
                {[number.format(counts.eligible), number.format(counts.joined), number.format(counts.declined),
                  number.format(counts.eligible - replied), rate(replied, counts.eligible), number.format(counts.submitted),
                  rate(counts.submitted, counts.joined), formatMateWon(costs.products), formatMateWon(costs.shipping), formatMateWon(costs.total)]
                  .map((value, index) => <td key={index} className={cell}>{value}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-xs leading-relaxed text-slate-600">
          대상은 선정 메이트 기준이며 인원은 회차별로 합산합니다. 제출률은 참여자 중 결과물을 제출한 비율입니다.
          제품비는 참여자에게 제공하는 제품 원가를 합산하고, 택배비는 회차당 참여자 1인 {formatMateWon(MATE_SHIPPING_COST)}을 적용합니다.
        </p>
      </section>
    </div>
  );
}
