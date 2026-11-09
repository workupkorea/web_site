import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isSuperAdmin } from "@/lib/admin-auth";

// 이벤트(추첨 1건)별 상세 기록 — 추첨 당시의 참여자 명단·댓글을 site_settings 의 "giveaway_event_<id>" 섹션에 쌓아 둔다.
// 요약(이름·당첨자 등)은 giveaway_state 의 history 에 있고, 용량이 큰 명단만 이 라우트로 분리해 저장한다.
const sectionOf = (id: string) => `giveaway_event_${id}`;
const validId = (id: string) => /^[a-z0-9]{6,40}$/.test(id);

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!validId(id)) return NextResponse.json({ error: "잘못된 ID" }, { status: 400 });
  const { data, error } = await createAdminClient().from("site_settings").select("config").eq("section", sectionOf(id)).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data?.config ?? { participants: [] });
}

export async function PUT(req: Request, { params }: Ctx) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!validId(id)) return NextResponse.json({ error: "잘못된 ID" }, { status: 400 });
  const body = (await req.json().catch(() => null)) as { participants?: unknown; totalComments?: unknown } | null;
  if (!body || !Array.isArray(body.participants)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const config = {
    savedAt: new Date().toISOString(),
    totalComments: typeof body.totalComments === "number" ? body.totalComments : body.participants.length,
    participants: body.participants.slice(0, 5000),
  };
  const { error } = await createAdminClient()
    .from("site_settings")
    .upsert({ section: sectionOf(id), config, updated_at: new Date().toISOString() }, { onConflict: "section" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!validId(id)) return NextResponse.json({ error: "잘못된 ID" }, { status: 400 });
  const { error } = await createAdminClient().from("site_settings").delete().eq("section", sectionOf(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
