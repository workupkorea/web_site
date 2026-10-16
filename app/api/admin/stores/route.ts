import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-server";
import { geocodeAddress } from "@/lib/geocode";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const supabase = createAdminClient();

  // 좌표가 없으면 주소로 자동 변환(지오코딩) — 지도 표시용
  let lat = body.lat ?? null;
  let lng = body.lng ?? null;
  if ((lat == null || lng == null) && body.address) {
    const geo = await geocodeAddress(body.address);
    if (geo) { lat = geo.lat; lng = geo.lng; }
  }

  const { data, error } = await supabase
    .from("stores")
    .insert({
      name: body.name,
      store_code: body.store_code || null,
      ship_name: body.ship_name?.trim() || null,
      region: body.region ?? "",
      address: body.address,
      lat,
      lng,
      hours: body.hours ?? "",
      phone: body.phone ?? "",
      description: body.description ?? "",
      image_urls: body.image_urls ?? [],
      brands: body.brands ?? [],
      parking: body.parking ?? false,
      is_active: body.is_active ?? true,
      page_active: body.page_active ?? true,
      store_type: body.store_type ?? "직영점",
      kakao_channel_url: body.kakao_channel_url ?? "",
      store_url: body.store_url ?? "",
      sort_order: body.sort_order ?? 0,
      product_ids: body.product_ids ?? [],
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    action: "create",
    resource: "stores",
    resourceLabel: "매장",
    target: data?.name ?? body?.name,
    targetId: data?.id,
  });
  return NextResponse.json(data);
}
