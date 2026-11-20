import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import MateActivityImageField from "@/components/MateActivityImageField";
import MateActivityProductsField from "@/components/MateActivityProductsField";
import MateParticipantLink, { issuedMateParticipantPath } from "@/components/MateParticipantLink";
import MateResultMetricsEditor from "@/components/MateResultMetricsEditor";
import { isAdmin } from "@/lib/admin-auth";
import { MATE_GENDERS, MATE_STYLES, formatMateDateTime, formatMatePhone, formatMateShortDate, parseRound } from "@/lib/mate";
import { listMateActivities, listMateActivityProgress, listMateActivityResponses } from "@/lib/mate-activity-server";
import { formatMateWon, MATE_SHIPPING_COST, mateActivityCosts, mateActivityImageHref,
  mateInstagramResultUrl, type MateActivity, type MateActivityProgress } from "@/lib/mate-activities";
import { listMateApplications, listMateRounds } from "@/lib/mate-server";
import ActivitySummary from "./activity-summary";

const panel = "rounded-xl border border-slate-200 bg-white p-4 sm:p-6";
const button = "inline-flex min-h-11 items-center justify-center rounded-md bg-slate-900 px-4 py-2 font-bold text-white disabled:opacity-60";
const outline = "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 py-2 font-bold hover:bg-slate-50";
const pageSize = 25;

export type ActivitySearch = { round?: string; activity?: string; create?: string; page?: string };

type EmbeddedActivity = {
  activities: { data: MateActivity[] | null; error: unknown };
  progress: MateActivityProgress[];
  href: (activity: number, page?: number) => string;
};

