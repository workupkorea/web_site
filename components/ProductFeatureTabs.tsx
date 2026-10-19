"use client";
import { useState } from "react";
import type { DetailProduct } from "@/lib/editorial-blocks";
import ProductFeatureCard from "@/components/ProductFeatureCard";

// 관리자에서 상품을 추가할 수 있으므로 넉넉히 허용 — 필요하면 이 숫자만 조정한다.
const MAX_PRODUCTS = 10;

// 기획전 상세페이지 하단 — 제품을 세로로 쌓아 보여주는 대신, 폴더형 탭으로 전환한다.
// 탭(제품명)을 누르면 그 제품의 이미지·컬러·사이즈·아코디언으로 전체 내용이 바뀐다.
export default function ProductFeatureTabs({ products, initialProductId }: { products: DetailProduct[]; initialProductId?: string }) {
  const shown = products.slice(0, MAX_PRODUCTS);
  // 메인 배너 태그에서 ?product=<id> 로 들어오면 해당 제품 탭을 먼저 연다 (없으면 첫 탭)
  const [activeIdx, setActiveIdx] = useState(() => Math.max(0, shown.findIndex((p) => p.productId === initialProductId)));
  const active = shown[activeIdx];
  if (!active) return null;

  return (
    <div>
      {/* 상단 폴더형 탭 — 선택된 탭이 아래 콘텐츠 박스와 이어져 보이도록 겹침 */}
      {/* 모바일: 스크롤바 숨기고 가로 스와이프 + 오른쪽 페이드로 "더 있음"을 암시, 선택 탭은 자동으로 화면 안으로 이동 */}
      <div className="relative">
      <div className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
        {shown.map((p, i) => {
          const isActive = i === activeIdx;
          return (
            <button
              key={`${p.productId}-${i}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={(e) => {
                setActiveIdx(i);
                e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
              }}
              className={`relative flex-shrink-0 whitespace-nowrap border px-5 py-3 text-sm transition-colors ${
                isActive
                  ? "z-10 border-b-0 border-black bg-white font-semibold text-[#303236]"
                  : "mt-1.5 border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
              } ${i > 0 ? "-ml-px" : ""}`}
            >
              {p.name}
            </button>
          );
        })}
      </div>
      {shown.length > 2 && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#FAFAF8] to-transparent md:hidden" />
      )}
      </div>

      {/* 콘텐츠 박스 — key로 제품이 바뀔 때마다 이미지/아코디언 열림 상태를 초기화 */}
      <div className="border border-black bg-white px-5 md:px-8">
        <ProductFeatureCard key={`${active.productId}-${activeIdx}`} product={active} />
      </div>
    </div>
  );
}
