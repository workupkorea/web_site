import { unstable_cache } from "next/cache";
import { createAdminClient } from "./supabase-server";
import { DEFAULT_HEADER_NAV, normalizeHeaderNav, type HeaderNavConfig } from "./header-nav";

// 헤더 메뉴 설정을 site_settings(section="header-nav")에서 읽는다.
// topbar 와 동일하게 unstable_cache 로 감싸 정적 렌더링을 유지하고,
// 관리자가 저장하면 site-settings PUT 핸들러가 revalidateTag("header-nav")로 즉시 갱신한다.
const getHeaderNavConfigCached = unstable_cache(
  async (): Promise<HeaderNavConfig> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("site_settings")
      .select("config")
      .eq("section", "header-nav")
      .maybeSingle();
    return normalizeHeaderNav(data?.config as Partial<HeaderNavConfig> | null);
  },
  ["header-nav-config"],
  { tags: ["header-nav"], revalidate: 300 }
);

// DB 에러 시 폴백을 캐시에 저장하지 않기 위해 try-catch를 캐시 바깥에 둔다.
export async function getHeaderNavConfig(): Promise<HeaderNavConfig> {
  try {
    return await getHeaderNavConfigCached();
  } catch {
    return DEFAULT_HEADER_NAV;
  }
}

/** PRODUCTS 메뉴 비공개(내부 정책) 여부 — 상품 계열 페이지의 noindex·sitemap 제외 기준 */
export async function isProductsHidden(): Promise<boolean> {
  try {
    const nav = await getHeaderNavConfig();
    return nav.items.find((it) => it.href === "/products")?.isVisible === false;
  } catch {
    return false;
  }
}
