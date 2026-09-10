import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createAdminClient();

  const now = new Date();

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 6);
  weekAgo.setHours(0, 0, 0, 0);
  const weekAgoIso = weekAgo.toISOString();

  // 입고예정: 오늘 ~ 7일 후
  const todayStr = now.toISOString().slice(0, 10);
  const weekLater = new Date(now);
  weekLater.setDate(weekLater.getDate() + 7);
  const weekLaterStr = weekLater.toISOString().slice(0, 10);

  const [
    { count: totalMembers },
    { count: weekMembers },
    { count: totalInquiries },
    { count: weekInquiries },
    { count: activeStores },
    { count: weekArrival },
  ] = await Promise.all([
    sb.from("members").select("*", { count: "exact", head: true }),
    sb.from("members").select("*", { count: "exact", head: true }).gte("created_at", weekAgoIso),
    sb.from("inquiries").select("*", { count: "exact", head: true }),
    sb.from("inquiries").select("*", { count: "exact", head: true }).gte("created_at", weekAgoIso),
    sb.from("stores").select("*", { count: "exact", head: true }).eq("is_active", true),
    sb.from("arrival_products")
      .select("*", { count: "exact", head: true })
      .eq("status", "입고예정")
      .gte("arrival_date", todayStr)
      .lte("arrival_date", weekLaterStr),
  ]);

  const { data: recentInquiries } = await sb
    .from("inquiries")
    .select("id, name, type, created_at, status")
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    ok: true,
    fetchedAt: new Date().toISOString(),
    members:   { total: totalMembers ?? 0, week: weekMembers ?? 0 },
    inquiries: { total: totalInquiries ?? 0, week: weekInquiries ?? 0 },
    stores:    { active: activeStores ?? 0 },
    arrival:   { weekCount: weekArrival ?? 0 },
    recentInquiries: recentInquiries ?? [],
  });
}
