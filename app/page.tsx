import type { Metadata } from "next";
import PopupBanner from "@/components/PopupBanner";
import { getHomeLayout } from "@/lib/home-layout-server";
import { getHomeMagazine } from "@/lib/home-magazine-server";
import HomeSections from "@/components/HomeSections";
import HomeClickTracker from "@/components/HomeClickTracker";
import JsonLd from "@/components/JsonLd";
import { siteUrl } from "@/lib/site";

const HOME_TITLE = "워크업 WORKUP 공식 사이트";
const HOME_DESCRIPTION =
  "워크업 공식 사이트. 작업복·안전화부터 일상에서 입는 캐주얼까지, 신상품과 전국 매장 정보를 확인하세요.";

export const metadata: Metadata = {
  // 레이아웃 title 템플릿("%s｜워크업 WORKUP")이 붙어 브랜드명이 중복되지 않도록 absolute 사용
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    type: "website",
    siteName: "워크업 WORKUP",
    locale: "ko_KR",
    url: "/",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "WORKUP",
      },
    ],
  },
};

// 사이트 코드에서 실제 사용 중인 공식 채널 (확인된 값만 sameAs에 포함)
const OFFICIAL_CHANNELS = [
  "https://www.instagram.com/workup_official_kr/",
  "https://www.youtube.com/@WorkUp_official",
  "https://brand.naver.com/workup_offcial",
];

// 브랜드·사이트 정보 구조화 데이터 (Organization + WebSite)
const brandLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "워크업",
      alternateName: "WORKUP",
      url: siteUrl,
      sameAs: OFFICIAL_CHANNELS,
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "워크업 WORKUP",
      alternateName: ["워크업", "WORKUP"],
      inLanguage: "ko-KR",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
  ],
};

export default async function Home() {
  const [{ sections }, magazine] = await Promise.all([getHomeLayout(), getHomeMagazine()]);
  return (
    <main>
      <JsonLd data={brandLd} />
      {/* 페이지 대표 H1 — 브랜드명만 담은 스크린리더용 제목. 시즌 기획전 제목은 H2로 내려간다. */}
      <h1 className="sr-only">워크업 WORKUP</h1>
      {/* 팝업은 오버레이라 배치 대상에서 제외 — 항상 렌더 */}
      <PopupBanner />
      <HomeClickTracker />
      <HomeSections sections={sections} magazine={magazine} />
    </main>
  );
}
