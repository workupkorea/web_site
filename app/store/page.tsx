import type { Metadata } from "next";
import StoreLocator from "@/components/StoreLocator";
import { getPublicStores } from "@/lib/publicStores";
import { getSiteSection } from "@/lib/site-settings";
import { normalizeStorePage, type StorePageConfig } from "@/lib/store-page";

export const metadata: Metadata = {
  title: "전국 매장 안내",
  description: "전국 워크업 매장 위치와 운영시간, 전화·길찾기 정보를 확인하세요.",
  alternates: { canonical: "/store" },
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
