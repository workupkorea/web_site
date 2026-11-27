import type { Metadata } from "next";
import Link from "next/link";
import MateApplicantsTable from "@/components/MateApplicantsTable";
import { redirect } from "next/navigation";
import MateActionForm from "@/components/MateActionForm";
import MateParticipantLink from "@/components/MateParticipantLink";
import MateCohortSelect from "@/components/MateCohortSelect";
import MateFilterForm from "@/components/MateFilterForm";
import MateFeedStyleIcon from "@/components/MateFeedStyleIcon";
import { getAdminMember, SUPER_ADMIN_GRADE } from "@/lib/admin-auth";
import MarketingTabs from "../analytics/_tabs/MarketingTabs";
import { MATE_APPLICATION_GENDERS, MATE_COHORT_STAGES, MATE_GENDERS, MATE_REGION_PREFIXES, MATE_STATUSES, MATE_STYLES, formatMateDate, formatMatePhone, mateAddressRegion, mateCohortStage, mateRoundStatus, parseRound, seoulDate, type MateApplication, type MateApplicationFilters, type MateCohortStage, type MateRound } from "@/lib/mate";
import { listMateApplications, listMateRounds } from "@/lib/mate-server";
import { saveMateRound, updateMateApplication } from "./actions";
import { listMateActivities, listMateActivityCohorts, listMateActivityProgress } from "@/lib/mate-activity-server";
import { type MateActivity, type MateActivityProgress } from "@/lib/mate-activities";
import ActivityManagement from "./activities/activity-management";
import ActivityStatistics from "./activities/activity-statistics";
import MateScoreSummary from "./activities/mate-score-summary";
import { listMateRatings, listMateResultRecords } from "@/lib/mate-rating-server";
import { mateResultRatings } from "@/lib/mate-ratings";

export const metadata: Metadata = { title: "워크업 메이트 관리", robots: { index: false, follow: false } };

const inputClass = "min-h-11 min-w-0 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal";
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-md bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700 disabled:opacity-60";
const outlineClass = "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold hover:bg-slate-50";
const panel = "min-w-0 py-3";
const filterClass = "min-h-11 max-w-48 rounded-md border border-slate-300 bg-white px-2 text-sm md:min-h-9";
const pageSize = 25;
const scoreRosterLimit = 1000;
const submittedTime = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" });

function NewTabIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" className="ml-1.5 size-4">
    <path d="M13 4h7v7m0-7-9 9m6 0v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h6" />
  </svg>;
}

