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

  // 4. Supabase 프로젝트 정보 (Management API)
  let projectInfo: Record<string, unknown> | null = null;
  let projectInfoError: string | null = null;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

  if (!accessToken) {
    projectInfoError = `SUPABASE_ACCESS_TOKEN 환경변수 없음 (process.env 키 목록: ${Object.keys(process.env).filter(k => k.startsWith("SUPABASE")).join(", ") || "없음"})`;
  } else if (!projectRef) {
    projectInfoError = `NEXT_PUBLIC_SUPABASE_URL에서 project ref 추출 실패 (값: ${supabaseUrl.slice(0, 40)})`;
  } else {
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const body = await res.json();
      if (res.ok) {
        projectInfo = {
          name:      body.name,
          region:    body.region,
          plan:      body.subscription_tier ?? body.plan?.name ?? "—",
          status:    body.status,
          dbVersion: body.db_version,
        };
      } else {
        projectInfoError = `API ${res.status}: ${JSON.stringify(body).slice(0, 120)}`;
      }
    } catch (e) {
      projectInfoError = String(e);
    }
  }

  // 5. DB 테이블 목록 (information_schema — service role key로 접근 가능)
  let tableList: { tableName: string; rowEstimate: number | null }[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tableRows } = await (sb as any)
      .schema("information_schema")
      .from("tables")
      .select("table_name")
      .eq("table_schema", "public")
      .eq("table_type", "BASE TABLE")
      .order("table_name");

    if (Array.isArray(tableRows) && tableRows.length > 0) {
      // 실제 행 수는 counts에서 매핑 (이미 조회한 값 재사용)
      const countMap: Record<string, number | null> = {};
      for (const [key, val] of Object.entries(counts)) {
        countMap[key] = (val as { count: number | null }).count;
      }
      // Management API로 추가 row count 시도 (토큰 있을 때만)
      const relTuples: Record<string, number | null> = { ...countMap };
      if (accessToken && projectRef) {
        try {
          const pgRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `SELECT relname, reltuples::bigint AS cnt FROM pg_class
                      JOIN pg_namespace n ON n.oid = relnamespace
                      WHERE n.nspname = 'public' AND relkind = 'r'`,
            }),
            cache: "no-store",
          });
          if (pgRes.ok) {
            const pgRows = await pgRes.json() as { relname: string; cnt: string }[];
            for (const r of pgRows) relTuples[r.relname] = Number(r.cnt);
          }
        } catch { /* 토큰 없으면 counts 값만 사용 */ }
      }
      tableList = (tableRows as { table_name: string }[]).map(r => ({
        tableName: r.table_name,
        rowEstimate: relTuples[r.table_name] ?? null,
      }));
    }
  } catch { /* 조회 실패 시 빈 배열 */ }

  return NextResponse.json({
    ok: true,
    fetchedAt: new Date().toISOString(),
    connected,
    pingMs,
    counts,
    recentActivity: recentActivity.slice(0, 6),
    projectInfo,
    projectInfoError,
    projectRef,
    tableList,
    hasAccessToken: !!accessToken,
  });
}
