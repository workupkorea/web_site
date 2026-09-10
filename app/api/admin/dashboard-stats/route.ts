import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createAdminClient();

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const weekIso = weekStart.toISOString();

  const [
    { count: totalMembers },
    { count: weekMembers },
    { count: totalInquiries },
    { count: weekInquiries },
    { count: totalProducts },
    { count: activeStores },
    { data: recentInquiries },
  ] = await Promise.all([
    sb.from("members").select("*", { count: "exact", head: true }),
    sb.from("members").select("*", { count: "exact", head: true }).gte("created_at", weekIso),
    sb.from("inquiries").select("*", { count: "exact", head: true }),
    sb.from("inquiries").select("*", { count: "exact", head: true }).gte("created_at", weekIso),
    sb.from("products").select("*", { count: "exact", head: true }),
    sb.from("stores").select("*", { count: "exact", head: true }).eq("is_active", true),
    sb.from("inquiries").select("id, name, type, created_at, status").order("created_at", { ascending: false }).limit(5),
  ]);

  return NextResponse.json({
    ok: true,
    fetchedAt: new Date().toISOString(),
    members:   { total: totalMembers ?? 0, week: weekMembers ?? 0 },
    inquiries: { total: totalInquiries ?? 0, week: weekInquiries ?? 0 },
    products:  { total: totalProducts ?? 0 },
    stores:    { active: activeStores ?? 0 },
    recentInquiries: recentInquiries ?? [],
  });
}
