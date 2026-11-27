import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import MateFeedStyleIcon from "@/components/MateFeedStyleIcon";
import MateResultComment from "@/components/MateResultComment";
import MateStarRating from "@/components/MateStarRating";
import MateActionForm from "@/components/MateActionForm";
import MateActivityImageField from "@/components/MateActivityImageField";
import MateActivityProductsField from "@/components/MateActivityProductsField";
import { issuedMateParticipantPath } from "@/components/MateParticipantLink";
import { isAdmin } from "@/lib/admin-auth";
import { MATE_GENDERS, MATE_STYLES, formatMateDateTime, formatMatePhone, formatMateShortDate, parseRound } from "@/lib/mate";
import { listMateActivities, listMateActivityProgress, listMateActivityResponses } from "@/lib/mate-activity-server";
import { formatMateWon, MATE_SHIPPING_COST, mateActivityCosts, mateActivityStatus,
  mateInstagramResultUrl, mateResponseProducts, type MateActivity, type MateActivityProgress } from "@/lib/mate-activities";
import { listMateApplications, listMateRounds } from "@/lib/mate-server";
import { listMateComments, listMateRatings } from "@/lib/mate-rating-server";
import { mateRatingKey } from "@/lib/mate-ratings";
import ActivitySummary from "./activity-summary";
import { changeMateActivityClosure } from "./actions";

const panel = "min-w-0 py-3";
const button = "inline-flex min-h-11 items-center justify-center rounded-md bg-slate-900 px-4 py-2 font-bold text-white disabled:opacity-60";
const outline = "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 py-2 font-bold hover:bg-slate-50";
const pageSize = 25;

export type ActivitySearch = { round?: string; activity?: string; create?: string; page?: string };

