import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import MateResultComment from "@/components/MateResultComment";
import MateStarRating from "@/components/MateStarRating";
import { isAdmin } from "@/lib/admin-auth";
import { listMateActivities, listMateSubmittedResults } from "@/lib/mate-activity-server";
import { mateInstagramResultUrl } from "@/lib/mate-activities";
import { listMateComments, listMateRatings } from "@/lib/mate-rating-server";
import { mateRatingKey } from "@/lib/mate-ratings";
import { formatMateDateTime, formatMateShortDate, parseRound } from "@/lib/mate";
import { listMateRounds, localMatePreview } from "@/lib/mate-server";

const path = "/admin/mate/results";
const pageSize = 24;
const control = "inline-flex min-h-11 items-center rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-[#24332d]";

export const metadata: Metadata = {
  title: "워크업 메이트 콘텐츠 취합",
  robots: { index: false, follow: false },
};

function InstagramPost({ url, title }: { url: string; title: string }) {
  const permalink = mateInstagramResultUrl(url);
  const media = permalink && new URL(permalink).pathname.match(/^\/(p|reels?|tv)\/([\w-]+)\/?$/);
  if (!media) return <p className="border-t border-stone-200 p-4 text-sm text-stone-600">이 형식은 취합 화면에서 표시할 수 없습니다.</p>;

  const type = media[1] === "reels" ? "reel" : media[1];
  return <iframe
    title={title}
    src={`https://www.instagram.com/${type}/${media[2]}/embed/`}
    loading="lazy"
    referrerPolicy="no-referrer"
    allowFullScreen
    className="block h-[30rem] w-full border-t border-stone-200 bg-white sm:h-[34rem]"
  />;
}

