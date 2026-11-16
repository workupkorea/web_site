import { getAdminMember } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { PRINT_BUCKET } from "@/lib/print-studio";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!(await getAdminMember())) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const asset = new URL(req.url).searchParams.get("asset");
  if (asset && !/^[0-9a-f]{64}\.(png|jpg)$/.test(asset)) return new Response("Not found", { status: 404 });
  try {
    const { data: body, error } = await createAdminClient().storage.from(PRINT_BUCKET).download(asset ? `shared/photos/${asset}` : "shared/catalog.json");
    if (error || !body) return Response.json({ error: "저장된 상품 자료를 불러오지 못했습니다. W주문 실시간 검색을 사용해 주세요." }, { status: 503 });
    return new Response(body, { headers: { "Content-Type":asset ? asset.endsWith(".png")?"image/png":"image/jpeg" : "application/json; charset=utf-8", "Cache-Control": "private, max-age=300", "X-Content-Type-Options":"nosniff" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
