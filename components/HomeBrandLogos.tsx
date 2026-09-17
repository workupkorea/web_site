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
// 카드(둥근 모서리·주황 테두리·그림자) 스타일을 공유한다.
// 브랜드 자체 정보는 /admin/catalog/brands가 유일한 소스이며,
// 이 섹션은 /admin/main/brands에서 고른 브랜드 중 순서를 매번 랜덤으로 섞어 보여준다.
export default async function HomeBrandLogos() {
  const { title, items: fetched } = await getBrandMarquee();
  if (fetched.length === 0) return null;
  const items: BrandLogoItem[] = shuffle(fetched);

  return (
    <div className="bg-white py-4 md:py-7">
      <div className="px-[15px] md:px-[70px]">
        <div className="rounded-xl border-2 border-[#303236] bg-white px-5 py-5 shadow-md md:px-8 md:py-7">
          <p className="text-xs tracking-widest text-[#E5541B] uppercase mb-1">BRANDS</p>
          <h2 className="text-lg font-bold text-[#303236] md:text-xl mb-4 md:mb-5">{title}</h2>
          <BrandMarqueeClient items={items} />
        </div>
      </div>
    </div>
  );
}
