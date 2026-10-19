import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-server";

// POST /api/admin/stores/import — Excel 파싱 결과(배열)를 신규 insert / ID 기준 수정(upsert)
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  // Excel 업로드
  const rows = Array.isArray(body) ? body : [];
  if (rows.length === 0) return NextResponse.json({ error: "데이터가 없습니다." }, { status: 400 });

  const supabase = createAdminClient();

  // 좌표(lat/lng)·사진(image_urls)은 엑셀에 없으므로 payload에서 제외한다.
  // → 신규는 DB 기본값, 수정은 기존 값이 그대로 보존됨.
  const toRow = (r: Record<string, unknown>, i: number) => ({
    name: r.name,
    region: r.region || extractRegion(String(r.address ?? "")),
    address: r.address,
    hours: r.hours ?? "",
    phone: r.phone ?? "",
    description: r.description ?? "",
    brands: r.brands ? String(r.brands).split(";").map((b: string) => b.trim()).filter(Boolean) : [],
    parking: String(r.parking).toLowerCase() === "true" || String(r.parking) === "1",
    is_active: String(r.is_active).toLowerCase() !== "false",
    store_type: r.store_type || "직영점",
    kakao_channel_url: r.kakao_channel_url ?? "",
    store_url: r.store_url ?? "",
    sort_order: r.sort_order !== undefined && String(r.sort_order).trim() !== "" ? Number(r.sort_order) : i,
  });

  const hasId = (r: Record<string, unknown>) =>
    r.id !== undefined && r.id !== null && String(r.id).trim() !== "";

  // ID 있는 행 → 수정(upsert), 없는 행 → 신규(insert)
  const updates = rows.filter(hasId).map((r: Record<string, unknown>, i: number) => ({ id: Number(r.id), ...toRow(r, i) }));
  const inserts = rows.filter((r: Record<string, unknown>) => !hasId(r)).map((r: Record<string, unknown>, i: number) => ({ ...toRow(r, i), page_active: false })); // 신규 지점은 스토어 페이지 비노출이 기본

  if (updates.length > 0) {
    const { error } = await supabase.from("stores").upsert(updates, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (inserts.length > 0) {
    const { error } = await supabase.from("stores").insert(inserts);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    action: updates.length > 0 ? "update" : "create",
    resource: "stores",
    resourceLabel: "매장",
    summary: `매장 엑셀 업로드 — 신규 ${inserts.length}건 · 수정 ${updates.length}건`,
  });
  return NextResponse.json({ ok: true, count: updates.length + inserts.length, updated: updates.length, inserted: inserts.length });
}

function extractRegion(address: string): string {
  const m = address.match(/^(서울|부산|대구|인천|광주|대전|울산|세종|경기도?|강원도?|충북|충청북도|충남|충청남도|전북|전라북도|전남|전라남도|경북|경상북도|경남|경상남도|제주도?)/);
  if (!m) return "";
  const r = m[1];
  if (r.startsWith("경기")) return "경기";
  if (r.startsWith("강원")) return "강원";
  if (r.startsWith("충북") || r.startsWith("충청북")) return "충북";
  if (r.startsWith("충남") || r.startsWith("충청남")) return "충남";
  if (r.startsWith("전북") || r.startsWith("전라북")) return "전북";
  if (r.startsWith("전남") || r.startsWith("전라남")) return "전남";
  if (r.startsWith("경북") || r.startsWith("경상북")) return "경북";
  if (r.startsWith("경남") || r.startsWith("경상남")) return "경남";
  if (r.startsWith("제주")) return "제주";
  return r;
}
