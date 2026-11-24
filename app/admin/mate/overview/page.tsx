import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { listMateActivities, listMateActivityProgress } from "@/lib/mate-activity-server";
import { parseRound, seoulDate } from "@/lib/mate";
import { listMateRounds } from "@/lib/mate-server";
import ActivityStatistics from "../activities/activity-statistics";

export const metadata: Metadata = { title: "워크업 메이트 회차 통합 통계", robots: { index: false, follow: false } };

const route = "/admin/mate/overview";
const control = "inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-semibold";
const panel = "rounded-xl border border-slate-200 bg-white";

export default async function MateOverviewPage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  if (!(await isAdmin())) redirect("/member/login?from=admin");

  const search = await searchParams;
  const cohorts = await listMateRounds(null, false);
  const requested = parseRound(search.round);
  const selected = cohorts.data?.find((cohort) => cohort.round === requested) ?? cohorts.data?.[0];
  const [activities, progress] = selected ? await Promise.all([
    listMateActivities(selected.round),
    listMateActivityProgress(selected.round),
  ]) : [null, null];
  const management = selected ? `/admin/mate?round=${selected.round}` : "/admin/mate";
  const results = `/admin/mate/results?round=${selected?.round}`;

  return (
    <main className="mx-auto w-full min-w-0 max-w-[100rem] space-y-4 p-4 text-slate-900 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <h1 className="text-2xl font-black tracking-tight">회차 통합 통계</h1>
        <div className="flex flex-wrap gap-2">
          <Link href={management} className={control + " border-slate-300 bg-white hover:bg-slate-50"}>메이트 관리</Link>
          {selected && <Link href={results} className={control + " border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"}>콘텐츠 취합</Link>}
        </div>
      </header>

      {selected && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <form action={route} className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-semibold">모집 기수
            <select key={selected.round} name="round" defaultValue={selected.round} className={control + " border-slate-300 bg-white"}>
              {cohorts.data?.map((cohort) => <option key={cohort.round} value={cohort.round}>{cohort.round}기</option>)}
            </select>
          </label>
          <button className={control + " border-blue-800 bg-blue-800 text-white hover:bg-blue-900"}>보기</button>
        </form>
        <p className="text-xs leading-relaxed text-slate-600">공개 중이거나 종료된 회차와 응답 기록이 있는 회차를 집계합니다.</p>
      </div>}

      {selected ? <ActivityStatistics round={selected.round} activities={activities?.data ?? []} progress={progress?.data ?? []}
        failed={Boolean(activities?.error || progress?.error)} archived={Boolean(selected.retain_through && selected.retain_through < seoulDate())} />
        : <p role={cohorts.error ? "alert" : undefined} className={panel + " p-4 text-sm text-slate-700"}>
          {cohorts.error ? "회차 통계를 불러오지 못했습니다." : "집계할 활동 회차가 없습니다."}
        </p>}
    </main>
  );
}
