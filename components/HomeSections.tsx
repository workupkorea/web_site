import { Fragment, type ReactNode } from "react";
import Hero from "@/components/Hero";
import HomeBrandLogos from "@/components/HomeBrandLogos";
import HomeNewArrivals from "@/components/HomeNewArrivals";
import HomeCategoryGrid from "@/components/HomeCategoryGrid";
import HomeEditorial from "@/components/HomeEditorial";
import HomePeopleTeaser from "@/components/HomePeopleTeaser";
import HomeInstagramFeed from "@/components/HomeInstagramFeed";
import HomeYoutubeLongform from "@/components/HomeYoutubeLongform";
import StoreSearchBar from "@/components/StoreSearchBar";
import HomeMagazine from "@/components/HomeMagazine";
import type { HomeMagazineConfig } from "@/lib/home-magazine";
import { HOME_SUB_EXHIBITION_LABEL } from "@/lib/home-layout";
import type { HeroFilter, HomeSectionKey, HomeSectionLayout } from "@/lib/home-layout";

// 메인 페이지의 섹션 렌더링(배치 순서·노출 반영). 실제 메인(app/page.tsx)과
// 관리자용 "실제 사이트 미리보기"(app/magazine-preview)가 같은 코드를 써서 화면이 어긋나지 않게 한다.
type RenderCtx = { magazine: HomeMagazineConfig; searchBarInMagazine: boolean; heroFilter: HeroFilter; editorialFilter?: HeroFilter };

// 섹션 키 → 렌더러. 관리자 "메인 배치"에서 정한 순서·노출에 따라 렌더링된다.
const SECTION_RENDERERS: Record<HomeSectionKey, (ctx: RenderCtx) => ReactNode> = {
  magazine: ({ magazine, searchBarInMagazine }) => (
    <HomeMagazine config={magazine} afterCover={searchBarInMagazine ? <StoreSearchBar /> : undefined} />
  ),
  hero: ({ heroFilter }) => <Hero heroFilter={heroFilter} />,
  brandLogos: () => <HomeBrandLogos />,
  newArrivals: () => <HomeNewArrivals />,
  category: () => <HomeCategoryGrid />,
  editorial: ({ editorialFilter }) => <HomeEditorial editorialFilter={editorialFilter} />,
  people: () => <HomePeopleTeaser />,
  youtube: () => <HomeYoutubeLongform />,
  instagram: () => <HomeInstagramFeed />,
};

// 클릭 분석(관리자 메뉴 분석)에 표시되는 섹션 이름
const SECTION_NAMES: Record<HomeSectionKey, string> = {
  magazine: "매거진",
  hero: "히어로 배너",
  brandLogos: "브랜드 로고",
  newArrivals: "신상품",
  category: "카테고리",
  editorial: HOME_SUB_EXHIBITION_LABEL,
  people: "피플",
  youtube: "유튜브",
  instagram: "인스타그램",
};

export default function HomeSections({
  sections,
  magazine,
  heroFilter = null,
  editorialFilter,
}: {
  sections: HomeSectionLayout[];
  magazine: HomeMagazineConfig;
  heroFilter?: HeroFilter;
  editorialFilter?: HeroFilter;
}) {
  // 매거진은 배치에서 보이게 했어도 공개 OFF·커버 미입력이면 렌더되지 않으므로 실제 노출 여부로 거른다.
  // 매거진은 메인에 붙이지 않고 단독 페이지(/magazine)로 분리 — 메인 섹션 목록에서는 항상 제외한다.
  const visibleSections = sections.filter((s) => s.visible && s.key !== "magazine");
  const magazineBanner = false;
  // 매장 검색창은 첫 화면(히어로 또는 매거진 커버) 바로 아래에 붙인다 — 둘 중 먼저 나오는 쪽.
  // 둘 다 숨김이면 따라붙을 자리가 없으니 맨 위에서 노출한다.
  const searchBarAnchor = visibleSections.find((s) => s.key === "hero" || (s.key === "magazine" && magazineBanner))?.key;
  const ctx: RenderCtx = { magazine, searchBarInMagazine: searchBarAnchor === "magazine", heroFilter, editorialFilter };
  return (
    <>
      {!searchBarAnchor && <StoreSearchBar />}
      {visibleSections.map((s) => {
        const render = SECTION_RENDERERS[s.key];
        if (!render) return null;
        return (
          <Fragment key={s.key}>
            {/* display:contents라 레이아웃 영향 없이 클릭 분석용 섹션 이름만 붙인다 */}
            <div data-home-section={SECTION_NAMES[s.key] ?? s.key} style={{ display: "contents" }}>
              {render(ctx)}
            </div>
            {/* 히어로가 첫 화면이면 검색창은 히어로 다음 (매거진이 첫 화면이면 커버 아래에 매거진이 직접 끼운다) */}
            {s.key === "hero" && searchBarAnchor === "hero" && <StoreSearchBar />}
          </Fragment>
        );
      })}
    </>
  );
}
