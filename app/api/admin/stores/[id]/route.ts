import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin, getAdminMember } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-server";
import { geocodeAddress } from "@/lib/geocode";
import { appendHistory, diffStore, isOpenPending } from "@/lib/store-changes";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("stores").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const supabase = createAdminClient();

  // 좌표 결정: 폼에는 좌표 입력이 없으므로 기존 좌표를 보존한다.
  // 주소가 바뀌었으면 지오코딩으로 새 좌표를 구하고, 실패 시 기존 좌표 유지.
  let lat = body.lat ?? null;
  let lng = body.lng ?? null;
  if (lat == null || lng == null) {
    const { data: existing } = await supabase
      .from("stores")
      .select("lat, lng, address")
      .eq("id", id)
      .single();
    if (existing) {
      if (existing.address === body.address && existing.lat != null) {
        lat = existing.lat;
        lng = existing.lng;
      } else {
        const geo = await geocodeAddress(body.address);
        if (geo) { lat = geo.lat; lng = geo.lng; }
        else { lat = existing.lat; lng = existing.lng; }
      }
    }
  }

  // 비활성 → 활성 전환 시각을 기록해 '신규(NEW)' 뱃지 기준에 반영한다.
  // 오픈 예정일이 미래면 비공개로 저장하고, 오픈일 당일에 자동 활성화된다(activateDueStores).
  const openDate: string | null = body.open_date || null;
  const nextActive = isOpenPending(openDate) ? false : (body.is_active ?? true);
  const { data: prev } = await supabase.from("stores").select("*").eq("id", id).single();
  const reactivated = prev?.is_active === false && nextActive === true;

  const nowIso = new Date().toISOString();
  const fields = {
    name: body.name,
    store_code: body.store_code || null,
    ship_name: body.ship_name?.trim() || null,
    region: body.region ?? "",
    address: body.address,
    hours: body.hours ?? "",
    phone: body.phone ?? "",
    description: body.description ?? "",
    image_urls: body.image_urls ?? [],
    brands: body.brands ?? [],
    parking: body.parking ?? false,
    is_active: nextActive,
    page_active: body.page_active ?? true,
    store_type: body.store_type ?? "직영점",
    kakao_channel_url: body.kakao_channel_url ?? "",
    store_url: body.store_url ?? "",
    sort_order: body.sort_order ?? 0,
    product_ids: body.product_ids ?? [],
    open_date: openDate,
  };
  // 수정 내역(무엇이 바뀌었는지) 기록 — 변경이 있을 때만, 최근 20건 유지
  const changes = prev ? diffStore(prev, fields) : [];
  const admin = changes.length > 0 ? await getAdminMember() : null;

  const { data, error } = await supabase
    .from("stores")
    .update({
      ...(reactivated ? { activated_at: nowIso } : {}),
      ...fields,
      lat,
      lng,
      updated_at: nowIso,
      ...(changes.length > 0
        ? { change_history: appendHistory(prev?.change_history, { at: nowIso, by: admin?.name ?? "알 수 없음", changes }) }
        : {}),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    action: "update",
    resource: "stores",
    resourceLabel: "매장",
    target: data?.name ?? body?.name,
    targetId: id,
  });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from("stores").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    action: "delete",
    resource: "stores",
    resourceLabel: "매장",
    targetId: id,
  });
  return NextResponse.json({ ok: true });
}
