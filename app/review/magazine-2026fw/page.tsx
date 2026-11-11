import { notFound } from "next/navigation";
import HomeMagazine from "@/components/HomeMagazine";
import StoreSearchBar from "@/components/StoreSearchBar";
import { getHomeMagazine } from "@/lib/home-magazine-server";
import { isMagazinePublishable } from "@/lib/home-magazine";

// 캠페인 매거진 단독 페이지 (/review/magazine-2026fw) — 고객에게 알리지 않는 "내부 보고용" 링크.
//  · 로그인·비밀키 없이 링크만 있으면 열린다. 대신 주소를 추측하기 어렵게 두고, 메뉴·사이트맵 어디에도 연결하지 않는다.
//  · 검색엔진 노출 금지(noindex) — 구글 등에 검색되지 않는다.
//  · 메인의 "공개" 설정과 상관없이 저장된 매거진을 그대로 보여준다(공개 전 검토·보고용).
//    커버 이미지·배우 이름이 없으면 404.
//  · 빈 자리를 안내 블록으로 채우는 관리자용 미리보기는 /magazine-preview.
export const dynamic = "force-dynamic";
export const metadata = { title: "캠페인 매거진 (내부 검토용)", robots: { index: false, follow: false, nocache: true } };

export default async function MagazineInternalPage() {
  const magazine = { ...(await getHomeMagazine()), enabled: true, topBanner: "magazine" as const };
  if (!isMagazinePublishable(magazine)) notFound();

  return (
    <main>
      <HomeMagazine config={magazine} afterCover={<StoreSearchBar />} />
    </main>
  );
}
