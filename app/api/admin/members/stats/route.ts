import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createAdminClient();
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const thisMonthStart = `${thisMonth}-01T00:00:00+09:00`;

  const [
    { count: total },
    { count: active },
    { count: thisMonthCount },
    { data: monthly },
  ] = await Promise.all([
    sb.from("members").select("*", { count: "exact", head: true }).neq("status", "withdrawn"),
    sb.from("members").select("*", { count: "exact", head: true }).eq("status", "active"),
    sb.from("members").select("*", { count: "exact", head: true }).neq("status", "withdrawn").gte("created_at", thisMonthStart),
    sb.rpc("member_monthly_stats"),
  ]);

  return NextResponse.json({
    total: total ?? 0,
    active: active ?? 0,
    thisMonth: thisMonthCount ?? 0,
    byMonth: (monthly ?? []) as { month: string; count: number }[],
  });
}
