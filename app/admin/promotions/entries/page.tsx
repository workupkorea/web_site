import Link from "next/link";
import { redirect } from "next/navigation";
import { renderReviewPanels } from "@/app/goldenbell/pages";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import "@/public/goldenbell/admin.css";
import EventControls from "./EventControls";
import EventForm from "./EventForm";
import EventSelect from "./EventSelect";
import ReviewPanels from "./ReviewPanels";
import { entriesPath, eventPhase, eventStatuses, koreaDay, mergeEvents, pickEntryEvent, PROMOTION_SETTINGS_PREFIX, testEventOf } from "./events";
import { testKey } from "@/app/goldenbell/events-server";
import TestControls from "./TestControls";

const segment = "inline-flex min-h-11 items-center whitespace-nowrap border px-3 text-sm font-semibold focus-visible:relative sm:min-h-9";
const button = segment + " border-[var(--admin-line)] bg-white text-slate-700 hover:bg-slate-50";
// 추첨 화면이 열려 있으면 강조한다.
const drawButton = segment + " border-[var(--admin-line)] bg-white text-slate-700 hover:bg-slate-50 aria-pressed:border-[var(--admin-accent)] aria-pressed:bg-[var(--admin-accent)] aria-pressed:text-white";
// 같은 성격의 버튼은 테두리를 맞붙여 한 묶음으로 보여준다.
const group = "flex -space-x-px";

export default async function PromotionEntriesPage({ searchParams }: { searchParams: Promise<{ event?: string; edit?: string; new?: string }> }) {
  if (!(await isAdmin())) redirect("/member/login?from=admin");
  const query = await searchParams;
  const { data, error } = await createAdminClient().from("site_settings")
    .select("section, config").like("section", PROMOTION_SETTINGS_PREFIX + "%");
  const all = mergeEvents(data ?? []);
  const events = [...all].sort((a, b) => Number(a.status === "archived") - Number(b.status === "archived")
    || b.start.localeCompare(a.start) || a.name.localeCompare(b.name, "ko"));
  // 선택이 없으면 고객 화면에 나가고 있는 이벤트를 보여준다.
  const current = pickEntryEvent(all);
  const selected = all.find((event) => event.id === query.event) ?? all.find((event) => event.id === current.id) ?? current;
  const phase = eventPhase(selected);
  const selectedHref = entriesPath + "?event=" + selected.id;
  const adding = query.new === "1";
  const editing = query.edit === "1";
  const isEntry = Boolean(selected.entry);
  // 테스트 모드가 켜져 있는 동안은 검수·추첨·결과가 모두 테스트 영역을 본다.
  const viewingTest = isEntry && Boolean(selected.testSince);
  const viewId = viewingTest ? testEventOf(selected).id : selected.id;

  return (
    <section className="min-w-0 space-y-2">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="shrink-0 text-xl font-bold text-slate-900">프로모션</h1>
          <EventSelect events={events} selectedId={selected.id} />
          <span className="bg-[var(--admin-info-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--admin-info)]">{eventStatuses[phase]}{selected.override ? " · 수동" : ""}</span>
          {(selected.start || selected.end) && <span className="text-xs tabular-nums text-slate-600">{[selected.start, selected.end].filter(Boolean).join(" ~ ")}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {isEntry && (
            <div role="group" aria-label="당첨 관리" className={group}>
              {/* 추첨 화면 전환과 팝업은 public/goldenbell/admin-draw.js 가 처리한다. */}
              <button type="button" data-draw-open="draw" aria-pressed="false" className={drawButton}>이벤트 추첨</button>
            </div>
          )}
          {isEntry && (
            <div role="group" aria-label="직원 테스트" className={group}>
              <TestControls key={selected.id} id={selected.id} link={testKey(selected) ? "/goldenbell/?test=" + testKey(selected) : ""} className={button} />
            </div>
          )}
          {(isEntry || selected.publicUrl) && (
            <div role="group" aria-label="고객 화면 보기" className={group}>
              {isEntry && selected.id === current.id && <a href="/goldenbell/" target="_blank" rel="noopener noreferrer" className={button}>고객 응모 ↗</a>}
              {selected.publicUrl && <a href={selected.publicUrl} target="_blank" rel="noopener noreferrer" className={button}>{isEntry ? "공개 안내" : "공개 링크"} ↗</a>}
            </div>
          )}
          {!error && (
            <div role="group" aria-label="이벤트 관리" className={group}>
              {isEntry && <button type="button" data-draw-open="results" aria-haspopup="dialog" className={button}>이벤트 결과</button>}
              {isEntry && <EventControls key={selected.id} id={selected.id} phase={phase} override={selected.override ?? ""} ended={Boolean(selected.end) && koreaDay() > selected.end} className={button} />}
              <Link href={selectedHref + "&edit=1"} className={button}>이벤트 수정</Link>
              <Link href={selectedHref + "&new=1"} className={button}>+ 이벤트 추가</Link>
            </div>
          )}
        </div>
      </header>
      {error && <p role="alert" className="text-sm text-rose-700">프로모션 목록을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>}
      {!error && (adding || editing) && <EventForm key={adding ? "new" : selected.id} event={adding ? undefined : selected} cancelHref={selectedHref} />}

      {viewingTest && <p role="status" className="bg-[var(--admin-pending-bg)] px-3 py-2 text-sm font-semibold text-[var(--admin-pending)]">테스트 모드예요. 지금 보이는 검수·추첨·제외번호는 테스트 데이터이며, 실제 응모를 보려면 테스트 모드를 끄세요.</p>}

      <section aria-label={`${selected.name} 응모 검수`}>
        {isEntry ? <ReviewPanels key={viewId} eventId={viewId} html={renderReviewPanels(false, { compact: true, event: viewId })} /> : (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">이 이벤트에 연결된 응모 검수 화면이 없습니다.</p>
        )}
      </section>
    </section>
  );
}