export default async function MateResultsPage({ searchParams }: {
  searchParams: Promise<{ round?: string; activity?: string; page?: string }>;
}) {
  if (!(await isAdmin())) redirect("/member/login?from=admin");

  const search = await searchParams;
  const rounds = await listMateRounds(null, false);
  const requested = parseRound(search.round);
  const selected = rounds.data?.find((round) => round.round === requested) ?? rounds.data?.[0];
  const activity = parseRound(search.activity);
  const page = typeof search.page === "string" && /^[1-9][0-9]{0,5}$/.test(search.page) ? Number(search.page) : 1;
  const [activities, results, ratings, comments] = selected ? await Promise.all([
    listMateActivities(selected.round),
    listMateSubmittedResults(selected.round, activity, (page - 1) * pageSize, pageSize),
    listMateRatings(selected.round),
    listMateComments(selected.round),
  ]) : [null, null, null, null];
  const scores = new Map((ratings?.data ?? []).map((rating) => [mateRatingKey(rating.activity_no, rating.application_id), rating.score]));
  const commentTexts = new Map((comments?.data ?? []).map((item) => [mateRatingKey(item.activity_no, item.application_id), item.comment]));
  const total = results?.count ?? 0;
  const loadFailed = Boolean(rounds.error || activities?.error || results?.error);
  const activityNames = new Map(activities?.data?.map((item) => [item.activity_no, item.product_name]));
  const submissions = results?.data ?? [];
  const submissionsByActivity = new Map<number, typeof submissions>();
  for (const submission of submissions) {
    const group = submissionsByActivity.get(submission.activity_no);
    if (group) group.push(submission);
    else submissionsByActivity.set(submission.activity_no, [submission]);
  }
  const backHref = selected ? `/admin/mate?round=${selected.round}` : "/admin/mate";

  function pageHref(next: number) {
    const query = new URLSearchParams({ round: String(selected?.round), page: String(next) });
    if (activity !== null) query.set("activity", String(activity));
    return `${path}?${query}`;
  }

  return (
    <main className="min-h-[calc(100vh-3rem)] w-full min-w-0 bg-[#f5f4ef] text-[#24332d]">
      <header className="border-b-4 border-[#bda06e] bg-[#1b2b26] text-[#fcfaf4]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-7 sm:px-8 sm:py-9">
          <h1 className="text-2xl font-black tracking-tight sm:text-4xl">워크업 메이트 콘텐츠 취합</h1>
          <Link href={backHref} className="inline-flex min-h-11 items-center rounded-md border border-[#637369] px-3 text-sm font-semibold hover:bg-white/10">메이트 관리</Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-4 px-5 py-5 sm:px-8">
        {loadFailed ? <p role="alert" className="rounded-lg bg-white p-5 text-red-800">콘텐츠 제출 목록을 불러오지 못했습니다.</p> : !selected ? (
          <p className="rounded-lg bg-white p-5">등록된 기수가 없습니다.</p>
        ) : <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{selected.round}기 제출 콘텐츠 <span className="tabular-nums">{total.toLocaleString("ko-KR")}건</span></h2>
            <form action={path} className="flex flex-wrap items-center gap-2">
              <select name="round" aria-label="기수" className={control} defaultValue={selected.round}>
                {rounds.data?.map((round) => <option key={round.round} value={round.round}>{round.round}기</option>)}
              </select>
              <select name="activity" aria-label="활동 회차" className={control} defaultValue={activity ?? ""}>
                <option value="">회차 전체</option>
                {activities?.data?.map((item) => <option key={item.activity_no} value={item.activity_no}>{item.activity_no}회차</option>)}
              </select>
              <button className={control + " hover:bg-stone-100"}>보기</button>
            </form>
          </div>
          {Boolean(ratings?.error) && <p role="alert" className="rounded-lg bg-white p-4 text-sm text-red-800">평가결과를 불러오지 못했습니다. 평가결과 SQL 적용 상태를 확인해 주세요.</p>}
          {Boolean(comments?.error) && <p role="alert" className="rounded-lg bg-white p-4 text-sm text-red-800">코멘트를 불러오지 못했습니다. 코멘트 SQL 적용 상태를 확인해 주세요.</p>}
          {!results?.data?.length ? (
            <p className="rounded-lg border border-stone-200 bg-white p-5">{page > 1 ? "이 페이지에는 제출물이 없습니다." : "제출된 인스타그램 링크가 없습니다."}</p>
          ) : [...submissionsByActivity].map(([activityNo, posts]) => (
            <section key={activityNo} aria-labelledby={activity === null ? `report-activity-${activityNo}` : undefined}>
              {activity === null && <h3 id={`report-activity-${activityNo}`} className="mb-3 border-b border-stone-300 pb-2 text-lg font-black">
                {activityNo}회차 <span className="font-semibold text-[#52665b]">· {activityNames.get(activityNo) ?? "제품명 미등록"}</span>
              </h3>}
              <ul className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
              {posts.map((row) => {
                const demo = localMatePreview && /^mate\.demo\.\d{2}$/.test(row.creator.sns_id);
                return <li key={`${row.activity_no}:${row.application_id}`} className="min-w-0 overflow-hidden rounded-lg border border-stone-200 bg-white">
                  <div className="space-y-1 px-4 py-3">
                    {activity !== null && <h3 className="break-words font-bold">{row.activity_no}회차 · {activityNames.get(row.activity_no) ?? "제품명 미등록"}</h3>}
                    {demo && <p className="text-xs font-bold text-[#52665b]">테스트 제출</p>}
                    <p className="break-words text-sm font-semibold">{row.creator.name} <span className="font-normal text-[#52665b]">@{row.creator.sns_id}</span></p>
                    <p className="text-sm text-[#52665b]">
                      응답 <time dateTime={row.response_updated_at} title={formatMateDateTime(row.response_updated_at)}>{formatMateShortDate(row.response_updated_at)}</time>
                      {" · 제출 "}<time dateTime={row.result_submitted_at} title={formatMateDateTime(row.result_submitted_at)}>{formatMateShortDate(row.result_submitted_at)}</time>
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {!ratings?.error && <MateStarRating round={selected.round} activity={row.activity_no} applicationId={row.application_id}
                        name={row.creator.name} score={scores.get(mateRatingKey(row.activity_no, row.application_id)) ?? null} />}
                      {!comments?.error && <MateResultComment round={selected.round} activity={row.activity_no} applicationId={row.application_id}
                        name={row.creator.name} comment={commentTexts.get(mateRatingKey(row.activity_no, row.application_id)) ?? ""} />}
                    </div>
                  </div>
                  <InstagramPost url={row.result_instagram_url} title={`${row.creator.name} ${row.activity_no}회차 제출 게시물`} />
                </li>;
              })}
              </ul>
            </section>
          ))}
          {(page > 1 || total > pageSize) && <nav aria-label="제출 콘텐츠 페이지" className="flex items-center gap-3 text-sm">
            {page > 1 && <Link href={pageHref(page - 1)} className={control}>이전</Link>}
            <span>{page} 페이지</span>
            {page * pageSize < total && <Link href={pageHref(page + 1)} className={control}>다음</Link>}
          </nav>}
        </>}
      </div>
    </main>
  );
}
