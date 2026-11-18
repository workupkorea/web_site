import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isSuperAdmin } from "@/lib/admin-auth";

// 댓글추첨기 "진행 중 작업" 임시 저장 — 불러온 댓글·추첨 조건을 서버에 둬서 페이지를 벗어났다 와도(PC가 달라도) 이어 쓴다.
// 추첨 확정 시 지워진다. site_settings 의 "giveaway_draft" 섹션 하나를 사용하므로 별도 마이그레이션이 필요 없다.
const SECTION = "giveaway_draft";
const MAX_ROWS = 20000;

export async function GET() {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await createAdminClient().from("site_settings").select("config").eq("section", SECTION).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft: data?.config ?? null });
}

export async function PUT(req: Request) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { draft?: Record<string, unknown> } | null;
  const d = body?.draft;
  if (!d || typeof d !== "object") return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  if (Array.isArray(d.apiRows) && d.apiRows.length > MAX_ROWS) d.apiRows = d.apiRows.slice(0, MAX_ROWS);
  const { error } = await createAdminClient()
    .from("site_settings")
    .upsert({ section: SECTION, config: d, updated_at: new Date().toISOString() }, { onConflict: "section" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { error } = await createAdminClient().from("site_settings").delete().eq("section", SECTION);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
