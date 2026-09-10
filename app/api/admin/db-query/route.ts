import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }

  const { query } = await req.json();
  if (!query?.trim()) {
    return NextResponse.json({ error: "쿼리를 입력하세요" }, { status: 400 });
  }

  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const projectRef   = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

  if (!accessToken) {
    return NextResponse.json({
      error: "SUPABASE_ACCESS_TOKEN 없음\n\nSQL 에디터는 Supabase Management API 개인 액세스 토큰이 필요합니다.\n서비스 롤 키(SUPABASE_SERVICE_ROLE_KEY)와 다른 별도 토큰입니다.\n\n발급: https://supabase.com/dashboard/account/tokens\n발급 후 Vercel 환경변수에 SUPABASE_ACCESS_TOKEN 이름으로 추가 후 재배포하세요.",
    }, { status: 500 });
  }
  if (!projectRef) {
    return NextResponse.json({ error: "NEXT_PUBLIC_SUPABASE_URL에서 project ref 추출 실패" }, { status: 500 });
  }

  const start = Date.now();
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });

    const body = await res.json();
    const elapsedMs = Date.now() - start;

    if (!res.ok) {
      return NextResponse.json({ error: body?.message ?? JSON.stringify(body), elapsedMs }, { status: 400 });
    }

    return NextResponse.json({ ok: true, rows: body, elapsedMs });
  } catch (e) {
    return NextResponse.json({ error: String(e), elapsedMs: Date.now() - start }, { status: 500 });
  }
}
