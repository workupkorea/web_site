import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";

const ALLOWED = new Set(["nav_click", "dwell"]);
const MAX_DWELL_SEC = 1800; // 30분 초과는 방치된 탭으로 보고 상한 처리

// POST /api/track/nav — 상단 메뉴 클릭·체류시간 1건 기록 (공개, 개인정보 없음)
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const eventType = String(body?.event_type ?? "");
  const label = String(body?.nav_label ?? "").slice(0, 100);
  if (!ALLOWED.has(eventType) || !label) return NextResponse.json({ ok: false }, { status: 400 });

  let duration: number | null = null;
  if (eventType === "dwell") {
    const n = Math.round(Number(body?.duration_sec));
    if (!Number.isFinite(n) || n < 1) return new NextResponse(null, { status: 204 });
    duration = Math.min(n, MAX_DWELL_SEC);
  }

  try {
    const supabase = createAdminClient();
    await supabase.from("nav_events").insert({
      event_type: eventType,
      nav_label: label,
      href: String(body?.href ?? "").slice(0, 300),
      path: String(body?.path ?? "").slice(0, 300),
      duration_sec: duration,
      visitor_id: String(body?.visitor_id ?? "").slice(0, 64),
    });
  } catch {
    /* 기록 실패는 조용히 무시 */
  }
  return new NextResponse(null, { status: 204 });
}
