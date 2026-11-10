import type { Metadata } from "next";
import PopupBanner from "@/components/PopupBanner";
import { getHomeLayout } from "@/lib/home-layout-server";
import { getHomeMagazine } from "@/lib/home-magazine-server";
import HomeSections from "@/components/HomeSections";

export const metadata: Metadata = {
  title: "WORKUP — 일하는 사람을 위한 옷",
  description: "현장부터 일상까지. 기능성 워크웨어 브랜드 워크업. 전국 매장에서 직접 체험하세요.",
  openGraph: {
    title: "WORKUP — 일하는 사람을 위한 옷",
    description: "현장부터 일상까지. 기능성 워크웨어 브랜드 워크업.",
    type: "website",
    siteName: "WORKUP",
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

export default async function Home() {
  const [{ sections }, magazine] = await Promise.all([getHomeLayout(), getHomeMagazine()]);
  return (
    <main>
      {/* 팝업은 오버레이라 배치 대상에서 제외 — 항상 렌더 */}
      <PopupBanner />
      <HomeSections sections={sections} magazine={magazine} />
    </main>
  );
}
