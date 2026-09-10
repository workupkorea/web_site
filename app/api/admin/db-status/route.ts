import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const TABLES = [
  { key: "arrival_products",  label: "입고 상품" },
  { key: "arrival_overrides", label: "입고 오버라이드" },
  { key: "members",           label: "회원" },
  { key: "stores",            label: "매장" },
  { key: "site_settings",     label: "사이트 설정" },
  { key: "audit_logs",        label: "활동 로그" },
];

export async function GET() {
  const sb = createAdminClient();
  const start = Date.now();

  // 1. 연결 확인 (ping)
  let connected = false;
  let pingMs = 0;
  try {
    await sb.from("members").select("id").limit(1);
    pingMs = Date.now() - start;
    connected = true;
  } catch {
    pingMs = Date.now() - start;
  }

  // 2. 테이블별 레코드 수
  const counts: Record<string, { label: string; count: number | null }> = {};
  await Promise.all(
    TABLES.map(async ({ key, label }) => {
      try {
        const { count } = await sb.from(key).select("*", { count: "exact", head: true });
        counts[key] = { label, count: count ?? 0 };
      } catch {
        counts[key] = { label, count: null };
      }
    })
  );

  // 3. 최근 활동 (updated_at 있는 테이블)
  const recentActivity: { table: string; label: string; updatedAt: string; id: unknown }[] = [];
  const activityTables = [
    { key: "arrival_products",  label: "입고 상품",  col: "synced_at" },
    { key: "members",           label: "회원",       col: "updated_at" },
    { key: "audit_logs",        label: "활동 로그",  col: "created_at" },
    { key: "arrival_overrides", label: "입고 오버라이드", col: "updated_at" },
  ];
  await Promise.all(
    activityTables.map(async ({ key, label, col }) => {
      try {
        const { data } = await sb
          .from(key)
          .select(`id, ${col}`)
          .order(col, { ascending: false })
          .limit(1);
        if (data?.[0]?.[col]) {
          recentActivity.push({ table: key, label, updatedAt: data[0][col], id: data[0].id });
        }
      } catch { /* 컬럼 없으면 무시 */ }
    })
  );
  recentActivity.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // 4. Supabase 프로젝트 정보 (Management API — SUPABASE_ACCESS_TOKEN 있을 때만)
  let projectInfo: Record<string, unknown> | null = null;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

  if (accessToken && projectRef) {
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (res.ok) {
        const p = await res.json();
        projectInfo = {
          name:   p.name,
          region: p.region,
          plan:   p.subscription_tier ?? p.plan?.name ?? "—",
          status: p.status,
          dbVersion: p.db_version,
        };
      }
    } catch { /* 무시 */ }
  }

  return NextResponse.json({
    ok: true,
    fetchedAt: new Date().toISOString(),
    connected,
    pingMs,
    counts,
    recentActivity: recentActivity.slice(0, 6),
    projectInfo,
    projectRef,
  });
}
