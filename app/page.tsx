import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import Hero from "@/components/Hero";
import HomeBrandLogos from "@/components/HomeBrandLogos";
import HomeNewArrivals from "@/components/HomeNewArrivals";
import HomeCategoryGrid from "@/components/HomeCategoryGrid";
import HomeEditorial from "@/components/HomeEditorial";
import HomePeopleTeaser from "@/components/HomePeopleTeaser";
import HomeInstagramFeed from "@/components/HomeInstagramFeed";
import PopupBanner from "@/components/PopupBanner";
import StoreSearchBar from "@/components/StoreSearchBar";
import { getHomeLayout } from "@/lib/home-layout-server";
import type { HomeSectionKey } from "@/lib/home-layout";

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

// 섹션 키 → 렌더러. 관리자 "메인 배치"에서 정한 순서·노출에 따라 렌더링된다.
const SECTION_RENDERERS: Record<HomeSectionKey, () => ReactNode> = {
  hero: () => <Hero />,
  brandLogos: () => <HomeBrandLogos />,
  newArrivals: () => <HomeNewArrivals />,
  category: () => <HomeCategoryGrid />,
  editorial: () => <HomeEditorial />,
  people: () => <HomePeopleTeaser />,
  instagram: () => <HomeInstagramFeed />,
};

export default async function Home() {
  const { sections } = await getHomeLayout();
  const visibleSections = sections.filter((s) => s.visible);
  // 히어로가 꺼져 있으면(관리자가 숨김 처리) 따라붙을 자리가 없으니, 대신 맨 위에서 노출한다.
  const heroVisible = visibleSections.some((s) => s.key === "hero");
  return (
    <main>
      {/* 팝업은 오버레이라 배치 대상에서 제외 — 항상 렌더 */}
      <PopupBanner />
      {!heroVisible && <StoreSearchBar />}
      {visibleSections
        .map((s) => {
          const render = SECTION_RENDERERS[s.key];
          if (!render) return null;
          return (
            <Fragment key={s.key}>
              {render()}
              {/* 매장 검색창은 배너(히어로) 바로 아래 배치 — 관리자가 배치를 바꿔도 항상 히어로 다음에 따라온다 */}
              {s.key === "hero" && <StoreSearchBar />}
            </Fragment>
          );
        })}
    </main>
  );
}
