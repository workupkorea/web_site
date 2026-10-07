import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";
import { getBulkShipStoreIds } from "@/lib/wjumun-sync";

// GET /api/admin/stores/pass-matrix
// ?date=YYYY-MM-DD          → 특정 날짜
// ?from=YYYY-MM-DD&to=...   → 날짜 범위
// ?days=N                   → 최근 N일 (기본 14)
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const dateParam = searchParams.get("date");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const daysParam = Number(searchParams.get("days") ?? "14");

  const sb = createAdminClient();

  const [{ data: allStores, error: storesErr }, bulkIds] = await Promise.all([
    sb
      .from("stores")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    getBulkShipStoreIds(sb),
  ]);
  if (storesErr) return NextResponse.json({ error: storesErr.message }, { status: 500 });
  // 일괄출고금지점은 패스 현황 매트릭스에서 제외
  const stores = (allStores ?? []).filter((s) => !bulkIds.has(s.id));

  let noticeQuery = sb
    .from("notices")
    .select("id, notice_date, status, products(name), temp_name")
    .order("notice_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (dateParam && dateRe.test(dateParam)) {
    noticeQuery = noticeQuery.eq("notice_date", dateParam);
  } else if (fromParam && toParam && dateRe.test(fromParam) && dateRe.test(toParam)) {
    noticeQuery = noticeQuery.gte("notice_date", fromParam).lte("notice_date", toParam);
  } else {
    const since = daysParam > 0
      ? new Date(Date.now() - daysParam * 86400000).toISOString().slice(0, 10)
      : "2000-01-01";
    noticeQuery = noticeQuery.gte("notice_date", since);
  }

  const { data: notices, error: noticesErr } = await noticeQuery;
  if (noticesErr) return NextResponse.json({ error: noticesErr.message }, { status: 500 });

  if (!notices || notices.length === 0) {
    return NextResponse.json({ stores: stores ?? [], dates: [] });
  }

  const noticeIds = notices.map((n) => n.id);
  const { data: entries, error: entriesErr } = await sb
    .from("pass_entries")
    .select("notice_id, store_id, status, updated_at")
    .in("notice_id", noticeIds);
  if (entriesErr) return NextResponse.json({ error: entriesErr.message }, { status: 500 });

  const entryMap = new Map<string, Map<number, { status: string; updated_at: string | null }>>();
  for (const e of entries ?? []) {
    let m = entryMap.get(e.notice_id);
    if (!m) { m = new Map(); entryMap.set(e.notice_id, m); }
    m.set(e.store_id, { status: e.status, updated_at: e.updated_at });
  }

  const byDate = new Map<string, typeof notices>();
  for (const n of notices) {
    const list = byDate.get(n.notice_date) ?? [];
    list.push(n);
    byDate.set(n.notice_date, list);
  }

  const storeList = (stores ?? []) as { id: number; name: string }[];

  const dates = [...byDate.entries()]
    .map(([date, dateNotices]) => ({
      date,
      notices: dateNotices.map((n) => {
        const product = n.products as unknown as { name: string } | null;
        const storeEntries: Record<number, { status: string; updated_at: string | null } | null> = {};
        for (const s of storeList) {
          const e = entryMap.get(n.id)?.get(s.id);
          storeEntries[s.id] = e ?? null;
        }
        return {
          notice_id: n.id,
          notice_status: n.status as "대기" | "진행중" | "마감",
          product_name: product?.name ?? n.temp_name ?? "상품 정보 없음",
          entries: storeEntries,
        };
      }),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json({ stores: storeList, dates });
}
