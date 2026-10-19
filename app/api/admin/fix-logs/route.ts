import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { getAdminMember } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-server";
import { FIX_LOG_FIELDS, pickFixLogBody } from "@/lib/fix-logs";

// 오류 수정 내역 조회/등록. 필터: target, q(제목·증상·원인 검색), dateStart, dateEnd(발생일 기준) · 페이지네이션
function needsMigration(msg: string) {
  return msg.includes("fix_logs") && (msg.includes("does not exist") || msg.includes("schema cache"));
}
const MIGRATION_ERROR = {
  error: "fix_logs 테이블이 없습니다. supabase/migrate_add_fix_logs.sql 을 실행해주세요.",
  needsMigration: true,
};

export async function GET(req: Request) {
  if (!(await getAdminMember())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const target = searchParams.get("target");
  const q = searchParams.get("q")?.trim();
  const dateStart = searchParams.get("dateStart");
  const dateEnd = searchParams.get("dateEnd");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 20));

  try {
    const sb = createAdminClient();
    let query = sb
      .from("fix_logs")
      .select("*", { count: "exact" })
      .order("occurred_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (target && target !== "all") query = query.eq("target", target);
    if (q) query = query.or(`title.ilike.%${q}%,symptom.ilike.%${q}%,cause.ilike.%${q}%`);
    if (dateStart) query = query.gte("occurred_on", dateStart);
    if (dateEnd) query = query.lte("occurred_on", dateEnd);

    const from = (page - 1) * pageSize;
    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [], total: count ?? 0, page, pageSize });
  } catch (e: unknown) {
    const msg = (e as Error).message ?? "";
    if (needsMigration(msg)) return NextResponse.json(MIGRATION_ERROR, { status: 503 });
    return NextResponse.json({ error: msg || "오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await getAdminMember();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = pickFixLogBody(await req.json().catch(() => ({})));
  if (!body.title) return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("fix_logs")
    .insert({ ...body, author_id: String(admin.id), author_name: admin.name })
    .select(FIX_LOG_FIELDS)
    .single();
  if (error) {
    if (needsMigration(error.message)) return NextResponse.json(MIGRATION_ERROR, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await logAudit({ action: "create", resource: "fix-logs", resourceLabel: "오류 수정 내역", target: body.title, targetId: data?.id });
  return NextResponse.json(data);
}
