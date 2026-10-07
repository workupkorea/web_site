import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-server";
import { sendPushToAllStores } from "@/lib/push";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("notices")
    .select("id, product_id, notice_date, status, opened_at, closed_at, created_at, description, extra_images, temp_name, temp_image_url, temp_tagline, badge, products(id, name, image_url, tagline, registration_status)")
    .eq("id", id)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "공지를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(data);
}

// 잘못 만든 공지 삭제 — 마감된 공지만 삭제 가능(진행 중인 공지를 실수로 지우는 것 방지).
// pass_entries는 ON DELETE CASCADE로 함께 정리된다.
export async function DELETE(_req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const sb = createAdminClient();
  const { data: existing } = await sb
    .from("notices")
    .select("id, status, products(name)")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "공지를 찾을 수 없습니다." }, { status: 404 });
  if (existing.status !== "마감") {
    return NextResponse.json({ error: "마감된 공지만 삭제할 수 있습니다." }, { status: 400 });
  }
  const { error } = await sb.from("notices").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const productName = (existing.products as unknown as { name: string } | null)?.name;
  await logAudit({
    action: "delete",
    resource: "notices",
    resourceLabel: "공지",
    target: productName ?? null,
    targetId: id,
  });
  return NextResponse.json({ ok: true });
}

// 공지 상태 변경(대기/진행중/마감) 및/또는 공지별 추가 설명·사진 수정.
// - status만 보내면 상태 전환(실수로 잘못 만든/오픈한 공지를 바로잡는 용도).
// - description/extra_images를 보내면 정식등록 상품 공지에 한해 대표 사진 아래에 덧붙는 내용만 수정(상품 자체는 불변).
export async function PATCH(req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const sb = createAdminClient();
  const patch: Record<string, unknown> = {};
  let summary = "";

  if (body.status !== undefined) {
    const status = body.status as string;
    if (!["대기", "진행중", "마감"].includes(status)) {
      return NextResponse.json({ error: "유효하지 않은 상태입니다." }, { status: 400 });
    }
    patch.status = status;
    if (status === "진행중") {
      patch.opened_at = new Date().toISOString();
      // 대기 등록 후 며칠 지나 오픈하는 경우, 공지일자를 등록일이 아니라 실제 오픈일로 맞춘다.
      const { data: existing } = await sb.from("notices").select("status").eq("id", id).maybeSingle();
      if (existing?.status === "대기") {
        patch.notice_date = new Date().toISOString().slice(0, 10);
      }
    }
    if (status === "마감") patch.closed_at = new Date().toISOString();
    // 대기로 되돌릴 때는 지점 응답(출고/패스) 초기화 — 재오픈 시 처음부터 다시 받는다.
    if (status === "대기") {
      await sb.from("pass_entries").delete().eq("notice_id", id);
    }
    summary = `수동 상태 변경 → ${status}`;
  }
  if (body.description !== undefined) {
    patch.description = body.description || null;
    summary = summary || "공지 추가 설명·사진 수정";
  }
  if (body.extra_images !== undefined) {
    patch.extra_images = Array.isArray(body.extra_images) ? body.extra_images : [];
    summary = summary || "공지 추가 설명·사진 수정";
  }
  // 마감패스 전용(product_id 없음) 공지의 이름·썸네일·설명 수정.
  if (body.temp_name !== undefined) {
    patch.temp_name = body.temp_name || null;
    summary = summary || "마감패스 상품 정보 수정";
  }
  if (body.temp_image_url !== undefined) {
    patch.temp_image_url = body.temp_image_url || null;
    summary = summary || "마감패스 상품 정보 수정";
  }
  if (body.temp_image_portrait !== undefined) {
    patch.temp_image_portrait = Boolean(body.temp_image_portrait);
    summary = summary || "마감패스 상품 정보 수정";
  }
  if (body.temp_tagline !== undefined) {
    patch.temp_tagline = body.temp_tagline || null;
    summary = summary || "마감패스 상품 정보 수정";
  }
  if (body.badge !== undefined) {
    patch.badge = body.badge || null;
    summary = summary || "공지 뱃지 수정";
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "수정할 내용이 없습니다." }, { status: 400 });
  }

  const { data, error } = await sb.from("notices").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    action: "update",
    resource: "notices",
    resourceLabel: "공지",
    targetId: id,
    summary,
  });
  if (patch.status === "진행중") {
    await sendPushToAllStores({
      title: "지점 출고 패스",
      body: "공지가 열렸습니다. 출고·패스 여부를 확인해 주세요.",
    }).catch(() => {});
  }
  return NextResponse.json(data);
}
