import { getBrandMarquee, type BrandLogoItem } from "@/lib/brand-marquee";
import BrandMarqueeClient from "@/components/BrandMarqueeClient";

// Fisher-Yates — 매 요청마다 로고 배치 순서를 새로 섞는다.
function shuffle<T>(arr: T[]): T[] {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

// 매장검색 바로 아래 배치되는 브랜드 로고 무한 마퀴 — 매장검색 바와 동일한
// 카드(각진 모서리·진한 테두리) 스타일을 공유한다.
// 브랜드 자체 정보는 /admin/catalog/brands가 유일한 소스이며,
// 이 섹션은 /admin/main/brands에서 고른 브랜드 중 순서를 매번 랜덤으로 섞어 보여준다.
export default async function HomeBrandLogos() {
  const { title, items: fetched } = await getBrandMarquee();
  if (fetched.length === 0) return null;
  const items: BrandLogoItem[] = shuffle(fetched);

  return (
    // 박스 없이 전체 폭 흰 띠 + 좌우 여백 정렬. 위쪽 베이지 섹션과는 배경색 대비로 구분한다.
    <div className="bg-white py-8 md:pb-12 md:pt-16">
      <div className="px-[15px] md:px-[70px]">
        <div className="md:flex md:items-end md:justify-between md:gap-4">
          <h2 className="text-center text-lg font-extrabold tracking-[-0.06em] text-[#303236] md:text-left md:text-xl md:tracking-[-0.03em]">{title}</h2>
          {/* PC: 제목과 같은 줄 우측 */}
          <p className="hidden text-xs text-gray-400 md:block">로고를 클릭하면 브랜드 카탈로그로 이동합니다</p>
        </div>
        <hr className="mt-3 border-0 border-t border-gray-200 md:mt-4" />
        <div className="mt-1 md:mt-3">
          <BrandMarqueeClient items={items} />
        </div>
        {/* 모바일: 하단 중앙에 작게 */}
        <p className="mt-1 text-center text-[10px] text-gray-400 md:hidden">로고를 클릭하면 브랜드 카탈로그로 이동합니다</p>
      </div>
    </div>
  );
}
