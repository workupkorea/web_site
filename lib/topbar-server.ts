import { unstable_cache } from "next/cache";
import { createAdminClient } from "./supabase-server";
import { normalizeTopbar, DEFAULT_TOPBAR, type TopbarConfig } from "./topbar";

// 루트 레이아웃(전역)에서 쓰이므로 unstable_cache로 감싸 정적 렌더링을 유지하고,
// 저장 시 site-settings PUT 의 revalidateTag("topbar")로 즉시 갱신한다.
const getTopbarConfigCached = unstable_cache(
  async (): Promise<TopbarConfig> => {
    const { data } = await createAdminClient()
      .from("site_settings")
      .select("config")
      .eq("section", "topbar")
      .maybeSingle();
    return normalizeTopbar(data?.config as Partial<TopbarConfig> | null);
  },
  ["topbar-config"],
  { tags: ["topbar"], revalidate: 300 }
);

export async function getTopbarConfig(): Promise<TopbarConfig> {
  try {
    return await getTopbarConfigCached();
  } catch {
    return DEFAULT_TOPBAR;
  }
}
