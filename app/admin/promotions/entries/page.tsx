import Link from "next/link";
import { redirect } from "next/navigation";
import { renderReviewPanels } from "@/app/goldenbell/pages";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import "@/public/goldenbell/admin.css";
import EventForm from "./EventForm";
import EventSelect from "./EventSelect";
import ReviewPanels from "./ReviewPanels";
import { entriesPath, eventStatuses, goldenbellEvent, PROMOTION_SETTINGS_PREFIX, type PromotionEvent } from "./events";

const button = "inline-flex min-h-11 items-center whitespace-nowrap border border-[var(--admin-line)] bg-white px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:min-h-9";

export default async function PromotionEntriesPage({ searchParams }: { searchParams: Promise<{ event?: string; edit?: string; new?: string }> }) {
  if (!(await isAdmin())) redirect("/member/login?from=admin");
  const query = await searchParams;
  const { data, error } = await createAdminClient().from("site_settings")
    .select("section, config").like("section", PROMOTION_SETTINGS_PREFIX + "%");
  const byId = new Map([[goldenbellEvent.id, goldenbellEvent]]);
  for (const row of data ?? []) {
    const id = row.section.slice(PROMOTION_SETTINGS_PREFIX.length);
    byId.set(id, { ...(row.config as Omit<PromotionEvent, "id">), id });
  }
  const events = [...byId.values()].sort((a, b) => Number(a.status === "archived") - Number(b.status === "archived")
    || b.start.localeCompare(a.start) || a.name.localeCompare(b.name, "ko"));
  const selected = byId.get(query.event ?? "") ?? byId.get(goldenbellEvent.id) ?? goldenbellEvent;
  const selectedHref = entriesPath + "?event=" + selected.id;
  const adding = query.new === "1";
  const editing = query.edit === "1";
  const isGoldenbell = selected.id === goldenbellEvent.id;

  return (
    <section className="min-w-0 space-y-2">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="shrink-0 text-xl font-bold text-slate-900">프로모션</h1>
          <EventSelect events={events} selectedId={selected.id} />
          <span className="bg-[var(--admin-info-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--admin-info)]">{eventStatuses[selected.status]}</span>
          {(selected.start || selected.end) && <span className="text-xs tabular-nums text-slate-600">{[selected.start, selected.end].filter(Boolean).join(" ~ ")}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {!error && <Link href={selectedHref + "&edit=1"} className={button}>이벤트 수정</Link>}
          {isGoldenbell && <a href="/goldenbell/" target="_blank" rel="noopener noreferrer" className={button}>고객 응모 ↗</a>}
          {selected.publicUrl && <a href={selected.publicUrl} target="_blank" rel="noopener noreferrer" className={button}>{isGoldenbell ? "공개 안내" : "공개 링크"} ↗</a>}
          {!error && <Link href={selectedHref + "&new=1"} className="inline-flex min-h-11 items-center whitespace-nowrap bg-[var(--admin-accent)] px-2.5 text-sm font-semibold text-white hover:bg-[var(--admin-accent-hover)] sm:min-h-9">+ 이벤트 추가</Link>}
        </div>
      </header>
      {error && <p role="alert" className="text-sm text-rose-700">프로모션 목록을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>}
      {!error && (adding || editing) && <EventForm key={adding ? "new" : selected.id} event={adding ? undefined : selected} cancelHref={selectedHref} />}

      <section aria-label={`${selected.name} 응모 검수`}>
        {isGoldenbell ? <ReviewPanels html={renderReviewPanels(false, { compact: true })} /> : (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">이 이벤트에 연결된 응모 검수 화면이 없습니다.</p>
        )}
      </section>
    </section>
  );
}