function RoundForm({ round, create = false }: { round?: MateRound; create?: boolean }) {
  const dates = [
    ["starts_on", "모집 시작일", round?.starts_on],
    ["ends_on", "모집 종료일", round?.ends_on],
    ["announces_on", "최종 발표일", round?.announces_on],
    ["retain_through", "활동 종료일", round?.retain_through],
  ] as const;
  const quotas = [
    ["outdoor_quota", "outdoor", round?.outdoor_quota],
    ["work_quota", "work", round?.work_quota],
    ["lifestyle_quota", "lifestyle", round?.lifestyle_quota],
  ] as const;
  const fieldGroup = "min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 pb-3";
  const groupTitle = "px-1.5 text-sm font-bold text-slate-800";
  return (
    <MateActionForm action={saveMateRound} className="mt-4 grid gap-3"
      buttonClassName={buttonClass + " min-w-32"}
      submitLabel={create ? "기수 추가" : "모집 설정 저장"}
      submitLeading={<label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="published" value="yes" defaultChecked={round?.published} />모집 페이지 공개
      </label>}>
      <input type="hidden" name="mode" value={create ? "create" : "edit"} />
      {!create && <input type="hidden" name="round" value={round?.round} />}
      <fieldset className={fieldGroup}>
        <legend className={groupTitle}>활동 및 모집 일정</legend>
        <div className="grid gap-3 pt-2 sm:grid-cols-2 xl:grid-cols-6">
          {create && <label className="grid max-w-32 gap-1 text-sm font-semibold">기수
            <input className={inputClass} name="round" type="number" min={1} max={999} step={1} required />
          </label>}
          <label className={`grid min-w-0 gap-1 text-sm font-semibold ${create ? "" : "sm:col-span-2"}`}>활동 기간
            <input className={inputClass} name="activity_period" defaultValue={round?.activity_period} maxLength={120} required />
          </label>
          {dates.map(([name, label, value]) => (
            <label key={name} className="grid min-w-0 gap-1 text-sm font-semibold">{label}
              <input className={inputClass} type="date" name={name} defaultValue={value ?? ""}
                aria-describedby={name === "retain_through" ? "mate-activity-end-help" : undefined} />
            </label>
          ))}
        </div>
        <span id="mate-activity-end-help" className="sr-only">활동 종료일은 선정 메이트의 개인 링크와 개인정보 보유 종료일에 적용됩니다.</span>
      </fieldset>
      <fieldset className={fieldGroup}>
        <legend className={groupTitle}>피드 스타일별 모집 인원</legend>
        <div className="grid divide-y divide-slate-200 pt-2 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {quotas.map(([name, style, value]) => (
            <label className="flex min-w-0 items-center gap-3 px-2 py-2 text-sm font-semibold lg:justify-center lg:px-3 lg:py-0" key={name}>
              <span className="flex min-w-0 items-center gap-1.5">
                <span aria-hidden="true"><MateFeedStyleIcon style={style} /></span>
                {MATE_STYLES[style]}
              </span>
              <input type="number" name={name} min={0} max={9999} className="ml-auto min-h-10 w-20 shrink-0 rounded-md border border-slate-300 bg-white px-2 text-center font-normal min-[375px]:w-28 lg:ml-0 lg:w-24 xl:w-36" defaultValue={value ?? ""} placeholder="미정" />
            </label>
          ))}
        </div>
      </fieldset>
    </MateActionForm>
  );
}

