import Link from "next/link";
import MateDisclosureIcon from "@/components/MateDisclosureIcon";
import { Fragment, type ReactNode } from "react";
import { formatMateWon, mateActivityCosts, MATE_SHIPPING_COST, type MateActivity, type MateActivityProgress } from "@/lib/mate-activities";
import ActivitySummary from "./activity-summary";

const summaryLabels = ["대상", "참여", "불참", "미응답", "응답률", "결과물 제출", "제품비", "택배비", "총비용"];
const columns = ["회차 / 제품", "공개 상태", ...summaryLabels];
const number = new Intl.NumberFormat("ko-KR");
const percent = new Intl.NumberFormat("ko-KR", { style: "percent", maximumFractionDigits: 1 });
const cell = "whitespace-nowrap px-3 py-2 text-right tabular-nums";

function counts(progress?: MateActivityProgress) {
  if (!progress) return ["—", "—", "—", "—", "—", "—"];
  const { eligible, joined, declined, submitted } = progress;
  const responded = joined + declined;
  return [number.format(eligible), number.format(joined), number.format(declined), number.format(eligible - responded),
    eligible ? percent.format(responded / eligible) : "—", number.format(submitted)];
}

export default function MateActivityProgressTable({ activities, progress, opened, inlinePanel, href }: {
  activities: MateActivity[];
  progress: MateActivityProgress[];
  opened: number | "manage" | "new" | null;
  inlinePanel: ReactNode;
  href: (activity: number | null) => string;
}) {
  const rows = [...activities].sort((a, b) => a.activity_no - b.activity_no);
  const byActivity = new Map(progress.map((entry) => [entry.activity_no, entry]));
  const activityByNumber = new Map(activities.map((activity) => [activity.activity_no, activity]));
  const active = progress.flatMap((entry) => {
    const activity = activityByNumber.get(entry.activity_no);
    return activity && (entry.joined || entry.declined || activity.published) ? [{ entry, activity }] : [];
  });
  const total = active.reduce((sum, { entry }) => ({
    activity_no: 0, eligible: sum.eligible + entry.eligible, joined: sum.joined + entry.joined,
    declined: sum.declined + entry.declined, submitted: sum.submitted + entry.submitted,
  }), { activity_no: 0, eligible: 0, joined: 0, declined: 0, submitted: 0 });
  const costs = active.map(({ activity, entry }) => mateActivityCosts(activity, entry.joined));
  const totals = costs.reduce<{ products: number | null; shipping: number; total: number | null }>((sum, cost) => ({
    products: sum.products === null || cost.products === null ? null : sum.products + cost.products,
    shipping: sum.shipping + cost.shipping,
    total: sum.total === null || cost.total === null ? null : sum.total + cost.total,
  }), { products: 0, shipping: 0, total: 0 });
  const summary = [...counts(active.length ? total : undefined),
    ...(active.length ? [totals.products, totals.shipping, totals.total].map(formatMateWon) : ["—", "—", "—"])];

  if (!rows.length) return <p className="mt-1 text-sm text-slate-600">등록된 활동 회차가 없습니다.</p>;
  return (
    <div className="mt-2 overflow-hidden rounded-md border border-slate-200">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[1040px] text-left text-sm" aria-label="회차별 누적 진행표">
        <thead className="bg-slate-100">
          <tr>{columns.map((title, index) => (
            <th key={title} scope="col" className={index > 1 ? cell : "whitespace-nowrap px-3 py-2 text-left"}>{title}</th>
          ))}</tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((activity) => {
            const expanded = opened === activity.activity_no;
            const aggregate = byActivity.get(activity.activity_no);
            const showCounts = activity.published || Boolean(aggregate && (aggregate.joined || aggregate.declined));
            const cost = showCounts && aggregate ? mateActivityCosts(activity, aggregate.joined) : null;
            return (
              <Fragment key={activity.activity_no}>
                <tr>
                  <th scope="row" className="px-3 py-1 text-left">
                    <Link href={href(expanded ? null : activity.activity_no)} scroll={false} prefetch={false}
                      aria-expanded={expanded} className="inline-flex min-h-9 items-center gap-2 font-bold text-blue-800">
                      <MateDisclosureIcon open={expanded} />
                      <span className="underline underline-offset-2">{activity.activity_no}회차 · {activity.product_name}</span>
                    </Link>
                  </th>
                  <td className="whitespace-nowrap px-3 py-2">{activity.published ? "공개 중" : "비공개"}</td>
                  {counts(showCounts ? aggregate : undefined).map((value, i) => <td key={i} className={cell}>{value}</td>)}
                  {(cost ? [cost.products, cost.shipping, cost.total].map(formatMateWon) : ["—", "—", "—"])
                    .map((value, i) => <td key={i} className={cell}>{value}</td>)}
                </tr>
                {expanded && <tr><td colSpan={columns.length} className="bg-slate-50 p-1">{inlinePanel}</td></tr>}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      </div>
      <section className="border-t border-slate-200 bg-slate-50 px-3 py-3" aria-label="회차 누적 합계">
        <h3 className="mb-2 text-sm font-bold">누적 합계 · 회차 기준</h3>
        <ActivitySummary label="누적 합계 상세" fields={summaryLabels.map((label, index) => ({
          label, value: summary[index], emphasize: label === "총비용",
        }))} />
        <p className="mt-2 text-xs text-slate-600">회차별 제품비는 제품 원가 합계에 참여 인원을 곱하고, 택배비는 참여자 1인당 {formatMateWon(MATE_SHIPPING_COST)}을 적용합니다.</p>
      </section>
    </div>
  );
}
