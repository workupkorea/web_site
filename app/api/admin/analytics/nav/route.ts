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
  href?: string | null;
  path?: string | null;
  duration_sec?: number | null;
  visitor_id?: string | null;
  device?: string | null;
  created_at: string;
};

type Db = ReturnType<typeof createAdminClient>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Apply = (q: any) => any;

const COLS = "event_type,nav_label,href,path,duration_sec,visitor_id,created_at";
// device 컬럼은 마이그레이션 후에만 존재 — 없으면 COLS로 폴백
const COLS_DEVICE = `${COLS},device`;

// 매장 전환 이벤트(store_events): 매장 확인 → 길찾기·전화·카톡 퍼널용
const STORE_VIEW_TYPES = new Set(["view", "list_click"]);
const CONVERSION_TYPES: { key: string; label: string }[] = [
  { key: "directions", label: "길찾기" },
  { key: "call", label: "전화 문의" },
  { key: "kakao_chat", label: "카카오톡 상담" },
];
const toConvKey = (t: string) => (t === "directions_kakao" || t === "directions_naver" ? "directions" : t === "call" || t === "kakao_chat" ? t : null);
const DEVICES = ["mobile", "tablet", "desktop"] as const;
const DEVICE_LABEL: Record<string, string> = { mobile: "모바일", tablet: "태블릿", desktop: "PC", unknown: "미수집" };