function ApplicantDetail({ opened }: { opened: MateApplication }) {
  const sections = [
    [["피드 스타일", opened.feed_styles.map((key) => MATE_STYLES[key]).join(", ")],
      ["성별", MATE_GENDERS[opened.gender]], ["연락처", formatMatePhone(opened.phone)], ["키", `${opened.height_cm} cm`]],
    [["접수 일시 (KST)", submittedTime.format(new Date(opened.submitted_at))],
      ["보유 종료일", formatMateDate(opened.retain_through)], ["주소", opened.address], ["하고 싶은 말", opened.message || "—"]],
  ];

  return (
    <section className="rounded-md border border-slate-200 bg-white p-2.5 sm:p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold">{opened.name} 지원서 <span className="ml-1 text-sm font-medium text-slate-600">· {MATE_STATUSES[opened.status]}</span></h3>
        <div className="flex flex-wrap items-center gap-2">
          <MateActionForm key={opened.id} action={updateMateApplication} className="flex flex-wrap items-center gap-2"
            buttonClassName="min-h-9 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-60" submitLabel="상태 저장">
            <input type="hidden" name="round" value={opened.round} />
            <input type="hidden" name="id" value={opened.id} />
            <label className="flex items-center gap-2 text-sm font-semibold">심사 상태
              <select name="status" className="min-h-9 rounded-md border border-slate-300 bg-white px-2 font-normal" defaultValue={opened.status}>
                {Object.entries(MATE_STATUSES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
          </MateActionForm>
        </div>
      </div>
      <div className="grid overflow-hidden rounded-md border border-slate-200 md:grid-cols-[minmax(220px,2fr)_3fr] md:divide-x md:divide-slate-200">
        {sections.map((section, index) => (
          <table key={index} className="h-full w-full text-left text-sm" aria-label={index === 0 ? "지원서 기본 정보" : "지원서 주소와 기록"}>
            <tbody className="divide-y divide-slate-200">
              {section.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row" className="w-32 whitespace-nowrap bg-slate-50 px-2.5 py-1.5 font-semibold">{label}</th>
                  <td className="whitespace-pre-wrap break-words px-2.5 py-1.5">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </section>
  );
}

export default async function AdminMatePage({ searchParams }: {
  searchParams: Promise<{ round?: string; stage?: string; status?: string; feed?: string; gender?: string; region?: string; page?: string; create?: string; activity?: string; activityPage?: string }>;
}) {
  const admin = await getAdminMember();
  if (!admin) redirect("/member/login?from=admin");
  const search = await searchParams;
  const [{ data, error }, activityCohorts] = await Promise.all([listMateRounds(null, false), listMateActivityCohorts()]);
  const rounds = data ?? [];
  const requested = parseRound(search.round);
  const today = seoulDate();
  const stageFor = (round: MateRound) => mateCohortStage(round, activityCohorts.data.has(round.round), today);
  const requestedRound = rounds.find((round) => round.round === requested);
  const explicitStage = typeof search.stage === "string" && Object.hasOwn(MATE_COHORT_STAGES, search.stage)
    ? search.stage as MateCohortStage : null;
  const stage = requestedRound ? stageFor(requestedRound) : explicitStage ?? (rounds[0] ? stageFor(rounds[0]) : "recruitment");
  const visibleRounds = rounds.filter((round) => stageFor(round) === stage);
  const selected = requestedRound ?? visibleRounds[0];
  const creating = search.create === "1" || (!rounds.length && !explicitStage);
  const status = typeof search.status === "string" && Object.hasOwn(MATE_STATUSES, search.status) ? search.status : "";
  const feed = typeof search.feed === "string" && Object.hasOwn(MATE_STYLES, search.feed) ? search.feed as MateApplicationFilters["feed"] : undefined;
  const gender = typeof search.gender === "string" && Object.hasOwn(MATE_APPLICATION_GENDERS, search.gender) ? search.gender as MateApplicationFilters["gender"] : undefined;
  const region = typeof search.region === "string" && Object.hasOwn(MATE_REGION_PREFIXES, search.region) ? search.region as MateApplicationFilters["region"] : undefined;
  const page = typeof search.page === "string" && /^\d{1,6}$/.test(search.page) ? Math.max(1, Number(search.page)) : 1;

  let activityList: Awaited<ReturnType<typeof listMateActivities>> = { data: [] as MateActivity[], error: null };
  let activityProgress = { data: [] as MateActivityProgress[] | null, error: false };
  let applications: MateApplication[] = [];
  let count = 0;
  let listFailed = false;
  let ratings: Awaited<ReturnType<typeof listMateRatings>> | null = null;
  let mates: MateApplication[] | null = null;
  let resultRecords: Awaited<ReturnType<typeof listMateResultRecords>> | null = null;
  if (!creating && selected && stage === "recruitment") {
    const result = await listMateApplications(selected.round, status, (page - 1) * pageSize, pageSize, { feed, gender, region });
    applications = result.data ?? [];
    count = result.count ?? 0;
    listFailed = Boolean(result.error);
  } else if (!creating && selected) {
    const [activities, progress] = await Promise.all([
      listMateActivities(selected.round),
      listMateActivityProgress(selected.round),
    ]);
    activityList = activities;
    activityProgress = { data: progress.data, error: Boolean(progress.error) };
    if (stage === "operations") {
      const [scores, roster] = await Promise.all([
        listMateRatings(selected.round),
        listMateApplications(selected.round, "selected", 0, scoreRosterLimit),
      ]);
      ratings = scores;
      mates = roster.error ? null : roster.data;
    } else if (stage === "ended") {
      resultRecords = await listMateResultRecords(selected.round);
    }
  }

  const activities = activityList.data ?? [];
  const requestedActivity = parseRound(search.activity);
  const latestActivity = activities.find((activity) => activity.published && !activity.closed_at) ?? activities[0];
  const currentActivity = activities.find((activity) => activity.activity_no === requestedActivity) ?? latestActivity;
  const openedActivity = stage !== "operations" || creating ? null
    : search.activity === "new" ? "new" : currentActivity?.activity_no ?? null;

  function overviewHref(pageNumber: number, activity: number | "new" | null = null, activityPage?: string) {
    const query = new URLSearchParams({ round: String(selected.round), stage });
    if (pageNumber > 1 || search.page !== undefined) query.set("page", String(pageNumber));
    if (status || Object.hasOwn(search, "status")) query.set("status", status);
    if (feed) query.set("feed", feed);
    if (gender) query.set("gender", gender);
    if (region) query.set("region", region);
    if (activity) {
      query.set("activity", String(activity));
      if (activityPage) query.set("activityPage", activityPage);
    }
    return `/admin/mate?${query}`;
  }

  const applicantsTitle = selected ? `${selected.round}기 지원자${listFailed ? "" : ` ${count.toLocaleString("ko-KR")}명`}` : "";
  const cohortSelector = (
    <MateCohortSelect key={selected?.round} value={selected?.round} stage={stage}
      options={visibleRounds.map((round) => ({ value: round.round, label: `${round.round}기 · ${stage === "recruitment" ? mateRoundStatus(round, today) : MATE_COHORT_STAGES[stage]}` }))} />
  );
  const toolbarButton = "inline-flex min-h-9 items-center rounded-md border px-3 text-sm font-bold";
  const secondaryButton = toolbarButton + " border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100";
  const primaryButton = toolbarButton + " border-blue-800 bg-blue-800 text-white hover:bg-blue-900";
  const contentButton = toolbarButton + " border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100";
  const recruitmentHref = selected && stage === "recruitment"
    ? `/admin/mate?stage=recruitment&round=${selected.round}` : "/admin/mate?stage=recruitment";
  const newCohort = <Link href={`${recruitmentHref}&create=1`} className={primaryButton}>새 기수 등록</Link>;
  const inlinePanel = openedActivity !== null && selected ? (
    <ActivityManagement
      search={{ round: String(selected.round), activity: typeof openedActivity === "number" ? String(openedActivity) : undefined,
        create: openedActivity === "new" ? "1" : undefined, page: search.activityPage }}
      embedded={{ activities: activityList, progress: activityProgress.data ?? [], ratings,
        href: (activity, pageNumber) => overviewHref(page, activity, pageNumber ? String(pageNumber) : "") }}
    />
  ) : null;

  const newRoundSection = (
    <section className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">새 기수 등록</h2>
        <Link href={recruitmentHref} className={secondaryButton}>뒤로가기</Link>
      </div>
      <RoundForm create />
    </section>
  );
  const applicantsSection = !creating && selected && stage === "recruitment" ? (
    <section className={panel}>
    <MateApplicantsTable
      key={`${selected.round}:${stage}:${status}:${feed}:${gender}:${region}:${page}`}
      round={selected.round}
      title={applicantsTitle}
      quotas={{ outdoor: selected.outdoor_quota, work: selected.work_quota, lifestyle: selected.lifestyle_quota }}
      paginated={page > 1 || count > pageSize}
      filter={<MateFilterForm>
        <input type="hidden" name="round" value={selected.round} />
        <input type="hidden" name="stage" value={stage} />
        <select aria-label="심사 상태" className={filterClass} name="status" defaultValue={status}>
          <option value="">심사 상태 전체</option>
          {Object.entries(MATE_STATUSES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
        <select aria-label="피드 스타일" className={filterClass} name="feed" defaultValue={feed ?? ""}>
          <option value="">피드 스타일 전체</option>
          {Object.entries(MATE_STYLES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
        <select aria-label="성별" className={filterClass} name="gender" defaultValue={gender ?? ""}>
          <option value="">성별 전체</option>
          {Object.entries(MATE_APPLICATION_GENDERS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
        <select aria-label="주소지 지역" className={filterClass} name="region" defaultValue={region ?? ""}>
          <option value="">지역 전체</option>
          {Object.keys(MATE_REGION_PREFIXES).map((value) => <option key={value}>{value}</option>)}
        </select>
      </MateFilterForm>}
      rows={applications.map((application) => ({
        id: application.id,
        name: application.name,
        snsId: application.sns_id,
        primaryFeedStyle: application.feed_styles[0],
        feedStyle: application.feed_styles.map((key) => MATE_STYLES[key]).join(", "),
        phone: formatMatePhone(application.phone),
        region: mateAddressRegion(application.address),
        gender: MATE_GENDERS[application.gender],
        reviewStatus: application.status,
        participantLink: application.status === "selected" ? <MateParticipantLink application={application} /> : null,
        detail: <ApplicantDetail opened={application} />,
      }))}
    >
    {listFailed && <p role="alert" className="mt-3 text-sm text-red-700">지원자 목록을 불러오지 못했습니다.</p>}
    {!listFailed && !applications.length && <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm">이 조건에 맞는 지원서가 없습니다.</p>}
    {!listFailed && (page > 1 || count > pageSize) && <nav aria-label="지원자 목록 페이지" className="mt-4 flex items-center gap-3 text-sm">
      {page > 1 && <Link href={overviewHref(page - 1)} className={outlineClass}>이전</Link>}
      <span>{page} 페이지</span>
      {page * pageSize < count && <Link href={overviewHref(page + 1)} className={outlineClass}>다음</Link>}
    </nav>}
    </MateApplicantsTable>
  </section>
  ) : null;

  return (
    <>
    <MarketingTabs active="mate" superAdmin={admin.grade === SUPER_ADMIN_GRADE} />
    <div className="w-full min-w-0 space-y-3 bg-white p-4 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 pb-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-black">워크업 메이트 관리</h1>
          {!creating && <nav aria-label="기수 진행 상태" className="flex max-w-full overflow-x-auto rounded-md border border-slate-200 bg-slate-100 p-0.5">
            {Object.entries(MATE_COHORT_STAGES).map(([key, label]) => <Link key={key} href={`/admin/mate?stage=${key}`}
              aria-current={stage === key ? "page" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded px-4 text-sm font-bold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-800 md:min-h-9 ${stage === key
                ? "bg-white text-blue-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>{label}</Link>)}
          </nav>}
        </div>
        {!creating && stage === "recruitment" && <div className="flex flex-wrap items-center gap-2">
          {selected && <Link target="_blank" rel="noreferrer"
            href={`/mate/${selected.round}${selected.published ? "" : "?preview=1"}`}
            className={secondaryButton} aria-label="접수 페이지 열기 (새 탭)">접수 페이지 열기<NewTabIcon /></Link>}
          {newCohort}
        </div>}
        {selected && !creating && stage === "operations" && <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/mate/overview?round=${selected.round}`} className={secondaryButton}>회차 통합 통계</Link>
          <Link target="_blank" rel="noreferrer" href={`/admin/mate/results?round=${selected.round}`}
            className={contentButton} aria-label="콘텐츠 취합 (새 탭)">콘텐츠 취합<NewTabIcon /></Link>
        </div>}
      </header>
      {error || activityCohorts.error ? <p role="alert" className={panel}>모집 설정을 불러올 수 없습니다. 데이터베이스 연결 및 마이그레이션 적용 상태를 확인해 주세요.</p> : (
        <>
          {!creating && selected && stage === "recruitment" && <>
            <section className={panel} aria-labelledby="mate-recruitment-settings">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="mate-recruitment-settings" className="text-lg font-bold">{selected.round}기 모집 관리</h2>
                {cohortSelector}
              </div>
              <details key={selected.round} className="group mt-3 min-w-0 overflow-hidden rounded-lg border border-slate-200">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 bg-slate-50 px-4 py-2 font-bold hover:bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-800 [&::-webkit-details-marker]:hidden">
                  모집 설정
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"
                    className="size-4 text-slate-600 group-open:rotate-180">
                    <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <div className="border-t border-slate-200 px-4 pb-4"><RoundForm round={selected} /></div>
              </details>
            </section>
            {applicantsSection}
          </>}
          {creating && newRoundSection}
          {!creating && !selected && <section className={panel + " flex flex-wrap items-center justify-between gap-2"}>
            <p className="text-sm text-slate-600">{stage === "recruitment" ? "모집을 준비 중이거나 진행 중인 기수가 없습니다."
              : stage === "operations" ? "운영 중인 기수가 없습니다." : "종료된 기수가 없습니다."}</p>
          </section>}
          {!creating && selected && stage === "operations" && <section className="min-w-0" aria-labelledby="mate-published-activities">
            <h2 id="mate-published-activities" className="sr-only">{selected.round}기 활동 회차</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <MateCohortSelect key={selected.round} value={selected.round} stage={stage} hideLabel
                options={visibleRounds.map((round) => ({ value: round.round, label: `${round.round}기` }))} />
              {activities.length > 0 && <nav aria-label="활동 회차 선택" className="flex min-w-0 max-w-full gap-1 overflow-x-auto">
                {[...activities].reverse().map((activity) => {
                  const active = openedActivity === activity.activity_no;
                  return <Link key={activity.activity_no} href={overviewHref(page, activity.activity_no)} scroll={false} prefetch={false}
                    aria-current={active ? "page" : undefined} title={activity.product_name}
                    className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md px-3 text-sm font-bold md:min-h-9 ${active
                      ? "bg-blue-50 text-blue-900 ring-1 ring-inset ring-blue-800" : "text-slate-600 hover:bg-slate-100"}`}>
                    {activity.activity_no}회차
                  </Link>;
                })}
              </nav>}
              <Link href={overviewHref(page, "new")} scroll={false} prefetch={false}
                aria-current={openedActivity === "new" ? "page" : undefined} className={primaryButton}>활동 회차 추가</Link>
            </div>
            {(activityList.error || activityProgress.error) && <p role="alert" className="mt-2 text-sm text-red-700">활동 회차를 불러오지 못했습니다.</p>}
            {inlinePanel ?? (!activityList.error && <p className="mt-3 text-sm text-slate-600">등록된 활동 회차가 없습니다.</p>)}
            {activities.length > 0 && mates && ratings && !ratings.error && <div className="mt-3">
              <MateScoreSummary activities={activities} mates={mates} ratings={ratings.data}
                note={`${selected.retain_through ? formatMateDate(selected.retain_through) : "활동 종료일"} 종료 후, 보관 동의 메이트만 1년 보관`}
                emptyText="선정 메이트가 없습니다." />
            </div>}
          </section>}
          {!creating && selected && stage === "ended" && <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 py-2">
              {cohortSelector}
              <p className="text-sm text-slate-600">활동 종료일 {formatMateDate(selected.retain_through)}</p>
            </div>
            <ActivityStatistics round={selected.round} activities={activityList.data ?? []} progress={activityProgress.data ?? []}
              failed={Boolean(activityList.error || activityProgress.error)} archived />
            {resultRecords?.error
              ? <p role="alert" className="text-sm text-red-700">평가결과를 불러오지 못했습니다. 평가결과 SQL 적용 상태를 확인해 주세요.</p>
              : resultRecords && <MateScoreSummary open activities={activityList.data ?? []}
                mates={resultRecords.data} ratings={mateResultRatings(resultRecords.data)}
                note={resultRecords.data.length
                  ? `${formatMateDate(resultRecords.data[0].expires_on)}까지 보관 (이후 자동 삭제)` : "활동 종료 후 1년 보관"}
                emptyText="보관된 평가결과가 없습니다." />}
          </>}
        </>
      )}
    </div>
    </>
  );
}
