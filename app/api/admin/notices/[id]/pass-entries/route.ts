import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";
import { getBulkShipStoreIds } from "@/lib/wjumun-sync";

type Params = { params: Promise<{ id: string }> };

// 전체 활성 지점을 기준으로, 아직 패스 접수가 없는 지점은 기본값(출고)으로 채워 반환한다.
export async function GET(_req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const sb = createAdminClient();

  const [{ data: allStores, error: storesErr }, bulkIds] = await Promise.all([
    sb
      .from("stores")
      .select("id, name, store_code")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    getBulkShipStoreIds(sb),
  ]);
  if (storesErr) return NextResponse.json({ error: storesErr.message }, { status: 500 });
  // 일괄출고금지점은 공지별 출고/패스 현황에서 제외
  const stores = (allStores ?? []).filter((s) => !bulkIds.has(s.id));

  const { data: entries, error: entriesErr } = await sb
    .from("pass_entries")
    .select("store_id, status, updated_at")
    .eq("notice_id", id);
  if (entriesErr) return NextResponse.json({ error: entriesErr.message }, { status: 500 });

  const byStore = new Map((entries ?? []).map((e) => [e.store_id, e]));
  const rows = (stores ?? []).map((s) => {
    const e = byStore.get(s.id);
    return {
      store_id: s.id,
      store_name: s.name,
      store_code: s.store_code ?? null,
      status: e?.status ?? "출고",
      updated_at: e?.updated_at ?? null,
    };
  });

  return NextResponse.json(rows);
}
