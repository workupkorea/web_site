import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";

// GET /api/admin/stores/push-status
// 지점별 알림(웹푸시) 설정 현황 — 지점 화면에서 "알림받기"를 켠 기기 수와 처음 설정한 일시.
// 구독은 기기(브라우저) 단위라 한 지점에 여러 대가 잡힐 수 있다. 구독 정보(endpoint·키)는 내려주지 않는다.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = createAdminClient();
  const { data, error } = await sb.from("push_subscriptions").select("store_id, created_at");
  // 테이블이 아직 없는 DB(마이그레이션 미적용)에서도 목록 화면이 깨지지 않도록 "확인 불가"로 응답한다.
  if (error) return NextResponse.json({ available: false, stores: {} });

  const stores: Record<number, { count: number; firstAt: string | null }> = {};
  for (const r of data ?? []) {
    const cur = stores[r.store_id] ?? { count: 0, firstAt: null };
    cur.count += 1;
    if (r.created_at && (!cur.firstAt || r.created_at < cur.firstAt)) cur.firstAt = r.created_at;
    stores[r.store_id] = cur;
  }
  return NextResponse.json({ available: true, stores });
}
