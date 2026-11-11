import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";

const KST_MS = 9 * 3600 * 1000;
const DAY_MS = 86400000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE = 1000; // Supabase 1회 조회 상한
const MAX_ROWS = 100000; // 안전 상한
const MAX_BUCKETS = 400;
const VISITOR_CHUNK = 25;

type Ev = {
  event_type: string;
  nav_label: string;
  path?: string | null;
  duration_sec?: number | null;
  visitor_id?: string | null;
  created_at: string;
};

type Db = ReturnType<typeof createAdminClient>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Apply = (q: any) => any;

const COLS = "event_type,nav_label,path,duration_sec,visitor_id,created_at";

async function fetchPaged(db: Db, cols: string, apply: Apply): Promise<Ev[]> {
  const out: Ev[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await apply(db.from("nav_events").select(cols)).order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as Ev[];
    out.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return out;
}

const kstDate = (ms: number) => new Date(ms + KST_MS).toISOString().slice(0, 10);
const dateToMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const kstStartIso = (d: string) => new Date(`${d}T00:00:00+09:00`).toISOString();
const kstEndIso = (d: string) => new Date(`${d}T23:59:59.999+09:00`).toISOString();

const countMap = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
const topList = (m: Map<string, number>, limit: number) =>
  [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));

// GET /api/admin/analytics/nav?from=YYYY-MM-DD&to=YYYY-MM-DD[&menu=메뉴명]   (from/to 없으면 전체 기간)
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from") ?? "";
  const toParam = searchParams.get("to") ?? "";
  const menu = (searchParams.get("menu") ?? "").slice(0, 100);
  const hasRange = DATE_RE.test(fromParam) && DATE_RE.test(toParam) && fromParam <= toParam;

  try {
    const db = createAdminClient();
    const sinceIso = hasRange ? kstStartIso(fromParam) : new Date(0).toISOString();
    const untilIso = hasRange ? kstEndIso(toParam) : null;

    const events = await fetchPaged(db, COLS, (q) => {
      let r = q.gte("created_at", sinceIso);
      if (untilIso) r = r.lte("created_at", untilIso);
      return r;
    });

    // 기간 확정 (전체 기간은 데이터 최초일~오늘)
    const today = kstDate(Date.now());
    let startKey = fromParam;
    let endKey = toParam;
    if (!hasRange) {
      endKey = today;
      startKey = events.length ? kstDate(Date.parse(events[0].created_at)) : today;
    }
    const unit: "hour" | "day" = startKey === endKey ? "hour" : "day";
    const spanDays = Math.min(MAX_BUCKETS, Math.round((dateToMs(endKey) - dateToMs(startKey)) / DAY_MS) + 1);

    // 직전 동일 기간(비교용) — 기간 지정 시에만
    let prev: { clicks: number; visitors: number; byMenu: Map<string, number> } | null = null;
    if (hasRange) {
      const prevTo = kstDate(dateToMs(fromParam) - DAY_MS);
      const prevFrom = kstDate(dateToMs(fromParam) - spanDays * DAY_MS);
      const prevEvents = await fetchPaged(db, "event_type,nav_label,visitor_id,created_at", (q) =>
        q.eq("event_type", "nav_click").gte("created_at", kstStartIso(prevFrom)).lte("created_at", kstEndIso(prevTo)),
      );
      const byMenu = new Map<string, number>();
      const vs = new Set<string>();
      for (const e of prevEvents) {
        countMap(byMenu, e.nav_label);
        if (e.visitor_id) vs.add(e.visitor_id);
      }
      prev = { clicks: prevEvents.length, visitors: vs.size, byMenu };
    }

    // 메뉴별 집계 (전체 메뉴, 메뉴 선택과 무관)
    type Agg = { clicks: number; visitors: Set<string>; dwellN: number; dwellSum: number };
    const aggs = new Map<string, Agg>();
    const allVisitors = new Set<string>();
    let totalClicks = 0;
    for (const e of events) {
      let a = aggs.get(e.nav_label);
      if (!a) aggs.set(e.nav_label, (a = { clicks: 0, visitors: new Set(), dwellN: 0, dwellSum: 0 }));
      if (e.event_type === "nav_click") {
        a.clicks++;
        totalClicks++;
        if (e.visitor_id) {
          a.visitors.add(e.visitor_id);
          allVisitors.add(e.visitor_id);
        }
      } else if (e.event_type === "dwell" && e.duration_sec != null) {
        a.dwellN++;
        a.dwellSum += Number(e.duration_sec);
      }
    }
    const rows = [...aggs.entries()]
      .map(([label, a]) => ({
        label,
        clicks: a.clicks,
        prevClicks: prev ? (prev.byMenu.get(label) ?? 0) : null,
        visitors: a.visitors.size,
        dwellSamples: a.dwellN,
        avgDwellSec: a.dwellN ? Math.round((a.dwellSum / a.dwellN) * 10) / 10 : null,
      }))
      .filter((r) => r.clicks > 0 || r.dwellSamples > 0)
      .sort((a, b) => b.clicks - a.clicks);

    // 상세 분석 (선택 메뉴가 있으면 그 메뉴만)
    const scoped = menu ? events.filter((e) => e.nav_label === menu) : events;
    const clicks = scoped.filter((e) => e.event_type === "nav_click");
    const dwells = scoped.filter((e) => e.event_type === "dwell" && e.duration_sec != null);

    const trendMap = new Map<string, number>();
    const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const pages = new Map<string, number>();
    const scopedVisitors = new Set<string>();
    for (const e of clicks) {
      const k = new Date(Date.parse(e.created_at) + KST_MS);
      const key = unit === "hour" ? String(k.getUTCHours()) : k.toISOString().slice(0, 10);
      countMap(trendMap, key);
      heat[k.getUTCDay()][k.getUTCHours()]++;
      countMap(pages, e.path || "(알 수 없음)");
      if (e.visitor_id) scopedVisitors.add(e.visitor_id);
    }

    const trend: { key: string; clicks: number }[] = [];
    if (unit === "hour") {
      for (let h = 0; h < 24; h++) trend.push({ key: String(h), clicks: trendMap.get(String(h)) ?? 0 });
    } else {
      for (let i = 0; i < spanDays; i++) {
        const key = kstDate(dateToMs(startKey) + i * DAY_MS);
        trend.push({ key, clicks: trendMap.get(key) ?? 0 });
      }
    }

    // 신규/재방문: 기간 이전에 같은 방문자의 메뉴 클릭 기록이 있으면 재방문 (전체 기간이면 구분 불가)
    let returningVisitors: number | null = null;
    if (hasRange && scopedVisitors.size) {
      const seenBefore = new Set<string>();
      const ids = [...scopedVisitors];
      for (let i = 0; i < ids.length; i += VISITOR_CHUNK) {
        const chunk = ids.slice(i, i + VISITOR_CHUNK);
        const found = await fetchPaged(db, "visitor_id,created_at,event_type,nav_label", (q) =>
          q.eq("event_type", "nav_click").lt("created_at", sinceIso).in("visitor_id", chunk),
        );
        for (const f of found) if (f.visitor_id) seenBefore.add(f.visitor_id);
      }
      returningVisitors = seenBefore.size;
    }

    const dwellSum = dwells.reduce((s, e) => s + Number(e.duration_sec), 0);

    return NextResponse.json({
      range: { from: startKey, to: endKey, unit, all: !hasRange },
      totals: {
        clicks: totalClicks,
        visitors: allVisitors.size,
        prevClicks: prev?.clicks ?? null,
        prevVisitors: prev?.visitors ?? null,
      },
      rows,
      detail: {
        menu: menu || null,
        clicks: clicks.length,
        visitors: scopedVisitors.size,
        returningVisitors,
        newVisitors: returningVisitors == null ? null : scopedVisitors.size - returningVisitors,
        avgDwellSec: dwells.length ? Math.round((dwellSum / dwells.length) * 10) / 10 : null,
        trend,
        heat,
        pages: topList(pages, 8),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
