import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-server";

type Params = { params: Promise<{ id: string }> };

// 링크 복사 기록 — 히스토리에 남긴다.
export async function POST(_req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const sb = createAdminClient();
  const { data } = await sb.from("stores").select("name").eq("id", id).single();
  await logAudit({
    action: "update",
    resource: "stores",
    resourceLabel: "지점 링크",
    target: data?.name,
    targetId: id,
    summary: `지점 링크 '${data?.name}' 복사`,
  });
  return NextResponse.json({ ok: true });
}

// 특정 지점의 링크 재발급·복사 히스토리 — audit_logs에서 resource='stores', target_id=id 조회
export async function GET(_req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("audit_logs")
    .select("id, summary, actor_name, created_at")
    .eq("resource", "stores")
    .eq("target_id", id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    if (error.message.includes("audit_logs") && error.message.includes("does not exist")) {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
