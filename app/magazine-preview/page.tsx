import { notFound } from "next/navigation";
import HomeSections from "@/components/HomeSections";
import HomeMagazine from "@/components/HomeMagazine";
import StoreSearchBar from "@/components/StoreSearchBar";
import Hero from "@/components/Hero";
import { isAdmin } from "@/lib/admin-auth";
import { getHomeLayout } from "@/lib/home-layout-server";
import { getHomeMagazine } from "@/lib/home-magazine-server";
import { fillMagazinePlaceholders } from "@/lib/home-magazine";

// 관리자 전용 "실제 사이트 미리보기" — 공개 사이트와 같은 헤더·푸터·하단 탭바(모바일) 안에서
// 저장된 캠페인 매거진을 보여준다. 비어 있는 자리는 회색 안내 블록(자리 이름·권장 비율·크기)으로 채운다.
//   ?view=magazine (기본) : 매거진만
//   ?view=home            : 실제 메인 배치(순서·노출 설정) 그대로 + 매거진 포함
// 운영(production)에서는 관리자 로그인 상태에서만 열린다. 검색엔진에는 노출하지 않는다.
export const dynamic = "force-dynamic";
export const metadata = { title: "매거진 미리보기", robots: { index: false, follow: false } };

export default async function MagazinePreviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV === "production" && !(await isAdmin())) notFound();

  const { view } = await searchParams;
  const magazine = fillMagazinePlaceholders({ ...(await getHomeMagazine()), enabled: true });

  if (view === "home") {
    const { sections } = await getHomeLayout();
    // 미리보기에서는 매거진 섹션을 항상 보이게 한다(배치에서 숨김이어도 위치는 유지)
    const forced = sections.map((s) => (s.key === "magazine" ? { ...s, visible: true } : s));
    return (
      <main>
        <HomeSections sections={forced} magazine={magazine} />
      </main>
    );
  }
  return (
    <main>
      {/* 기존 배너 모드면 실제 메인처럼 기존 히어로 + 매장 검색창이 위에 온다 */}
      {magazine.topBanner === "existing" && (
        <>
          <Hero />
          <StoreSearchBar />
        </>
      )}
      <HomeMagazine config={magazine} afterCover={<StoreSearchBar />} />
    </main>
  );
}
