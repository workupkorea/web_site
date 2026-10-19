import { unstable_cache } from "next/cache";
import { createAdminClient } from "./supabase-server";
import { normalizeHomeLayout, type HomeLayoutConfig } from "./home-layout";

// 메인 배치 설정을 site_settings(section="home_layout")에서 읽는다.
// 전역(메인 페이지)에서 쓰이므로 unstable_cache로 감싸고,
// 저장 시 site-settings PUT 의 revalidateTag("home_layout")로 즉시 갱신한다.
const getHomeLayoutCached = unstable_cache(
  async (): Promise<HomeLayoutConfig> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("site_settings")
      .select("config")
      .eq("section", "home_layout")
      .maybeSingle();
    return normalizeHomeLayout(data?.config);
  },
  ["home-layout"],
  { tags: ["home_layout"], revalidate: 300 }
);

export async function getHomeLayout(): Promise<HomeLayoutConfig> {
  try {
    // 캐시된 값이 구버전이어도 새로 추가된 섹션이 바로 보이도록 반환 시점에 한 번 더 정규화한다.
    return normalizeHomeLayout(await getHomeLayoutCached());
  } catch {
    return normalizeHomeLayout(null);
  }
}
