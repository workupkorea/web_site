import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-server";
import { pickFixLogBody } from "@/lib/fix-logs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = pickFixLogBody(await req.json().catch(() => ({})));
  if (!body.title) return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("fix_logs")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ action: "update", resource: "fix-logs", resourceLabel: "오류 수정 내역", target: body.title, targetId: id });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const sb = createAdminClient();
  const { data: existing } = await sb.from("fix_logs").select("title").eq("id", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });

  const { error } = await sb.from("fix_logs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ action: "delete", resource: "fix-logs", resourceLabel: "오류 수정 내역", target: existing.title, targetId: id });
  return NextResponse.json({ ok: true });
}
