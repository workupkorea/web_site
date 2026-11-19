import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isSuperAdmin } from "@/lib/admin-auth";

// 이벤트별 소요 비용(제품 단가·추가 제품)을 서버에 저장한다. PC가 달라도 같은 값을 본다.
// site_settings 의 "giveaway_costs" 섹션 하나({ [이벤트ID]: 비용 }) 를 사용하므로 별도 마이그레이션이 필요 없다.
const SECTION = "giveaway_costs";

interface CostExtra { name: string; qty: number; price: number }
interface CostData { prices: Record<string, number>; extras: CostExtra[] }

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), 1e9) : 0);

export async function GET() {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await createAdminClient().from("site_settings").select("config").eq("section", SECTION).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ costs: data?.config ?? {} });
}

export async function PUT(req: Request) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { id?: unknown; cost?: { prices?: unknown; extras?: unknown } } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!/^[\w-]{1,60}$/.test(id) || !body?.cost) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const prices: Record<string, number> = {};
  if (body.cost.prices && typeof body.cost.prices === "object") {
    for (const [k, v] of Object.entries(body.cost.prices as Record<string, unknown>).slice(0, 50)) prices[k.slice(0, 80)] = num(v);
  }
  const extras: CostExtra[] = Array.isArray(body.cost.extras)
    ? (body.cost.extras as Partial<CostExtra>[]).slice(0, 30).map((x) => ({ name: String(x?.name ?? "").slice(0, 80), qty: num(x?.qty), price: num(x?.price) }))
    : [];

  const db = createAdminClient();
  const { data, error: readErr } = await db.from("site_settings").select("config").eq("section", SECTION).maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  const all = { ...((data?.config as Record<string, CostData>) ?? {}), [id]: { prices, extras } };
  const { error } = await db.from("site_settings").upsert({ section: SECTION, config: all, updated_at: new Date().toISOString() }, { onConflict: "section" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
