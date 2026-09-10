"use client";
import { useState } from "react";
import Link from "next/link";
import type { BrandItem } from "@/app/brands/page";

const CATEGORIES = ["전체", "WORKWEAR", "CASUAL", "OUTDOOR", "SAFETY", "ACCESSORY"] as const;

// 상단 카테고리 탭 임시 숨김 (기능/필터 로직은 유지 — true 로 바꾸면 다시 노출)
const SHOW_CATEGORY_TABS = false;

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  WORKWEAR: ["workwear", "work"],
  CASUAL: ["casual", "basic", "life", "street"],
  OUTDOOR: ["outdoor", "performance"],
  SAFETY: ["safety"],
  ACCESSORY: ["accessory", "footwear"],
};

function matchesCategory(brand: BrandItem, category: string): boolean {
  if (category === "전체") return true;
  const text = `${brand.positioning} ${brand.description}`.toLowerCase();
  const keywords = CATEGORY_KEYWORDS[category] ?? [];
  return keywords.some((kw) => text.includes(kw));
}

// 카탈로그 있는 브랜드 — 이미지 포함 큰 카드
function CatalogCard({ item }: { item: BrandItem }) {
  const { name, positioning, description, href, heroImage, imageBg } = item;
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer" className="group block overflow-hidden border border-gray-200 hover:shadow-md transition-shadow bg-white" style={{ borderRadius: 4 }}>
      <div className="relative overflow-hidden bg-gray-100" style={{ aspectRatio: "3/2", borderRadius: "3px 3px 0 0" }}>
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            alt={name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : imageBg ? (
          <div className="absolute inset-0" style={{ background: imageBg }} />
        ) : (
          <div className="absolute inset-0 bg-gray-200" />
        )}
      </div>
      <div className="px-3 py-3">
        <h3 className="text-sm font-black text-gray-900 leading-tight mb-0.5">{name}</h3>
        {positioning && <p className="text-[9px] tracking-[0.2em] font-bold uppercase text-gray-400 mb-1">{positioning}</p>}
        {description && <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">{description}</p>}
      </div>
    </Link>
  );
}

// 카탈로그 없는 브랜드 — 소형 compact 행
function CompactBrandRow({ item }: { item: BrandItem }) {
  const { name, positioning, description } = item;
  return (
    <div className="px-4 py-3 border border-gray-100 bg-white" style={{ borderRadius: 4 }}>
      <span className="text-[12px] font-black text-gray-700 mr-2">{name}</span>
      {positioning && (
        <span className="text-[9px] tracking-[0.15em] font-bold uppercase text-gray-300">{positioning}</span>
      )}
      {description && (
        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{description}</p>
      )}
    </div>
  );
}

export default function BrandsPageClient({ brands }: { brands: BrandItem[] }) {
  const [activeCategory, setActiveCategory] = useState<string>("전체");

  const filtered = brands.filter((b) => matchesCategory(b, activeCategory));
  const withCatalog = filtered.filter((b) => b.hasCatalog);
  const withoutCatalog = filtered.filter((b) => !b.hasCatalog);

  return (
    <div className="max-w-screen-xl mx-auto px-4 md:px-8 py-8">
      {/* 카테고리 탭 (임시 숨김 — SHOW_CATEGORY_TABS) */}
      {SHOW_CATEGORY_TABS && (
        <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-8 border-b border-gray-100">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 px-4 py-2 text-sm font-semibold rounded-full transition-colors
                ${activeCategory === cat
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}>
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* 카탈로그 있는 브랜드 — 큰 그리드 */}
      {withCatalog.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {withCatalog.map((item) => (
            <CatalogCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* 카탈로그 없는 브랜드 — 하단 소형 compact 목록 */}
      {withoutCatalog.length > 0 && (
        <div className={withCatalog.length > 0 ? "mt-10" : ""}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {withoutCatalog.map((item) => (
              <CompactBrandRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* 결과 없음 */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <p className="text-sm">해당 카테고리의 브랜드가 없습니다.</p>
        </div>
      )}

      {/* 하단 CTA */}
      <div className="mt-16 border border-gray-100 rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-[9px] tracking-[0.3em] text-gray-400 uppercase mb-1">STORE</p>
          <h3 className="text-lg font-black text-gray-900">브랜드 제품을 직접 체험해보세요</h3>
          <p className="text-sm text-gray-500 mt-1">가까운 WORKUP 매장에서 실물을 확인하실 수 있습니다.</p>
        </div>
        <Link href="/stores"
          className="flex-shrink-0 px-6 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 transition-colors">
          매장 찾기
        </Link>
      </div>
    </div>
  );
}
