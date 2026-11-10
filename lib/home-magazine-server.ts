import { unstable_cache } from "next/cache";
import { createAdminClient } from "./supabase-server";
import { HOME_MAGAZINE_SECTION, normalizeHomeMagazine, type HomeMagazineConfig } from "./home-magazine";

// 메인 캠페인 매거진 설정을 site_settings(section="home_magazine")에서 읽는다.
// 홈은 최고 트래픽 구간이라 unstable_cache로 감싸고,
// 관리자 저장 시 site-settings PUT 의 revalidateTag("home_magazine")로 즉시 갱신된다.
const getHomeMagazineCached = unstable_cache(
  async (): Promise<unknown> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("site_settings")
      .select("config")
      .eq("section", HOME_MAGAZINE_SECTION)
      .maybeSingle();
    return data?.config ?? null;
  },
  ["home-magazine"],
  { tags: [HOME_MAGAZINE_SECTION], revalidate: 300 }
);

export async function getHomeMagazine(): Promise<HomeMagazineConfig> {
  try {
    return normalizeHomeMagazine(await getHomeMagazineCached());
  } catch {
    // DB 실패 시 비공개 기본값 → 메인에 렌더되지 않음(기존 섹션만 노출)
    return normalizeHomeMagazine(null);
  }
}
