import type { Metadata } from "next";
import { getSiteSection } from "@/lib/site-settings";
import { DEFAULT_PRIVACY, normalizeLegal, type LegalConfig } from "@/lib/site-content";
import LegalDoc from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "워크업 개인정보처리방침.",
};

export default async function PrivacyPage() {
  const cfg = await getSiteSection<LegalConfig>("privacy_page");
  const content = normalizeLegal(cfg, DEFAULT_PRIVACY).content;
  return <LegalDoc title="개인정보처리방침" content={content} />;
}
