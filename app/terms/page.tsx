import type { Metadata } from "next";
import { getSiteSection } from "@/lib/site-settings";
import { DEFAULT_TERMS, normalizeLegal, type LegalConfig } from "@/lib/site-content";
import LegalDoc from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "이용약관 — 워크업",
  description: "워크업(WORKUP) 웹사이트 이용약관.",
};

export default async function TermsPage() {
  const cfg = await getSiteSection<LegalConfig>("terms_page");
  const content = normalizeLegal(cfg, DEFAULT_TERMS).content;
  return <LegalDoc title="이용약관" content={content} />;
}