async function fetchPaged(db: Db, table: string, cols: string, apply: Apply): Promise<Ev[]> {
  const out: Ev[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await apply(db.from(table).select(cols)).order("id", { ascending: true }).range(from, from + PAGE - 1);
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

    const applyRange: Apply = (q) => {
      let r = q.gte("created_at", sinceIso);
      if (untilIso) r = r.lte("created_at", untilIso);
      return r;
    };
    let deviceAvailable = true;
    let events: Ev[];
    try {
      events = await fetchPaged(db, "nav_events", COLS_DEVICE, applyRange);
    } catch {
      deviceAvailable = false; // device 컬럼 미적용 — 기존 방식으로 조회
      events = await fetchPaged(db, "nav_events", COLS, applyRange);
    }

    // 매장 이벤트(전환 퍼널). 테이블이 없거나 실패해도 메뉴 분석은 그대로 동작
    let conversionAvailable = true;
    let storeEvents: Ev[] = [];
    try {
      storeEvents = await fetchPaged(db, "store_events", "event_type,visitor_id,created_at", applyRange);
    } catch {
      conversionAvailable = false;
    }

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
      const prevEvents = await fetchPaged(db, "nav_events", "event_type,nav_label,visitor_id,created_at", (q) =>
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

    // ── 전환 인덱스: 방문자별 '마지막 매장 확인/전환 시각' ──
    // 메뉴를 처음 누른 시각 이후에 발생한 행동만 그 메뉴의 성과로 본다.
    const lastView = new Map<string, number>();
    const lastConv = new Map<string, number>();
    const lastByType = new Map<string, Map<string, number>>();
    for (const e of storeEvents) {
      if (!e.visitor_id) continue;
      const ms = Date.parse(e.created_at);
      if (STORE_VIEW_TYPES.has(e.event_type)) {
        if ((lastView.get(e.visitor_id) ?? 0) < ms) lastView.set(e.visitor_id, ms);
        continue;
      }
      const ck = toConvKey(e.event_type);
      if (!ck) continue;
      if ((lastConv.get(e.visitor_id) ?? 0) < ms) lastConv.set(e.visitor_id, ms);
      let m = lastByType.get(ck);
      if (!m) lastByType.set(ck, (m = new Map()));
      if ((m.get(e.visitor_id) ?? 0) < ms) m.set(e.visitor_id, ms);
    }
    // 메뉴별·전체: 방문자의 첫 클릭 시각
    const firstClickByMenu = new Map<string, Map<string, number>>();
    const firstClickAny = new Map<string, number>();
    const visitorDevice = new Map<string, string>();
    for (const e of events) {
      if (e.event_type !== "nav_click" || !e.visitor_id) continue;
      const ms = Date.parse(e.created_at);
      let m = firstClickByMenu.get(e.nav_label);
      if (!m) firstClickByMenu.set(e.nav_label, (m = new Map()));
      if (!m.has(e.visitor_id) || ms < (m.get(e.visitor_id) as number)) m.set(e.visitor_id, ms);
      if (!firstClickAny.has(e.visitor_id) || ms < (firstClickAny.get(e.visitor_id) as number)) firstClickAny.set(e.visitor_id, ms);
      if (e.device) visitorDevice.set(e.visitor_id, e.device);
    }
    const countAfter = (first: Map<string, number>, last: Map<string, number>) => {
      let n = 0;
      for (const [vid, t] of first) if ((last.get(vid) ?? -1) >= t) n++;
      return n;
    };

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
        converted: conversionAvailable ? countAfter(firstClickByMenu.get(label) ?? new Map(), lastConv) : null,
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
        const found = await fetchPaged(db, "nav_events", "visitor_id,created_at,event_type,nav_label", (q) =>
          q.eq("event_type", "nav_click").lt("created_at", sinceIso).in("visitor_id", chunk),
        );
        for (const f of found) if (f.visitor_id) seenBefore.add(f.visitor_id);
      }
      returningVisitors = seenBefore.size;
    }

    // 메인 페이지 클릭 (메뉴 선택과 무관, 기간 필터만 적용). 라벨은 "섹션 · 요소명"
    const homeSections = new Map<string, number>();
    const homeItems = new Map<string, { section: string; label: string; href: string; count: number }>();
    let homeTotal = 0;
    const homeVisitors = new Set<string>();
    for (const e of events) {
      if (e.event_type !== "home_click") continue;
      homeTotal++;
      if (e.visitor_id) homeVisitors.add(e.visitor_id);
      const sep = e.nav_label.indexOf(" · ");
      const section = sep > 0 ? e.nav_label.slice(0, sep) : "기타";
      const label = sep > 0 ? e.nav_label.slice(sep + 3) : e.nav_label;
      countMap(homeSections, section);
      const href = e.href ?? "";
      const k = `${e.nav_label}|${href}`;
      const cur = homeItems.get(k);
      if (cur) cur.count++;
      else homeItems.set(k, { section, label, href, count: 1 });
    }
    const home = {
      total: homeTotal,
      visitors: homeVisitors.size,
      sections: topList(homeSections, 12),
      items: [...homeItems.values()].sort((a, b) => b.count - a.count).slice(0, 15),
    };

    // ── 전환 퍼널 (선택 메뉴 기준, 없으면 전체) ──
    const scopeFirst = menu ? firstClickByMenu.get(menu) ?? new Map<string, number>() : firstClickAny;
    const funnel = conversionAvailable
      ? {
          visitors: scopeFirst.size,
          storeViewed: countAfter(scopeFirst, lastView),
          converted: countAfter(scopeFirst, lastConv),
          actions: CONVERSION_TYPES.map((c) => ({ key: c.key, label: c.label, visitors: countAfter(scopeFirst, lastByType.get(c.key) ?? new Map()) })),
        }
      : null;

    // ── 기기별 (선택 메뉴 기준) ──
    const devAgg = new Map<string, { clicks: number; visitors: Set<string>; dwellN: number; dwellSum: number }>();
    for (const e of scoped) {
      const dk = e.device && (DEVICES as readonly string[]).includes(e.device) ? e.device : "unknown";
      let a = devAgg.get(dk);
      if (!a) devAgg.set(dk, (a = { clicks: 0, visitors: new Set(), dwellN: 0, dwellSum: 0 }));
      if (e.event_type === "nav_click") {
        a.clicks++;
        if (e.visitor_id) a.visitors.add(e.visitor_id);
      } else if (e.event_type === "dwell" && e.duration_sec != null) {
        a.dwellN++;
        a.dwellSum += Number(e.duration_sec);
      }
    }
    const devices = [...devAgg.entries()]
      .filter(([, a]) => a.clicks > 0)
      .map(([key, a]) => {
        let converted: number | null = null;
        if (conversionAvailable) {
          converted = 0;
          for (const vid of a.visitors) {
            const t = scopeFirst.get(vid);
            if (t != null && (lastConv.get(vid) ?? -1) >= t) converted++;
          }
        }
        return {
          key,
          label: DEVICE_LABEL[key] ?? key,
          clicks: a.clicks,
          visitors: a.visitors.size,
          converted,
          avgDwellSec: a.dwellN ? Math.round((a.dwellSum / a.dwellN) * 10) / 10 : null,
        };
      })
      .sort((a, b) => b.clicks - a.clicks);

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
      home,
      meta: { deviceAvailable, conversionAvailable },
      detail: {
        funnel,
        devices,
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
