import { notFound } from "next/navigation";
import type { Metadata } from "next";
import HomeMagazine from "@/components/HomeMagazine";
import { isAdmin } from "@/lib/admin-auth";
import { getHomeLayout } from "@/lib/home-layout-server";
import { getHomeMagazine } from "@/lib/home-magazine-server";
import { fillMagazinePlaceholders, isMagazinePublishable, type HomeMagazineConfig } from "@/lib/home-magazine";
import { resolveHomeLayout } from "@/lib/home-layout";
import { pageMetadata } from "@/lib/seo";

// 캠페인 매거진 단독 페이지 (/magazine) — 메인 하단에 붙이지 않고 독립된 페이지로 연다.
// 메인 대배너의 "매거진 보기" 버튼(#magazine)이 여기로 이동한다.
//  · 노출 조건: 예약(캠페인) 기간 중이며 배치에서 매거진이 노출 ON, 매거진 공개 ON + 커버 입력 완료.
//  · 관리자 로그인 상태에서는 기간·입력 여부와 상관없이 열린다(빈 자리는 안내 블록).
export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMetadata({
  title: "캠페인 매거진",
  description: "워크업 시즌 캠페인 매거진. 착용 화보를 보고 가까운 워크업 매장에서 직접 입어보세요.",
  path: "/magazine",
});

export default async function MagazinePage() {
  const admin = await isAdmin();
  const saved = await getHomeMagazine();
  // 단독 페이지에서는 커버가 항상 맨 위에 온다
  let magazine: HomeMagazineConfig = { ...saved, topBanner: "magazine" };

  if (admin) {
    magazine = fillMagazinePlaceholders({ ...magazine, enabled: true });
  } else {
    const { sections } = resolveHomeLayout(await getHomeLayout());
    const visible = sections.find((s) => s.key === "magazine")?.visible;
    if (!visible || !isMagazinePublishable(magazine)) notFound();
  }

  return (
    <main>
      <HomeMagazine config={magazine} />
    </main>
  );
}
