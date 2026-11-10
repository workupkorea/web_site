import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";

type RpcRow = {
  nav_label: string;
  click_count: number;
  visitor_count: number;
  dwell_count: number;
  avg_dwell_sec: number | null;
};

// GET /api/admin/analytics/nav?days=30 | from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;

  let sinceIso: string;
  let untilIso: string | null = null;
  if (fromParam && toParam && dateRe.test(fromParam) && dateRe.test(toParam)) {
    sinceIso = new Date(`${fromParam}T00:00:00+09:00`).toISOString();
    untilIso = new Date(`${toParam}T23:59:59.999+09:00`).toISOString();
  } else {
    const days = Number(searchParams.get("days") ?? "30");
    sinceIso = new Date(days > 0 ? Date.now() - days * 86400000 : 0).toISOString();
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("aggregate_nav_events", {
      since_iso: sinceIso,
      until_iso: untilIso ?? undefined,
    });
    if (error) throw new Error(error.message);

    const rows = ((data ?? []) as RpcRow[]).map((r) => ({
      label: r.nav_label,
      clicks: Number(r.click_count ?? 0),
      visitors: Number(r.visitor_count ?? 0),
      dwellSamples: Number(r.dwell_count ?? 0),
      avgDwellSec: r.avg_dwell_sec == null ? null : Number(r.avg_dwell_sec),
    }));
    rows.sort((a, b) => b.clicks - a.clicks);
    const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);

    return NextResponse.json({ rows, totalClicks });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
