import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function isMissingTable(msg: string): boolean {
  return msg.includes("arrival_sync_logs") && (msg.includes("does not exist") || msg.includes("schema cache"));
}

// GET: 동기화 이력 목록 (최근 순)
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 100));

  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("arrival_sync_logs")
      .select("*")
      .order("synced_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const rows = (data ?? []).map(r => ({
      id: String(r.id),
      syncedAt: r.synced_at,
      durationSec: r.duration_sec ?? 0,
      total: r.total ?? 0,
      byStatus: r.by_status ?? {},
      diff: r.diff ?? [],
      actor: r.actor_name ?? undefined,
      error: r.error ?? undefined,
    }));

    return NextResponse.json({ rows });
  } catch (e: unknown) {
    const msg = (e as Error).message ?? "";
    if (isMissingTable(msg)) {
      return NextResponse.json(
        { error: "arrival_sync_logs 테이블이 없습니다. supabase/migrate_add_arrival_sync_logs.sql 을 실행해주세요.", needsMigration: true, rows: [] },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg || "오류가 발생했습니다.", rows: [] }, { status: 500 });
  }
}

// POST: 동기화 이력 한 건 저장 (성공/실패 모두)
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("arrival_sync_logs")
      .insert([{
        synced_at:    body.syncedAt ?? new Date().toISOString(),
        duration_sec: body.durationSec ?? null,
        total:        body.total ?? 0,
        by_status:    body.byStatus ?? {},
        diff:         body.diff ?? [],
        actor_name:   body.actor ?? null,
        error:        body.error ?? null,
      }])
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, id: String(data.id) });
  } catch (e: unknown) {
    const msg = (e as Error).message ?? "";
    if (isMissingTable(msg)) {
      return NextResponse.json(
        { error: "arrival_sync_logs 테이블이 없습니다. supabase/migrate_add_arrival_sync_logs.sql 을 실행해주세요.", needsMigration: true },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg || "오류가 발생했습니다." }, { status: 500 });
  }
}
