import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-server";

const VALID_TYPES = ["franchise", "wholesale", "support", "product", "group_order"];

// 접수된 문의 목록 조회 (관리자)
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // 'franchise' | 'wholesale' | null(전체)

  const supabase = createAdminClient();
  // Supabase(PostgREST)는 요청당 최대 1000행만 반환하므로,
  // 1000행씩 페이지로 나눠 전량을 모은다.
  const PAGE = 1000;
  const all: unknown[] = [];
  for (let from = 0; from <= 100000; from += PAGE) {
    let query = supabase.from("inquiries").select("*").order("created_at", { ascending: false }).range(from, from + PAGE - 1);
    if (type === "franchise" || type === "wholesale") query = query.eq("type", type);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break; // 마지막 페이지
  }
  return NextResponse.json(all);
}

// 여러 문의의 게시판 유형 일괄 변경 (관리자). body: { ids: string[], type }
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  const type = body.type;

  if (!ids.length) return NextResponse.json({ error: "선택된 문의가 없습니다." }, { status: 400 });
  if (ids.length > 2000) return NextResponse.json({ error: "한 번에 이동할 수 있는 문의는 2000건까지입니다." }, { status: 400 });
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: "잘못된 유형입니다." }, { status: 400 });

  const supabase = createAdminClient();
  // URL 길이 제한을 피하기 위해 id를 청크로 나눠 업데이트한다.
  const CHUNK = 100;
  let updated = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await supabase.from("inquiries").update({ type }).in("id", ids.slice(i, i + CHUNK));
    if (error) return NextResponse.json({ error: error.message, updated }, { status: 500 });
    updated += Math.min(CHUNK, ids.length - i);
  }
  await logAudit({
    action: "update",
    resource: "inquiries",
    resourceLabel: "문의",
    summary: `문의 ${updated}건 유형 변경 → ${type}`,
  });
  return NextResponse.json({ ok: true, updated });
}

// 여러 문의 일괄 삭제 (관리자). body: { ids: string[] }
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];

  if (!ids.length) return NextResponse.json({ error: "선택된 문의가 없습니다." }, { status: 400 });
  if (ids.length > 2000) return NextResponse.json({ error: "한 번에 삭제할 수 있는 문의는 2000건까지입니다." }, { status: 400 });

  const supabase = createAdminClient();
  // URL 길이 제한을 피하기 위해 id를 청크로 나눠 삭제한다.
  const CHUNK = 100;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await supabase.from("inquiries").delete().in("id", ids.slice(i, i + CHUNK));
    if (error) return NextResponse.json({ error: error.message, deleted }, { status: 500 });
    deleted += Math.min(CHUNK, ids.length - i);
  }
  await logAudit({
    action: "delete",
    resource: "inquiries",
    resourceLabel: "문의",
    summary: `문의 ${deleted}건 일괄 삭제`,
  });
  return NextResponse.json({ ok: true, deleted });
}
