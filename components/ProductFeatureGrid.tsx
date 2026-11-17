import { cleanSizeLabel } from "@/lib/sizeLabel";
import type { DetailProduct } from "@/lib/editorial-blocks";
import { ikSrc } from "@/lib/imageSrc";

// 기획전 상세페이지 하단 — 제품을 "사진 + 제품명" 카드로 한눈에 보여주는 간결한 목록(중앙 정렬).
// 사이즈·품번·상세정보는 여기서 다루지 않는다. 예전 제품 상세(/products/[id])로 가는 링크는 두지 않는다.
// 관리자에서 스마트스토어 링크(cardDetail.storeUrl)를 입력한 제품에는 "스마트스토어에서 보기" 버튼이 붙는다.
// 메인 배너 태그에서 ?item= / ?product= 로 들어오면 해당 카드를 강조한다.
export default function ProductFeatureGrid({
  products,
  initialProductId,
  initialItemId,
}: {
  products: DetailProduct[];
  initialProductId?: string;
  initialItemId?: string;
}) {
  const isInitial = (p: DetailProduct) =>
    initialItemId ? p.itemId === initialItemId : !!initialProductId && p.productId === initialProductId;

  return (
    <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
      {products.map((p, i) => {
        const image = p.cardDetail?.images?.[0] ?? p.imageUrl;
        const brand = p.cardDetail?.brand;
        const storeUrl = p.cardDetail?.storeUrl?.trim();
        const safeStoreUrl = storeUrl && /^https?:\/\//.test(storeUrl) ? storeUrl : undefined; // http(s)만 허용
        const colors = (p.cardDetail?.colors ?? []).map((c) => c.name.trim()).filter(Boolean);
        const sizes = (p.cardDetail?.sizes ?? []).map((z) => cleanSizeLabel(z.label)).filter(Boolean);
        const highlighted = isInitial(p);
        const body = (
          <>
            <div className="aspect-square bg-gray-100 overflow-hidden">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ikSrc(image, 600)}
                  alt={p.name}
                  loading="lazy"
                  className="w-full h-full object-cover "
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl font-black select-none">WU</div>
              )}
            </div>
            <div className="px-3 pt-4 pb-3 md:px-4 text-center">
              {brand && <p className="text-[11px] font-bold tracking-wider text-gray-500 mb-1">{brand}</p>}
              <p className="text-sm md:text-[15px] font-semibold text-[#303236] leading-snug break-keep">{p.name}</p>
              {colors.length > 0 && <p className="text-[12px] text-gray-500 mt-1.5 break-keep">컬러 : {colors.join(", ")}</p>}
              {sizes.length > 0 && <p className="text-[12px] text-gray-500 mt-0.5">사이즈 : {sizes.join(", ")}</p>}
            </div>
          </>
        );
        return (
          <li
            key={`${p.productId}-${i}`}
            className={`flex flex-col bg-white border ${highlighted ? "border-[#303236]" : "border-gray-200"}`}
          >
            <div className="flex-1">{body}</div>
            {safeStoreUrl && (
              <div className="px-3 pb-4 md:px-4 text-center">
                <a
                  href={safeStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1 min-h-[44px] w-full border border-[#303236] text-[#303236] text-[13px] font-semibold hover:bg-[#303236] hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#303236]"
                >
                  스마트스토어에서 보기
                  <span aria-hidden>↗</span>
                </a>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
