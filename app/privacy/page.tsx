import type { Metadata } from "next";
import { getSiteSection } from "@/lib/site-settings";
import { DEFAULT_PRIVACY, normalizeLegal, type LegalConfig } from "@/lib/site-content";
import LegalDoc from "@/components/LegalDoc";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "개인정보처리방침",
  description: "워크업 웹사이트 개인정보처리방침.",
  path: "/privacy",
});

export default async function PrivacyPage() {
  const cfg = await getSiteSection<LegalConfig>("privacy_page");
  const content = normalizeLegal(cfg, DEFAULT_PRIVACY).content;
  return <LegalDoc title="개인정보처리방침" content={content} />;
}