export default async function ActivityManagement({ search, direct = false, embedded }: {
  search: ActivitySearch; direct?: boolean; embedded?: EmbeddedActivity;
}) {
  if (!embedded && !(await isAdmin())) redirect("/member/login?from=admin");
  const round = parseRound(search.round);
  if (!round) {
    if (direct) notFound();
    redirect("/admin/mate");
  }

  const [cohort, activities] = embedded
    ? [null, embedded.activities] as const
    : await Promise.all([listMateRounds(round, false), listMateActivities(round)]);
  if (cohort && !cohort.error && !cohort.data?.length) notFound();
  const list = activities.data ?? [];
  const requested = parseRound(search.activity);
  const namedActivity = list.find((activity) => activity.activity_no === requested);
  if (direct && !activities.error && !namedActivity) notFound();
  const item = namedActivity ?? list[0];
  const create = search.create === "1" || !item;
  const selected = create ? null : item;
  if (!embedded && !direct && !cohort?.error && !activities.error && selected) {
    redirect(`/admin/mate/activities/${round}/${selected.activity_no}`);
  }
  const page = typeof search.page === "string" && /^\d{1,6}$/.test(search.page) ? Math.max(1, Number(search.page)) : 1;
  const [roster, directProgress] = await Promise.all([
    selected ? listMateApplications(round, "selected", (page - 1) * pageSize, pageSize) : null,
    selected && !embedded ? listMateActivityProgress(round) : null,
  ]);
  const progress = (embedded?.progress ?? directProgress?.data)?.find((entry) => entry.activity_no === selected?.activity_no);
  const costs = selected && progress ? mateActivityCosts(selected, progress.joined) : null;
  const applicants = roster?.data ?? [];
  const answers = selected && roster && !roster.error ? await listMateActivityResponses(round, selected.activity_no, applicants.map((app) => app.id)) : null;
  const byApplicant = new Map((answers?.data ?? []).map((answer) => [answer.application_id, answer]));
  const responseGroups = [
    { label: "참여자", choice: "yes", color: "bg-emerald-50 text-emerald-900" },
    { label: "불참자", choice: "no", color: "bg-slate-100 text-slate-800" },
    { label: "미응답자", choice: undefined, color: "bg-amber-50 text-amber-900" },
  ].map((group) => ({ ...group, members: applicants.filter((app) => byApplicant.get(app.id)?.choice === group.choice) }));
  const responseColumns = ["이름", "SNS", "연락처", "성별", "피드 스타일", "참여 여부", "응답일", "결과물", "제출일", "개인 링크"];
  const base = `/admin/mate/activities?round=${round}`;
  function detailPath(activity: number, pageNumber?: number) {
    if (embedded) return embedded.href(activity, pageNumber);
    return `/admin/mate/activities/${round}/${activity}${pageNumber ? `?page=${pageNumber}` : ""}`;
  }
  const Container = embedded ? "div" : "main";

  return (
    <Container className={embedded ? "min-w-0 space-y-3 bg-slate-50 p-3 text-slate-900" : "w-full min-w-0 space-y-5 p-4 text-slate-900 sm:p-8"}>
      {!embedded && <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/admin/mate?round=${round}`} className="inline-flex min-h-11 items-center text-sm font-bold text-blue-800 underline">{round}기 지원자 목록</Link>
          <h1 className="text-2xl font-black">{round}기 {selected ? `${selected.activity_no}회차 관리` : "활동 회차 관리"}</h1>
        </div>
        <Link href={base + "&create=1"} className={button}>활동 회차 추가</Link>
      </header>}
      {cohort?.error || activities.error ? <p role="alert" className={panel}>회차 정보를 불러오지 못했습니다. 데이터베이스 연결 및 마이그레이션을 확인해 주세요.</p> : <>
        {!embedded && list.length > 0 && <nav aria-label="활동 회차" className="flex flex-wrap gap-2">
          {list.map((activity) => <Link key={activity.activity_no} href={detailPath(activity.activity_no)} scroll={!embedded} prefetch={embedded ? false : undefined}
            aria-current={selected?.activity_no === activity.activity_no ? "page" : undefined}
            className={selected?.activity_no === activity.activity_no ? button : outline}>
            {activity.activity_no}회차 · {activity.published ? "공개" : "비공개"}
          </Link>)}
        </nav>}
        <section className={panel}>
          <MateActivityProductsField key={selected?.activity_no ?? "new"} current={selected} round={round}
            inline={Boolean(embedded)} nextNumber={Math.min(999, (list[0]?.activity_no ?? 0) + 1)}>
            <MateActivityImageField key={selected?.product_image_version ?? "no-image"}
              current={selected?.product_image_version ? mateActivityImageHref(round, selected.activity_no, selected.product_image_version) : null} />
          </MateActivityProductsField>
        </section>
        {selected && <section className={panel}>
          <h2 className="text-lg font-black">{selected.activity_no}회차 응답 · 선정 메이트 {(roster?.count ?? 0).toLocaleString("ko-KR")}명</h2>
          <p className="mt-1 text-sm text-slate-600">활동 회차를 공개하면 선정 메이트 모두가 각자의 기존 링크에서 제품 정보와 응답란을 확인합니다.</p>
          {roster?.error || answers?.error ? <p role="alert" className="mt-4 text-sm text-red-700">응답을 불러오지 못했습니다.</p> : applicants.length ? (
            <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full min-w-[960px] border-collapse text-center text-sm [&_th]:border-r [&_th]:border-slate-200 [&_th]:px-2 [&_th]:align-middle [&_th]:last:border-r-0 [&_td]:border-r [&_td]:border-slate-200 [&_td]:px-2 [&_td]:align-middle [&_td]:last:border-r-0">
                <thead className="bg-slate-100">
                  <tr>{responseColumns.map((label) => <th key={label} scope="col" className="whitespace-nowrap px-2 py-1">{label}</th>)}</tr>
                </thead>
                {responseGroups.filter((group) => group.members.length > 0).map((group) => <tbody key={group.label} className="divide-y divide-slate-200">
                  <tr className={group.color}>
                    <th scope="rowgroup" colSpan={responseColumns.length} className="border-t border-slate-200 py-1 text-left font-bold">
                      {group.label} {group.members.length}명
                    </th>
                  </tr>
                  {group.members.map((app) => {
                    const answer = byApplicant.get(app.id);
                    const participantHref = issuedMateParticipantPath(app);
                    const result = answer?.result_instagram_url && mateInstagramResultUrl(answer.result_instagram_url);
                    return <tr key={app.id}>
                      <th scope="row" className="whitespace-nowrap px-3 py-1 font-bold">
                        {participantHref ? <a href={participantHref} target="_blank" rel="noreferrer" className="text-blue-800 underline underline-offset-2">{app.name}</a> : app.name}
                      </th>
                      <td className="whitespace-nowrap px-3 py-1">
                        <a href={`https://www.instagram.com/${encodeURIComponent(app.sns_id)}/`} target="_blank" rel="noreferrer" className="text-blue-800 underline underline-offset-2">@{app.sns_id}</a>
                      </td>
                      <td className="whitespace-nowrap px-4 py-1">{formatMatePhone(app.phone)}</td>
                      <td className="whitespace-nowrap px-4 py-1">{MATE_GENDERS[app.gender]}</td>
                      <td className="px-4 py-1">{app.feed_styles.map((style) => MATE_STYLES[style]).join(", ")}</td>
                      <td className="px-4 py-1">{answer?.choice === "yes" ? "참여" : answer?.choice === "no" ? "불참" : "응답 대기"}</td>
                      <td className="whitespace-nowrap py-1 tabular-nums">{answer?.updated_at
                        ? <time dateTime={answer.updated_at} title={formatMateDateTime(answer.updated_at)}>{formatMateShortDate(answer.updated_at)}</time> : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-1">{result && answer
                        ? <div className="flex flex-wrap items-center justify-center gap-x-1">
                          <a href={result} target="_blank" rel="noreferrer" className="text-blue-800 underline">인스타그램</a>
                          <MateResultMetricsEditor key={result} answer={{
                            round: answer.round, activity_no: answer.activity_no, application_id: answer.application_id,
                            result_instagram_url: answer.result_instagram_url, result_metrics: answer.result_metrics,
                          }} />
                        </div> : "—"}</td>
                      <td className="whitespace-nowrap py-1 tabular-nums">{answer?.result_submitted_at
                        ? <time dateTime={answer.result_submitted_at} title={formatMateDateTime(answer.result_submitted_at)}>{formatMateShortDate(answer.result_submitted_at)}</time> : "—"}</td>
                      <td className="px-3 py-1 [&>div]:justify-center [&_button]:md:min-h-7 [&_button]:md:px-2"><MateParticipantLink application={app} showOpenLink={false} /></td>
                    </tr>;
                  })}
                </tbody>)}
              </table>
            </div>
          ) : <p className="mt-4 text-sm">이 페이지에 지원자가 없습니다.</p>}
          {costs && progress && <div className="mt-3">
            <ActivitySummary label="회차 비용 합계" fields={[
              { label: "참여 인원", value: `${progress.joined.toLocaleString("ko-KR")}명` },
              { label: "제품비", value: formatMateWon(costs.products) },
              { label: <>택배비 <span className="whitespace-nowrap">(1인 {formatMateWon(MATE_SHIPPING_COST)})</span></>, value: formatMateWon(costs.shipping) },
              { label: "총비용", value: formatMateWon(costs.total), emphasize: true },
            ]} />
          </div>}
          {(page > 1 || page * pageSize < (roster?.count ?? 0)) && <nav aria-label="응답 목록 페이지" className="mt-4 flex items-center gap-3">
            {page > 1 && <Link className={outline} scroll={!embedded} prefetch={embedded ? false : undefined} href={detailPath(selected.activity_no, page - 1)}>이전</Link>}
            {page * pageSize < (roster?.count ?? 0) && <Link className={outline} scroll={!embedded} prefetch={embedded ? false : undefined} href={detailPath(selected.activity_no, page + 1)}>다음</Link>}
          </nav>}
        </section>}
      </>}
    </Container>
  );
}
