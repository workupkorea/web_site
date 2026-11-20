import type { Metadata } from "next";
import Link from "next/link";
import MateApplicantsTable from "@/components/MateApplicantsTable";
import { redirect } from "next/navigation";
import MateActionForm from "@/components/MateActionForm";
import MateParticipantLink from "@/components/MateParticipantLink";
import MateRecruitmentSettings from "@/components/MateRecruitmentSettings";
import MateClosedRecruitment from "@/components/MateClosedRecruitment";
import MateCohortSelect from "@/components/MateCohortSelect";
import { isAdmin } from "@/lib/admin-auth";
import { MATE_APPLICATION_GENDERS, MATE_GENDERS, MATE_REGION_PREFIXES, MATE_STATUSES, MATE_STYLES, formatMateDate, formatMatePhone, mateAddressRegion, mateRoundStatus, parseRound, seoulDate, type MateApplication, type MateApplicationFilters, type MateRound } from "@/lib/mate";
import { listMateApplications, listMateRounds } from "@/lib/mate-server";
import { saveMateRound, updateMateApplication } from "./actions";
import { listMateActivities, listMateActivityProgress } from "@/lib/mate-activity-server";
import type { MateActivity, MateActivityProgress } from "@/lib/mate-activities";
import MateActivityProgressTable from "./activities/activity-progress-table";
import ActivityManagement from "./activities/activity-management";

export const metadata: Metadata = { title: "워크업 메이트 관리", robots: { index: false, follow: false } };

