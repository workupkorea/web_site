import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-server";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = createAdminClient();
  const base = "id, product_id, notice_date, status, opened_at, closed_at, created_at, description, extra_images, temp_name, temp_image_url, temp_tagline, badge, products(id, name, image_url, registration_status)";
  const run = (cols: string) =>
    sb.from("notices").select(cols).order("notice_date", { ascending: false }).order("created_at", { ascending: false });
  // temp_image_portrait 컬럼이 아직 없는 DB에서도 목록이 열리도록 실패 시 기존 컬럼만으로 재조회한다.
  let { data, error } = await run(`${base}, temp_image_portrait`);
  if (error) ({ data, error } = await run(base));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  // 정식 상품(product_id) 또는 마감패스 전용(temp_name) 둘 중 하나는 반드시 있어야 한다.
  if (!body?.product_id && !body?.temp_name) {
    return NextResponse.json({ error: "product_id 또는 temp_name이 필요합니다." }, { status: 400 });
  }
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("notices")
    .insert({
      product_id: body.product_id ?? null,
      temp_name: body.product_id ? null : body.temp_name,
      temp_image_url: body.product_id ? null : body.temp_image_url ?? null,
      temp_tagline: body.product_id ? null : body.temp_tagline ?? null,
      notice_date: body.notice_date ?? new Date().toISOString().slice(0, 10),
      status: "대기",
      description: body.description ?? null,
      extra_images: Array.isArray(body.extra_images) ? body.extra_images : [],
      badge: body.badge ?? null,
      // 컬럼 미적용 DB에서 등록이 깨지지 않도록 true일 때만 보낸다.
      ...(body.product_id || !body.temp_image_portrait ? {} : { temp_image_portrait: true }),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    action: "create",
    resource: "notices",
    resourceLabel: "공지",
    target: body.product_name ?? body.temp_name ?? data?.product_id,
    targetId: data?.id,
  });
  return NextResponse.json(data);
}
