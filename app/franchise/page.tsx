import type { Metadata } from "next";
import FranchiseGuide from "@/components/FranchiseGuide";
import { getSiteSection } from "@/lib/site-settings";
import { getActiveStoreCount } from "@/lib/publicStores";
import { normalizeFranchiseGuide, type FranchiseGuideConfig } from "@/data/franchise-guide";

export const metadata: Metadata = {
  title: "창업안내 — 국내 최초 워크웨어 아울렛",
  description:
    "워크업 가맹·창업 안내. 국내 최초 워크웨어 아울렛, 연매출 15억+, 마진율 31.5~35%, 상권 보호 5km, 초기비용 부담 감소.",
};

export default async function FranchiseGuidePage() {
  const [raw, storeCount] = await Promise.all([
    getSiteSection<FranchiseGuideConfig>("franchise_guide"),
    getActiveStoreCount(),
  ]);
  return <FranchiseGuide config={normalizeFranchiseGuide(raw)} storeCount={storeCount} />;
}