type EmbeddedActivity = {
  activities: { data: MateActivity[] | null; error: unknown };
  progress: MateActivityProgress[];
  ratings: Awaited<ReturnType<typeof listMateRatings>> | null;
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
  const responseColumns = ["이름", "SNS", "연락처", "성별", "제품명 / 사이즈", "응답일", "결과물", "평가결과", "제출일"];
  const ratings = embedded ? embedded.ratings : selected ? await listMateRatings(round) : null;
  const scores = new Map((ratings?.data ?? []).map((rating) => [mateRatingKey(rating.activity_no, rating.application_id), rating.score]));
  const comments = selected ? await listMateComments(round) : null;
  const commentTexts = new Map((comments?.data ?? []).map((item) => [mateRatingKey(item.activity_no, item.application_id), item.comment]));
  const base = `/admin/mate/activities?round=${round}`;
  function detailPath(activity: number, pageNumber?: number) {
    if (embedded) return embedded.href(activity, pageNumber);
    return `/admin/mate/activities/${round}/${activity}${pageNumber ? `?page=${pageNumber}` : ""}`;
  }
  const Container = embedded ? "div" : "main";
  const settingsForm = (
    <MateActivityProductsField key={selected?.activity_no ?? "new"} current={selected} round={round}
      inline={Boolean(embedded)} nextNumber={Math.min(999, (list[0]?.activity_no ?? 0) + 1)}>
      <MateActivityImageField key={selected?.product_image_version ?? "no-image"}
        hasImage={Boolean(selected?.product_image_version)} />
    </MateActivityProductsField>
  );

  return (
    <Container className={embedded ? "min-w-0 space-y-3 text-slate-900" : "w-full min-w-0 space-y-5 p-4 text-slate-900"}>
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
            {activity.activity_no}회차 · {mateActivityStatus(activity)}
          </Link>)}
        </nav>}
        {selected ? (
          <details key={selected.activity_no} className="group min-w-0 border-y border-slate-200">
            <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 font-bold hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              {embedded ? <span className="flex flex-wrap items-center gap-2 text-sm">
                {selected.product_name}
                <span className={`rounded px-2 py-0.5 text-xs ${selected.published && !selected.closed_at
                  ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{mateActivityStatus(selected)}</span>
              </span> : <span>{selected.activity_no}회차 설정</span>}
              <span className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
                {embedded && progress && <span className="text-xs font-normal text-slate-700 tabular-nums">
                  참여 <strong>{progress.joined}명</strong> · 미응답 <strong>{progress.eligible - progress.joined - progress.declined}명</strong> · 결과물 제출 <strong>{progress.submitted}건</strong>
                </span>}
                <span className="flex items-center gap-1 text-sm text-slate-600">
                  {embedded && "설정"}
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"
                    className="size-4 group-open:rotate-180">
                    <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </span>
            </summary>
            <div className="border-t border-slate-200 pb-4 pt-3">{settingsForm}</div>
          </details>
        ) : <section className={panel}>{settingsForm}</section>}
        {selected && <section className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-lg font-black">응답 · 선정 메이트 {(roster?.count ?? 0).toLocaleString("ko-KR")}명</h2>
              {selected.closed_at && <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                종료 <time dateTime={selected.closed_at} title={formatMateDateTime(selected.closed_at)}>{formatMateShortDate(selected.closed_at)}</time>
              </span>}
              <ul aria-label="피드 스타일 아이콘" className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                {(Object.keys(MATE_STYLES) as (keyof typeof MATE_STYLES)[]).map((style) => (
                  <li key={style} className="inline-flex items-center gap-1">
                    <span aria-hidden="true"><MateFeedStyleIcon style={style} /></span>{MATE_STYLES[style]}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!!(progress?.joined ?? responseGroups[0].members.length) && <a
                href={`/api/admin/mate/invoice?round=${round}&activity=${selected.activity_no}`}
                className="inline-flex min-h-9 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-900 hover:bg-emerald-100">송장 다운로드</a>}
              <MateActionForm action={changeMateActivityClosure} className="flex flex-wrap items-center gap-2"
                buttonClassName={selected.closed_at
                  ? "min-h-9 rounded-md border border-slate-300 px-3 text-sm font-bold hover:bg-slate-100"
                  : "min-h-9 rounded-md border border-amber-300 bg-amber-50 px-3 text-sm font-bold text-amber-900 hover:bg-amber-100"}
                submitLabel={selected.closed_at ? "마감 해제" : "회차 종료"}>
                <input type="hidden" name="round" value={round} />
                <input type="hidden" name="activity_no" value={selected.activity_no} />
                <input type="hidden" name="mode" value={selected.closed_at ? "open" : "close"} />
              </MateActionForm>
            </div>
          </div>
          {Boolean(ratings?.error) && <p role="alert" className="mt-2 text-sm text-red-700">평가결과를 불러오지 못했습니다. 평가결과 SQL 적용 상태를 확인해 주세요.</p>}
          {Boolean(comments?.error) && <p role="alert" className="mt-2 text-sm text-red-700">코멘트를 불러오지 못했습니다. 코멘트 SQL 적용 상태를 확인해 주세요.</p>}
          {roster?.error || answers?.error ? <p role="alert" className="mt-4 text-sm text-red-700">응답을 불러오지 못했습니다.</p> : applicants.length ? (
            <div role="region" aria-label="메이트 응답표 스크롤 영역" tabIndex={0} className="mt-4 overflow-x-auto border border-slate-200 bg-white focus-visible:outline-2 focus-visible:outline-blue-800">
              <table className="w-full min-w-[960px] border-collapse text-center text-sm [&_th]:border-r [&_th]:border-slate-200 [&_th]:px-2 [&_th]:align-middle [&_th]:last:border-r-0 [&_td]:border-r [&_td]:border-slate-200 [&_td]:px-2 [&_td]:align-middle [&_td]:last:border-r-0">
                <thead className="bg-slate-100">
                  <tr>{responseColumns.map((label) => <th key={label} scope="col" className={`whitespace-nowrap px-2 py-1${label === "평가결과" ? " w-px" : ""}`}>{label}</th>)}</tr>
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
                    const products = mateResponseProducts(selected.product_name, answer);
                    return <tr key={app.id}>
                      <th scope="row" className="whitespace-nowrap px-3 py-1 font-bold">
                        <span className="inline-flex items-center gap-1.5">
                          {app.feed_styles.map((style) => <MateFeedStyleIcon key={style} style={style} />)}
                          {participantHref ? <a href={participantHref} target="_blank" rel="noreferrer" className="text-blue-800 underline underline-offset-2">{app.name}</a> : app.name}
                        </span>
                      </th>
                      <td className="whitespace-nowrap px-3 py-1">
                        <a href={`https://www.instagram.com/${encodeURIComponent(app.sns_id)}/`} target="_blank" rel="noreferrer" className="text-blue-800 underline underline-offset-2">@{app.sns_id}</a>
                      </td>
                      <td className="whitespace-nowrap px-4 py-1">{formatMatePhone(app.phone)}</td>
                      <td className="whitespace-nowrap px-4 py-1">{MATE_GENDERS[app.gender]}</td>
                      <td className="px-4 py-1">{products.length ? <ul className="space-y-0.5">
                        {products.map((product, index) => <li key={index} className="break-keep">
                          {product.name} <span className="whitespace-nowrap font-semibold text-slate-600">· {product.size || "미입력"}</span>
                        </li>)}
                      </ul> : "—"}</td>
                      <td className="whitespace-nowrap py-1 tabular-nums">{answer?.updated_at
                        ? <time dateTime={answer.updated_at} title={formatMateDateTime(answer.updated_at)}>{formatMateShortDate(answer.updated_at)}</time> : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-1">{result
                        ? <a href={result} target="_blank" rel="noreferrer" className="text-blue-800 underline">인스타그램</a> : "—"}</td>
                      <td className="whitespace-nowrap py-1">{result && (!ratings?.error || !comments?.error)
                        ? <span className="inline-flex items-center gap-2">
                          {!ratings?.error && <MateStarRating round={round} activity={selected.activity_no} applicationId={app.id} name={app.name}
                            score={scores.get(mateRatingKey(selected.activity_no, app.id)) ?? null} />}
                          {!comments?.error && <MateResultComment round={round} activity={selected.activity_no} applicationId={app.id} name={app.name}
                            comment={commentTexts.get(mateRatingKey(selected.activity_no, app.id)) ?? ""} />}
                        </span> : "—"}</td>
                      <td className="whitespace-nowrap py-1 tabular-nums">{answer?.result_submitted_at
                        ? <time dateTime={answer.result_submitted_at} title={formatMateDateTime(answer.result_submitted_at)}>{formatMateShortDate(answer.result_submitted_at)}</time> : "—"}</td>                    </tr>;
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
