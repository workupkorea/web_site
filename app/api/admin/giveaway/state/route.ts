import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isSuperAdmin } from "@/lib/admin-auth";

// 댓글추첨기 상태(이벤트 추첨 이력 + 비팔로우·체리피커 표시 목록)를 서버에 저장한다.
// site_settings 의 "giveaway_state" 섹션 하나를 사용하므로 별도 마이그레이션이 필요 없다.
// 여러 PC(회사/집)에서 같은 이력을 보도록 브라우저가 아닌 서버에 둔다.
const SECTION = "giveaway_state";

export async function GET() {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await createAdminClient().from("site_settings").select("config").eq("section", SECTION).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data?.config ?? { history: [], flags: {} });
}

export async function PUT(req: Request) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { history?: unknown; flags?: unknown } | null;
  if (!body || !Array.isArray(body.history) || typeof body.flags !== "object" || body.flags === null) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const config = { history: body.history.slice(0, 500), flags: body.flags };
  const { error } = await createAdminClient()
    .from("site_settings")
    .upsert({ section: SECTION, config, updated_at: new Date().toISOString() }, { onConflict: "section" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
