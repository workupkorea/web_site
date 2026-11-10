import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";

const RETENTION_DAYS = 90; // 메뉴분석 로그 보존 기간

// Vercel Cron이 KST 03:00(UTC 18:00)에 호출 — vercel.json의 crons 참고.
// 보존 기간이 지난 nav_events 행을 삭제한다.
// Vercel이 자동으로 붙이는 Authorization: Bearer $CRON_SECRET 헤더로 검증한다.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("nav_events")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: count ?? 0, cutoff });
}
