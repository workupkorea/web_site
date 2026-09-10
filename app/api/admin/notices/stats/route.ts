import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";

type StoreAgg = { name: string; pass: number; outbound: number };
type StoreStat = { store_id: number; store_name: string; total: number; outbound: number; pass: number };

function toRows(m: Map<number, StoreAgg>): StoreStat[] {
  return [...m.entries()]
    .map(([store_id, v]) => ({ store_id, store_name: v.name, total: v.pass + v.outbound, outbound: v.outbound, pass: v.pass }))
    .sort((a, b) => b.total - a.total);
}

// 캘린더 드릴다운(일별 오픈 목록 + 그날의 지점별 패스 현황)과, 기본 화면에 보여줄
// 전체 누적 지점별 패스 현황을 한 번에 계산한다 — 원본 행을 그대로 가져와 이 라우트에서 집계
// (이 저장소는 별도 통계 테이블/RPC 없이 관리자 목록 페이지들도 전부 클라이언트/서버에서
//  직접 reduce하는 방식이라 동일한 관례를 따른다).
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = createAdminClient();

  // 기본 90일, days=0이면 전체
  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days") ?? "90");
  const sinceDate = days > 0
    ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    : null;

  let noticeQ = sb
    .from("notices")
    .select("id, notice_date, product_id, temp_name, products(id, name)")
    .order("notice_date", { ascending: false })
    .limit(500);
  if (sinceDate) noticeQ = noticeQ.gte("notice_date", sinceDate);

  const { data: notices, error: noticeErr } = await noticeQ;
  if (noticeErr) return NextResponse.json({ error: noticeErr.message }, { status: 500 });

  const noticeDateById = new Map<string, string>();
  const dailyProducts = new Map<string, { id: string; name: string }[]>();
  for (const n of notices ?? []) {
    noticeDateById.set(n.id, n.notice_date);
    const product = n.products as unknown as { id: string; name: string } | null;
    const name = product?.name ?? (n as { temp_name?: string | null }).temp_name ?? "상품 정보 없음";
    const list = dailyProducts.get(n.notice_date) ?? [];
    list.push({ id: product?.id ?? n.product_id ?? n.id, name });
    dailyProducts.set(n.notice_date, list);
  }

  // 전체 활성 지점 목록 — 미응답 지점도 통계에 포함하기 위해 필요
  const { data: allStores } = await sb
    .from("stores")
    .select("id, name")
    .eq("is_active", true);
  const storeNameById = new Map<number, string>((allStores ?? []).map((s) => [s.id, s.name]));

  // 조회된 notices 범위의 ID만 필터링
  const noticeIds = (notices ?? []).map((n) => n.id);
  const { data: entries, error: entryErr } = noticeIds.length > 0
    ? await sb.from("pass_entries").select("notice_id, store_id, status").in("notice_id", noticeIds)
    : { data: [], error: null };
  if (entryErr) return NextResponse.json({ error: entryErr.message }, { status: 500 });

  // notice_id → Set<store_id> (응답한 지점)
  const respondedByNotice = new Map<string, Map<number, string>>();
  for (const e of entries ?? []) {
    const m = respondedByNotice.get(e.notice_id) ?? new Map<number, string>();
    m.set(e.store_id, e.status);
    respondedByNotice.set(e.notice_id, m);
  }

  const overallStoreMap = new Map<number, StoreAgg>();
  const dailyStoreMap = new Map<string, Map<number, StoreAgg>>();

  // 모든 공지 × 모든 지점 조합으로 집계 (미응답 = 출고로 처리)
  const allNotices = notices ?? [];
  const activeStoreIds = [...storeNameById.keys()];

  for (const n of allNotices) {
    const date = n.notice_date;
    const responded = respondedByNotice.get(n.id) ?? new Map<number, string>();
    const dayMap = dailyStoreMap.get(date) ?? new Map<number, StoreAgg>();

    for (const sid of activeStoreIds) {
      const storeName = storeNameById.get(sid) ?? "알 수 없음";
      const status = responded.get(sid) ?? "출고"; // 미응답 = 출고

      // daily
      const cur = dayMap.get(sid) ?? { name: storeName, pass: 0, outbound: 0 };
      if (status === "패스") cur.pass += 1; else cur.outbound += 1;
      dayMap.set(sid, cur);

      // overall
      const overall = overallStoreMap.get(sid) ?? { name: storeName, pass: 0, outbound: 0 };
      if (status === "패스") overall.pass += 1; else overall.outbound += 1;
      overallStoreMap.set(sid, overall);
    }

    dailyStoreMap.set(date, dayMap);
  }

  const daily = [...dailyProducts.entries()]
    .map(([notice_date, products]) => ({
      notice_date,
      count: products.length,
      products,
      byStore: toRows(dailyStoreMap.get(notice_date) ?? new Map()),
    }))
    .sort((a, b) => b.notice_date.localeCompare(a.notice_date));

  return NextResponse.json({ daily, byStore: toRows(overallStoreMap) });
}