const inputClass = "min-h-11 min-w-0 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal";
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-md bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700 disabled:opacity-60";
const outlineClass = "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold hover:bg-slate-50";
const panel = "rounded-xl border border-slate-200 bg-white p-4 sm:p-6";
const filterClass = "min-h-11 max-w-48 rounded-md border border-slate-300 bg-white px-2 text-sm md:min-h-9";
const pageSize = 25;
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
    ["outdoor_quota", MATE_STYLES.outdoor, round?.outdoor_quota],
    ["work_quota", MATE_STYLES.work, round?.work_quota],
    ["lifestyle_quota", MATE_STYLES.lifestyle, round?.lifestyle_quota],
  ] as const;
  return (
    <MateActionForm action={saveMateRound} className="mt-3 grid items-end gap-x-3 gap-y-2 xl:grid-cols-12 [&>p]:xl:col-span-12"
      buttonClassName={buttonClass + " xl:col-span-2"}
      submitLabel={create ? "기수 추가" : "모집 설정 저장"}>
      <input type="hidden" name="mode" value={create ? "create" : "edit"} />
      {create ? <label className="grid max-w-32 gap-1 text-sm font-semibold xl:col-span-12">기수
        <input className={inputClass} name="round" type="number" min={1} max={999} step={1} required />
      </label> : <input type="hidden" name="round" value={round?.round} />}
      <label className="grid gap-1 text-sm font-semibold xl:col-span-4">활동 기간
        <input className={inputClass} name="activity_period" defaultValue={round?.activity_period} maxLength={120} required />
      </label>
      <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2 xl:col-span-8 xl:grid-cols-4">
        {dates.map(([name, label, value]) => (
          <label key={name} className="grid min-w-0 gap-1 text-sm font-semibold">{label}
            <input className={inputClass} type="date" name={name} defaultValue={value ?? ""}
              aria-describedby={name === "retain_through" ? "mate-activity-end-help" : undefined} />
          </label>
        ))}
      </div>
      <span id="mate-activity-end-help" className="sr-only">활동 종료일은 선정 메이트의 개인 링크와 개인정보 보유 종료일에 적용됩니다.</span>
      <fieldset className="min-w-0 xl:col-span-8">
        <legend className="sr-only">부문별 모집 인원</legend>
        <div className="grid gap-x-3 gap-y-2 sm:grid-cols-3">
          {quotas.map(([name, label, value]) => (
            <label className="grid gap-1 text-sm font-semibold" key={name}>{label} 모집 인원
              <input type="number" name={name} min={0} max={9999} className={inputClass} defaultValue={value ?? ""} placeholder="미정" />
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold xl:col-span-2">
        <input type="checkbox" name="published" value="yes" defaultChecked={round?.published} />모집 페이지 공개
      </label>
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
          {opened.status === "selected" && <MateParticipantLink application={opened} />}
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
  searchParams: Promise<{ round?: string; status?: string; feed?: string; gender?: string; region?: string; page?: string; create?: string; activity?: string; activityPage?: string; applicants?: string }>;
}) {
  if (!(await isAdmin())) redirect("/member/login?from=admin");
  const search = await searchParams;
  const { data, error } = await listMateRounds(null, false);
  const rounds = data ?? [];
  const requested = parseRound(search.round);
  const selected = rounds.find((round) => round.round === requested) ?? rounds[0];
  const creating = search.create === "1" || !selected;
  const status = typeof search.status === "string" && Object.hasOwn(MATE_STATUSES, search.status) ? search.status : "";
  const feed = typeof search.feed === "string" && Object.hasOwn(MATE_STYLES, search.feed) ? search.feed as MateApplicationFilters["feed"] : undefined;
  const gender = typeof search.gender === "string" && Object.hasOwn(MATE_APPLICATION_GENDERS, search.gender) ? search.gender as MateApplicationFilters["gender"] : undefined;
  const region = typeof search.region === "string" && Object.hasOwn(MATE_REGION_PREFIXES, search.region) ? search.region as MateApplicationFilters["region"] : undefined;
  const page = typeof search.page === "string" && /^\d{1,6}$/.test(search.page) ? Math.max(1, Number(search.page)) : 1;

  const recruitmentEnded = Boolean(selected?.ends_on && seoulDate() > selected.ends_on);
  const requestedList = search.applicants === "1";
  let activityList: Awaited<ReturnType<typeof listMateActivities>> = { data: [] as MateActivity[], error: null };
  let activityProgress = { data: [] as MateActivityProgress[] | null, error: false };
  let applications: MateApplication[] = [];
  let count = 0;
  let listFailed = false;
  if (!creating && selected) {
    const [result, activities, progress] = await Promise.all([
      listMateApplications(selected.round, status, (page - 1) * pageSize, pageSize, { feed, gender, region }),
      listMateActivities(selected.round),
      listMateActivityProgress(selected.round),
    ]);
    activityList = activities;
    activityProgress = { data: progress.data, error: Boolean(progress.error) };
    applications = result.data ?? [];
    count = result.count ?? 0;
    listFailed = Boolean(result.error);
  }

  const requestedActivity = parseRound(search.activity);
  const runningActivities = activityList.data?.some((activity) => activity.published) ?? false;
  const combinedPanels = recruitmentEnded || runningActivities
    || Boolean(selected?.starts_on && selected.ends_on && selected.announces_on && selected.retain_through);
  const defaultApplicantsOpen = Boolean(selected?.retain_through && mateRoundStatus(selected) === "모집 중" && !runningActivities);
  const latestActivity = activityList.data?.find((activity) => activity.published) ?? activityList.data?.[0];
  const manageActivity = latestActivity?.activity_no ?? "new";
  const openedActivity = search.activity === "manage" ? manageActivity
    : search.activity === "new" ? "new"
    : requestedActivity && activityList.data?.some((activity) => activity.activity_no === requestedActivity) ? requestedActivity : null;

  function overviewHref(pageNumber: number, activity: number | "manage" | "new" | null = openedActivity, activityPage = search.activityPage, openApplicants = false) {
    const query = new URLSearchParams({ round: String(selected.round) });
    if (pageNumber > 1 || search.page !== undefined) query.set("page", String(pageNumber));
    if (status || Object.hasOwn(search, "status")) query.set("status", status);
    if (feed) query.set("feed", feed);
    if (gender) query.set("gender", gender);
    if (region) query.set("region", region);
    if (openApplicants) query.set("applicants", "1");
    if (activity) {
      query.set("activity", String(activity));
      if (activityPage) query.set("activityPage", activityPage);
    }
    return `/admin/mate?${query}`;
  }

  const applicantsTitle = selected ? `${selected.round}기 지원자${listFailed ? "" : ` ${count.toLocaleString("ko-KR")}명`}` : "";
  const cohortSelector = (
    <MateCohortSelect key={selected?.round} value={selected?.round}
      options={rounds.map((round) => ({ value: round.round, label: `${round.round}기 · ${mateRoundStatus(round)}` }))} />
  );
  const toolbarButton = "inline-flex min-h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-bold hover:bg-slate-50";
  const cohortActions = <>
    {!creating && <>
      <Link href="/admin/mate?create=1" className={toolbarButton}>새 기수 등록</Link>
      <Link href={overviewHref(page, "new", "")} scroll={false} prefetch={false} className={toolbarButton}>활동 회차 추가</Link>
    </>}
  </>;
  const inlinePanel = openedActivity !== null && selected ? (
    <ActivityManagement
      search={{ round: String(selected.round), activity: typeof openedActivity === "number" ? String(openedActivity) : undefined,
        create: openedActivity === "new" ? "1" : undefined, page: search.activityPage }}
      embedded={{ activities: activityList, progress: activityProgress.data ?? [],
        href: (activity, pageNumber) => overviewHref(page, activity, pageNumber ? String(pageNumber) : "") }}
    />
  ) : null;

  const settingsSection = (
    <section className="rounded-xl border border-slate-200 bg-white px-3 py-2 sm:px-4">
    <MateRecruitmentSettings key={creating ? "create" : selected.round} creating={creating} alwaysOpen={recruitmentEnded && !creating}
      title={creating ? "새 기수 등록" : `${selected.round}기 모집 설정`}>
      <RoundForm round={creating ? undefined : selected} create={creating} />
    </MateRecruitmentSettings>
  </section>
  );
  const applicantsSection = !creating ? (
    <section className={panel}>
    <MateApplicantsTable
      key={`${selected.round}:${recruitmentEnded}:${status}:${feed}:${gender}:${region}:${page}`}
      round={selected.round}
      defaultOpen={defaultApplicantsOpen || requestedList} alwaysOpen={combinedPanels}
      title={applicantsTitle}
      filter={<form className="flex flex-wrap items-center gap-1.5" action="/admin/mate">
        <input type="hidden" name="round" value={selected.round} />
        <input type="hidden" name="applicants" value="1" />
        {openedActivity && <input type="hidden" name="activity" value={openedActivity} />}
        {openedActivity && search.activityPage && <input type="hidden" name="activityPage" value={search.activityPage} />}
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
        <button className="min-h-11 rounded-md border border-slate-300 px-3 text-sm font-semibold md:min-h-9">필터 적용</button>
      </form>}
      rows={applications.map((application) => ({
        id: application.id,
        name: application.name,
        snsId: application.sns_id,
        feedStyle: application.feed_styles.map((key) => MATE_STYLES[key]).join(", "),
        phone: formatMatePhone(application.phone),
        region: mateAddressRegion(application.address),
        gender: MATE_GENDERS[application.gender],
        reviewStatus: application.status,
        detail: <ApplicantDetail opened={application} />,
      }))}
    >
    {listFailed && <p role="alert" className="mt-3 text-sm text-red-700">지원자 목록을 불러오지 못했습니다.</p>}
    {!listFailed && !applications.length && <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm">이 조건에 맞는 지원서가 없습니다.</p>}
    {!listFailed && (page > 1 || count > pageSize) && <nav aria-label="지원자 목록 페이지" className="mt-4 flex items-center gap-3 text-sm">
      {page > 1 && <Link href={overviewHref(page - 1, openedActivity, search.activityPage, true)} className={outlineClass}>이전</Link>}
      <span>{page} 페이지</span>
      {page * pageSize < count && <Link href={overviewHref(page + 1, openedActivity, search.activityPage, true)} className={outlineClass}>다음</Link>}
    </nav>}
    </MateApplicantsTable>
  </section>
  ) : null;

  return (
    <div className="w-full min-w-0 space-y-3 p-4 text-slate-900 sm:px-6 sm:py-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">워크업 메이트 관리</h1>
        {selected && !creating && <div className="ml-auto flex flex-wrap justify-end gap-2">
          <Link target="_blank" rel="noreferrer" href={`/mate/${selected.round}${selected.published ? "" : "?preview=1"}`}
            className={toolbarButton} aria-label="접수 페이지 열기 (새 탭)">접수 페이지 열기<NewTabIcon /></Link>
          <Link target="_blank" rel="noreferrer" href={`/admin/mate/results?round=${selected.round}`}
            className={toolbarButton} aria-label="콘텐츠 취합 (새 탭)">콘텐츠 취합<NewTabIcon /></Link>
        </div>}
      </header>
      {error ? <p role="alert" className={panel}>모집 설정을 불러올 수 없습니다. 데이터베이스 연결 및 마이그레이션 적용 상태를 확인해 주세요.</p> : (
        <>
          {!creating && combinedPanels ? <>
            {!recruitmentEnded && <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1">
              {cohortSelector}
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{cohortActions}</div>
            </section>}
            <MateClosedRecruitment
              key={`${selected.round}:${recruitmentEnded}:${openedActivity}:${requestedList}:${defaultApplicantsOpen}`}
              selector={recruitmentEnded ? cohortSelector : <h2 className="px-1 text-lg font-bold">{selected.round}기 모집 설정</h2>}
              actions={recruitmentEnded ? cohortActions : null}
              settings={<section className={panel}><RoundForm round={selected} /></section>}
              applicants={applicantsSection}
              applicantsTitle={applicantsTitle}
              initialApplicantsOpen={defaultApplicantsOpen || requestedList}
            />
          </> : <>
            {rounds.length > 0 && <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1">
              {cohortSelector}
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{cohortActions}</div>
            </section>}
            {settingsSection}
            {applicantsSection}
          </>}          {!creating && <section className={panel} aria-labelledby="mate-published-activities">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="mate-published-activities" className="text-lg font-bold">{selected.round}기 활동 회차</h2>
              <Link href={overviewHref(page, openedActivity ? null : manageActivity, "")} scroll={false} prefetch={false}
                aria-expanded={openedActivity !== null} className={outlineClass}>
                {openedActivity ? "활동 회차 닫기" : "활동 회차 관리"}
              </Link>
            </div>
            {activityProgress.error && <p role="alert" className="mt-2 text-sm text-red-700">진행 통계를 불러오지 못했습니다.</p>}
            <MateActivityProgressTable activities={activityList.data ?? []} progress={activityProgress.data ?? []}
              opened={openedActivity} inlinePanel={inlinePanel} href={(activity) => overviewHref(page, activity, "")} />
            {openedActivity === "new" && <div className="mt-2">{inlinePanel}</div>}
          </section>}
        </>
      )}
    </div>
  );
}
