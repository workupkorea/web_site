import { createAdminClient } from "@/lib/supabase-server";
import { stores as staticStores, type Store } from "@/data/stores";

// 주소 정규화(공백 제거) — 1차 정확 매칭 키
const normAddr = (s: string) => (s ?? "").replace(/\s+/g, "").trim();

// 도로명 핵심 키 — 도 이름(경상북도↔경북)·괄호·층수·상호 표기 차이를 흡수한 2차 매칭 키
const PROVINCE: Record<string, string> = {
  경상북도: "경북", 경상남도: "경남", 전라북도: "전북", 전라남도: "전남",
  충청북도: "충북", 충청남도: "충남", 경기도: "경기", 강원특별자치도: "강원",
  강원도: "강원", 제주특별자치도: "제주", 제주도: "제주", 서울특별시: "서울",
  부산광역시: "부산", 대구광역시: "대구", 인천광역시: "인천", 광주광역시: "광주",
  대전광역시: "대전", 울산광역시: "울산", 세종특별자치시: "세종",
};
function coreAddr(s: string): string {
  let a = (s ?? "").trim();
  for (const [k, v] of Object.entries(PROVINCE)) a = a.replace(k, v);
  a = a.replace(/\([^)]*\)/g, ""); // 괄호 내용 제거
  const cut = a.indexOf("워크업"); // 상호 이후 제거
  if (cut > 0) a = a.slice(0, cut);
  a = a.replace(/,/g, "").replace(/\s+/g, ""); // 콤마·공백 제거
  a = a.replace(/(\d+)(층|충|호)$/, ""); // 끝의 N층/N충/N호 제거
  a = a.replace(/지하\d*$/, "");
  return a;
}

// 활성(공개) 매장 수 — 창업안내 '계약 가맹수'에 실시간 반영. 조회 실패 시 0.
export async function getActiveStoreCount(): Promise<number> {
  try {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from("stores")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

// 공개(고객용) 매장 목록의 단일 소스 = DB.
// - DB의 활성 매장을 사용 (관리자 수정이 즉시 반영). 비어 있으면 고객 화면도 빈다.
// - 좌표가 비어 있으면 정적 데이터(data/stores.ts)에서 "주소"로 매칭해 보정
//   (id는 업로드 순서에 따라 어긋나므로 주소로 매칭해야 정확함)
// - DB 조회 자체가 실패(장애)할 때만 정적 데이터로 폴백
export async function getPublicStores(region?: string): Promise<Store[]> {
  try {
    const supabase = createAdminClient();
    let query = supabase
      .from("stores")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (region) query = query.eq("region", region);
    const { data, error } = await query;
    if (error) return staticStores; // DB 장애 시에만 폴백
    if (!data) return [];

    // 매장별로 지정된 판매제품(product_ids)을 한 번에 조회해 매핑
    const allProductIds = Array.from(
      new Set(data.flatMap((s) => (Array.isArray(s.product_ids) ? s.product_ids : [])))
    );
    const productMap = new Map<string, { id: string; name: string; image_url: string | null }>();
    if (allProductIds.length > 0) {
      const { data: productRows } = await supabase
        .from("products")
        .select("id, name, image_url")
        .in("id", allProductIds);
      (productRows ?? []).forEach((p: { id: string; name: string; image_url: string | null }) => productMap.set(p.id, p));
    }

    const byAddr = new Map(staticStores.map((s) => [normAddr(s.address), s]));
    const byCore = new Map(staticStores.map((s) => [coreAddr(s.address), s]));
    return data.map((s): Store => {
      // 1차 정확 매칭 → 2차 도로명 핵심 키 매칭
      const fb = byAddr.get(normAddr(s.address)) ?? byCore.get(coreAddr(s.address));
      const products = (Array.isArray(s.product_ids) ? s.product_ids : [])
        .map((id: string) => productMap.get(id))
        .filter((p: { id: string; name: string; image_url: string | null } | undefined): p is { id: string; name: string; image_url: string | null } => Boolean(p));
      return {
        id: s.id,
        name: s.name,
        address: s.address,
        lat: s.lat ?? fb?.lat ?? 0,
        lng: s.lng ?? fb?.lng ?? 0,
        hours: s.hours ?? "",
        phone: s.phone ?? "",
        pageActive: s.page_active ?? true,
        // NEW 기준일 = 등록일과 (비활성→)재활성일 중 더 최근
        ...(s.created_at || s.activated_at
          ? { createdAt: [s.created_at, s.activated_at].filter(Boolean).sort().pop() as string }
          : {}),
        ...(products.length > 0 ? { products } : {}),
      };
    });
  } catch {
    return staticStores;
  }
}
