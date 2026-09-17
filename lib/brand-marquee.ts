import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase-server";

// 메인 페이지 "브랜드 로고" 무한 마퀴 — 브랜드 자체 정보(이름·로고)는
// brands 테이블(=/admin/catalog/brands)이 유일한 소스이며, 여기서는
// 이 마퀴에 노출할 브랜드 id 목록·순서·섹션 제목만 site_settings에 저장한다.

export type BrandMarqueeConfig = {
  title: string;
  brandIds: string[];
};

export const DEFAULT_BRAND_MARQUEE_CONFIG: BrandMarqueeConfig = {
  title: "워크업에서 만나는 브랜드",
  brandIds: [],
};

export type BrandLogoItem = { id: string; name: string; logoUrl: string };

export async function getBrandMarquee(): Promise<{ title: string; items: BrandLogoItem[] }> {
  // brands 테이블은 /admin/catalog/brands에서 수시로 바뀌므로(로고 교체 등) 캐시하지 않고 매 요청 조회한다.
  noStore();
  try {
    const supabase = createAdminClient();
    const [{ data: settingsRow }, { data: brands }] = await Promise.all([
      supabase.from("site_settings").select("config").eq("section", "brand_marquee").maybeSingle(),
      supabase.from("brands").select("id, name, logo_url"),
    ]);

    const config = (settingsRow?.config as Partial<BrandMarqueeConfig>) ?? {};
    const title = config.title || DEFAULT_BRAND_MARQUEE_CONFIG.title;
    const brandIds = Array.isArray(config.brandIds) ? config.brandIds : [];

    const byId = new Map((brands ?? []).map((b) => [String(b.id), b as { id: string | number; name: string; logo_url: string | null }]));
    const items: BrandLogoItem[] = brandIds
      .map((id) => byId.get(String(id)))
      .filter((b): b is { id: string | number; name: string; logo_url: string } => !!b?.logo_url)
      .map((b) => ({ id: String(b.id), name: b.name, logoUrl: b.logo_url }));

    return { title, items };
  } catch {
    return { title: DEFAULT_BRAND_MARQUEE_CONFIG.title, items: [] };
  }
}
