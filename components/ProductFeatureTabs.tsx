"use client";
import { useState } from "react";
import type { DetailProduct } from "@/lib/editorial-blocks";
import ProductFeatureCard from "@/components/ProductFeatureCard";

// 우선 3개까지만 노출 — 필요해지면 이 숫자만 늘리면 된다.
const MAX_PRODUCTS = 3;

// 기획전 상세페이지 하단 — 제품을 세로로 쌓아 보여주는 대신, 폴더형 탭으로 전환한다.
// 탭(제품명)을 누르면 그 제품의 이미지·컬러·사이즈·아코디언으로 전체 내용이 바뀐다.
export default function ProductFeatureTabs({ products }: { products: DetailProduct[] }) {
  const shown = products.slice(0, MAX_PRODUCTS);
  const [activeIdx, setActiveIdx] = useState(0);
  const active = shown[activeIdx];
  if (!active) return null;

  return (
    <div>
      {/* 상단 폴더형 탭 — 선택된 탭이 아래 콘텐츠 박스와 이어져 보이도록 겹침 */}
      <div className="flex overflow-x-auto">
        {shown.map((p, i) => {
          const isActive = i === activeIdx;
          return (
            <button
              key={`${p.productId}-${i}`}
              type="button"
              onClick={() => setActiveIdx(i)}
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

      {/* 콘텐츠 박스 — key로 제품이 바뀔 때마다 이미지/아코디언 열림 상태를 초기화 */}
      <div className="border border-black bg-white px-5 md:px-8">
        <ProductFeatureCard key={`${active.productId}-${activeIdx}`} product={active} />
      </div>
    </div>
  );
}
