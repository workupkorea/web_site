import type { Metadata } from "next";
import { FranchiseForm } from "@/components/PartnershipForms";
import PartnershipLayout from "@/components/PartnershipLayout";
import FranchiseGuide from "@/components/FranchiseGuide";
import { normalizePartnership, type PartnershipConfig } from "@/data/partnership";
import { normalizeFranchiseGuide, type FranchiseGuideConfig } from "@/data/franchise-guide";
import { getSiteSection } from "@/lib/site-settings";
import { getActiveStoreCount } from "@/lib/publicStores";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteSection<PartnershipConfig>("partnership_page");
  const info = normalizePartnership(config).franchise;
  return { title: info.seo_title, description: info.seo_desc };
}

export default async function FranchisePage() {
  const [pConfig, gRaw, storeCount] = await Promise.all([
    getSiteSection<PartnershipConfig>("partnership_page"),
    getSiteSection<FranchiseGuideConfig>("franchise_guide"),
    getActiveStoreCount(),
  ]);
  const info = normalizePartnership(pConfig).franchise;
  const guide = normalizeFranchiseGuide(gRaw);

  return (
    <PartnershipLayout
      info={info}
      boardType="franchise"
      guide={<FranchiseGuide embedded config={guide} storeCount={storeCount} />}
    >
      <FranchiseForm config={info.form} guideConfig={guide} storeCount={storeCount} />
    </PartnershipLayout>
  );
}
