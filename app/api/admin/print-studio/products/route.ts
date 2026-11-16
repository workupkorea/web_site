import { getAdminMember } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { readWjumunPrintProducts } from "@/lib/wjumun-sync";
import { parsePrintProducts, PRINT_SEARCH_FIELDS, type PrintSearchField } from "@/lib/print-studio-products";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!(await getAdminMember())) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const params = new URL(req.url).searchParams, query = params.get("q")?.trim() ?? "", field = params.get("field") ?? "name", page = Number(params.get("page") ?? 1);
  if (!query || query.length > 100 || !Object.hasOwn(PRINT_SEARCH_FIELDS, field) || !Number.isInteger(page) || page < 1 || page > 1000) return Response.json({ error: "검색어·검색 구분을 확인해 주세요." }, { status: 400 });
  try {
    const html = await readWjumunPrintProducts(createAdminClient(), query, PRINT_SEARCH_FIELDS[field as PrintSearchField], page);
    const items = parsePrintProducts(html);
    if (!items.length && !/item_list|검색|상품/.test(html)) throw Error("목록 형식을 확인하지 못했습니다.");
    const totalMatch = html.match(/건수\s*:\s*([\d,]+)/), total = totalMatch ? Number(totalMatch[1].replace(/,/g,"")) : null;
    return Response.json({ items, page, hasMore: total !== null ? page * 30 < total : items.length >= 30, fetchedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "W주문 연결에 실패했습니다. 기존 W주문 연동 계정 설정과 로그인 상태를 확인해 주세요." }, { status: 502 });
  }
}
