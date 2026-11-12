import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-server";

// 문의 상태 변경(신규/처리중/완료) 및/또는 답변 저장.
// body: { status?, reply? } — reply는 payload의 숨김 키(_reply)에 저장(스키마 변경 불필요).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const supabase = createAdminClient();

  const update: Record<string, unknown> = {};

  if ("status" in body) {
    if (!["new", "processing", "done"].includes(body.status)) {
      return NextResponse.json({ error: "잘못된 상태값입니다." }, { status: 400 });
    }
    update.status = body.status;
  }

  if ("type" in body) {
    if (!["franchise", "wholesale", "support", "product", "group_order"].includes(body.type)) {
      return NextResponse.json({ error: "잘못된 유형입니다." }, { status: 400 });
    }
    update.type = body.type;
  }

  if (typeof body.reply === "string") {
    // 기존 payload를 읽어 답변만 병합(고객 입력값은 보존).
    const { data: cur, error: readErr } = await supabase
      .from("inquiries").select("payload").eq("id", id).maybeSingle();
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
    const payload = { ...((cur?.payload ?? {}) as Record<string, unknown>) };
    if (body.reply.trim()) {
      payload._reply = body.reply;
      payload._repliedAt = new Date().toISOString();
    } else {
      delete payload._reply;
      delete payload._repliedAt;
    }
    update.payload = payload;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없습니다." }, { status: 400 });
  }

  const { error } = await supabase.from("inquiries").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    action: "update",
    resource: "inquiries",
    resourceLabel: "문의",
    targetId: id,
  });
  return NextResponse.json({ ok: true });
}

// 문의 삭제
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from("inquiries").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    action: "delete",
    resource: "inquiries",
    resourceLabel: "문의",
    targetId: id,
  });
  return NextResponse.json({ ok: true });
}
