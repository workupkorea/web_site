"use client";
import { useState } from "react";
import type { DetailProduct } from "@/lib/editorial-blocks";
import { ikSrc } from "@/lib/imageSrc";

// 기획전 상세페이지에서 상품 1개를 소개하는 카드 — 좌측은 컬러를 고르면 그 컬러의 이미지만
// 보이고(컬러가 없으면 등록한 이미지 전부가 2열 그리드로 쌓임), 우측은 컬러·사이즈·품번·
// 아코디언(상세정보/소재/필수정보). 실제 결제 없이 "매장에서 확인" 흐름으로 이어진다.
export default function ProductFeatureCard({ product }: { product: DetailProduct }) {
  const detail = product.cardDetail;
  const images = detail?.images?.length ? detail.images : (product.imageUrl ? [product.imageUrl] : []);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(detail?.colors?.[0]?.id ?? null);
  const [openSection, setOpenSection] = useState<"detail" | "material" | "essential" | null>(null);

  const toggle = (key: "detail" | "material" | "essential") =>
    setOpenSection((cur) => (cur === key ? null : key));

  const selectedColor = detail?.colors?.find((c) => c.id === selectedColorId);
  // 컬러가 선택돼 있으면 그 컬러에 체크된 이미지들만, 없으면(또는 지정된 이미지가 없으면) 전부.
  const colorImages = (selectedColor?.imageIndexes ?? []).map((i) => images[i]).filter(Boolean);
  const displayImages = colorImages.length > 0 ? colorImages : images;

  const accordions = [
    { key: "detail" as const, label: "상품 상세정보", text: detail?.detailText },
    { key: "material" as const, label: "소재", text: detail?.materialText },
    { key: "essential" as const, label: "상품 필수 정보", text: detail?.essentialText },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 bg-white py-8 md:py-10">
      {/* 좌: 이미지 — 컬러 선택 시 그 이미지 한 장만, 아니면 전부 2열 그리드 */}
      {displayImages.length > 0 ? (
        <div className={displayImages.length > 1 ? "grid grid-cols-2 gap-2 content-start" : ""}>
          {displayImages.map((url, i) => (
            <div key={url + i} className="aspect-square bg-gray-100 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ikSrc(url, 800)} alt={product.name} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      ) : (
        <div className="aspect-square bg-gray-100 flex items-center justify-center text-gray-300 text-5xl font-black select-none">WU</div>
      )}

      {/* 우: 정보 */}
      <div className="flex flex-col">
        <h3 className="text-xl md:text-2xl font-bold text-[#303236] mb-5">{product.name}</h3>

        {!!detail?.colors?.length && (
          <div className="mb-7">
            <p className="text-sm text-[#303236] mb-3 font-bold">
              Color{" "}
              {selectedColor && !selectedColor.soldOut && <span>{selectedColor.name}</span>}
            </p>
            <div className="flex flex-wrap gap-3">
              {detail.colors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={c.soldOut}
                  onClick={() => setSelectedColorId(c.id)}
                  className="flex flex-col items-center gap-1 disabled:opacity-40"
                  title={c.name}
                >
                  <span
                    className={`w-7 h-7 rounded-full border transition-shadow ${c.id === selectedColorId && !c.soldOut ? "ring-2 ring-offset-2 ring-[#303236]" : "border-gray-300"}`}
                    style={{ backgroundColor: c.hex }}
                  />
                  {c.soldOut && <span className="text-[10px] text-gray-400">품절</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {!!detail?.sizes?.length && (
          <div className="mb-8">
            <p className="text-sm font-bold text-[#303236] mb-3">Size</p>
            <div className="flex flex-wrap gap-2">
              {detail.sizes.map((s) => (
                <span
                  key={s.id}
                  className={`relative flex-1 min-w-[64px] overflow-hidden rounded-md px-3 py-4 text-sm font-bold text-center ${
                    s.soldOut ? "bg-gray-50 text-gray-300" : "bg-gray-100 text-[#303236]"
                  }`}
                >
                  {s.label}
                  {s.soldOut && (
                    <span
                      className="pointer-events-none absolute inset-0"
                      style={{ background: "linear-gradient(to top right, transparent calc(50% - 1px), #d1d5db 50%, transparent calc(50% + 1px))" }}
                    />
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {detail?.styleNo?.trim() && (
          <p className="mb-4 text-sm font-bold text-[#303236]">
            Style No. {detail.styleNo.trim()}
          </p>
        )}

        {/* 아코디언 — 위 정보 영역과는 굵은 선으로 구분 */}
        <div className="border-t-2 border-[#303236] mt-auto">
          {accordions.map((a) => (
            <div key={a.key} className="border-b-2 border-[#303236]">
              <button type="button" onClick={() => toggle(a.key)}
                className="flex w-full items-center justify-between py-6 text-base font-extrabold text-[#303236]">
                {a.label}
                <svg className={`w-4 h-4 text-[#303236] transition-transform ${openSection === a.key ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openSection === a.key && (
                <p className="pb-6 text-sm text-gray-500 leading-relaxed whitespace-pre-line">
                  {a.text?.trim() || "등록된 내용이 없습니다."}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
