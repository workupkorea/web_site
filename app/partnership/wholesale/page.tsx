import type { Metadata } from "next";
import { WholesaleForm } from "@/components/PartnershipForms";
import PartnershipLayout from "@/components/PartnershipLayout";
import { normalizePartnership, type PartnershipConfig } from "@/data/partnership";
import { getSiteSection } from "@/lib/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteSection<PartnershipConfig>("partnership_page");
  const info = normalizePartnership(config).wholesale;
  return { title: { absolute: info.seo_title }, description: info.seo_desc, alternates: { canonical: "/partnership/wholesale" } };
}

export default async function WholesalePage() {
  const config = await getSiteSection<PartnershipConfig>("partnership_page");
  const info = normalizePartnership(config).wholesale;

  return (
    <PartnershipLayout info={info} boardType="wholesale">
      <WholesaleForm config={info.form} />
    </PartnershipLayout>
  );
}
