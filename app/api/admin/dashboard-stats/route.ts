import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createAdminClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const [
    { count: totalMembers },
    { count: todayMembers },
    { count: totalInquiries },
    { count: todayInquiries },
    { count: totalProducts },
    { count: totalStores },
    { data: recentInquiries },
  ] = await Promise.all([
    sb.from("members").select("*", { count: "exact", head: true }),
    sb.from("members").select("*", { count: "exact", head: true }).gte("created_at", todayIso),
    sb.from("inquiries").select("*", { count: "exact", head: true }),
    sb.from("inquiries").select("*", { count: "exact", head: true }).gte("created_at", todayIso),
    sb.from("products").select("*", { count: "exact", head: true }),
    sb.from("stores").select("*", { count: "exact", head: true }),
    sb.from("inquiries").select("id, name, type, created_at, status").order("created_at", { ascending: false }).limit(5),
  ]);

  return NextResponse.json({
    ok: true,
    fetchedAt: new Date().toISOString(),
    members:   { total: totalMembers ?? 0, today: todayMembers ?? 0 },
    inquiries: { total: totalInquiries ?? 0, today: todayInquiries ?? 0 },
    products:  { total: totalProducts ?? 0 },
    stores:    { total: totalStores ?? 0 },
    recentInquiries: recentInquiries ?? [],
  });
}
