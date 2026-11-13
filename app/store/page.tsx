import type { Metadata } from "next";
import StoreLocator from "@/components/StoreLocator";
import { getPublicStores } from "@/lib/publicStores";
import { getSiteSection } from "@/lib/site-settings";
import { normalizeStorePage, type StorePageConfig } from "@/lib/store-page";

export const metadata: Metadata = {
  title: "매장 찾기",
  description: "전국 워크업 매장 위치와 운영시간.",
};

export default async function StorePage() {
  const [stores, headerCfg] = await Promise.all([
    getPublicStores(),
    getSiteSection<Partial<StorePageConfig>>("store_page"),
  ]);
  const header = normalizeStorePage(headerCfg);
  return (
    <main>
      <StoreLocator stores={stores} header={header} />
    </main>
  );
}
