import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";

// "기존 상품에서 선택" 목록 — 지점 출고 패스로 이전에 등록했던 마감패스 전용 상품(temp_name)만,
// 이름 기준으로 중복 제거해 최신순으로 보여준다. products 테이블과는 무관하다.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = createAdminClient();
  const run = (cols: string) =>
    sb.from("notices").select(cols).not("temp_name", "is", null).order("created_at", { ascending: false });
  // 세로 플래그 컬럼이 아직 없는 DB에서도 동작하도록 실패 시 기존 컬럼만으로 재조회한다.
  let { data, error } = await run("temp_name, temp_image_url, temp_tagline, temp_image_portrait, created_at");
  if (error) ({ data, error } = await run("temp_name, temp_image_url, temp_tagline, created_at"));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Set<string>();
  const result: { temp_name: string; temp_image_url: string | null; temp_tagline: string | null; temp_image_portrait: boolean }[] = [];
  type Row = { temp_name: string | null; temp_image_url: string | null; temp_tagline: string | null; temp_image_portrait?: boolean };
  for (const row of (data ?? []) as unknown as Row[]) {
    if (!row.temp_name || seen.has(row.temp_name)) continue;
    seen.add(row.temp_name);
    result.push({
      temp_name: row.temp_name,
      temp_image_url: row.temp_image_url,
      temp_tagline: row.temp_tagline,
      temp_image_portrait: Boolean(row.temp_image_portrait),
    });
  }
  return NextResponse.json(result);
}
