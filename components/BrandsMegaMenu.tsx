"use client";
import Link from "next/link";
import { Oxanium } from "next/font/google";
import { BRANDS } from "@/lib/brands-data";
import type { MegaBrandItem, MegaMenuSettings } from "@/lib/mega-brands-types";

const oxanium = Oxanium({ subsets: ["latin"], weight: ["600", "700", "800"] });

type DisplayBrand = {
  id: string;
  name: string;
  positioning: string;
  descriptionKo: string;
  href: string;
  bg: string;
};

function toDisplayBrands(propBrands: MegaBrandItem[] | undefined): DisplayBrand[] {
  if (propBrands) {
    return propBrands
      .filter(b => b.megaMenuVisible !== false && b.status !== "inactive")
      .map(b => ({
        id: b.id,
        name: b.name,
        positioning: b.positioning,
        descriptionKo: b.descriptionKo,
        href: b.href,
        bg: b.megaMenuImage
          ? `url('${b.megaMenuImage}') center top / cover no-repeat`
          : (BRANDS.find(s => s.id === b.id)?.imageBg ?? "#1a1a1a"),
      }));
  }
  return BRANDS.map(b => ({
    id: b.id,
    name: b.name,
    positioning: b.positioning,
    descriptionKo: b.descriptionKo,
    href: b.href,
    bg: b.imageBg,
  }));
}

export default function BrandsMegaMenu({
  onMouseEnter,
  onMouseLeave,
  onLinkClick,
  brands: propBrands,
  settings: propSettings,
}: {
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onLinkClick?: () => void;
  brands?: MegaBrandItem[];
  settings?: MegaMenuSettings;
}) {
  const heading = propSettings?.heading ?? "OUR BRANDS";
  const body = propSettings?.body ?? "모든 워커를 위한\n매일 입는 워크업";
  const ctaLabel = propSettings?.ctaLabel ?? "브랜드 전체 보기 →";
  const ctaUrl = propSettings?.ctaUrl ?? "/catalog";
  const displayBrands = toDisplayBrands(propBrands);

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="w-full bg-[#0f0f0f] text-white"
      style={{ borderTop: "1px solid rgba(255,255,255,0.20)" }}
    >
      <div className="flex" style={{ minHeight: "500px" }}>

        {/* ── 왼쪽 OUR BRANDS 패널 ── */}
        <div
          className="flex-shrink-0 flex flex-col justify-between"
          style={{
            width: "clamp(120px, 15%, 196px)",
            padding: "28px clamp(12px, 1.5vw, 22px)",
            borderRight: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <div>
            <p
              className={`${oxanium.className} uppercase mb-[10px]`}
              style={{
                fontSize: "9px",
                letterSpacing: "0.42em",
                color: "#E5541B",
                fontWeight: 700,
              }}
            >
              {heading}
            </p>
            <h2
              className="text-white whitespace-pre-line"
              style={{
                fontSize: "15px",
                fontWeight: 600,
                lineHeight: 1.6,
              }}
            >
              {body}
            </h2>
          </div>
          <Link
            href={ctaUrl}
            onClick={onLinkClick}
            className="hover:text-[#E5541B] transition-colors duration-200"
            style={{
              fontSize: "11px",
              letterSpacing: "0.06em",
              wordBreak: "keep-all",
              color: "rgba(255,255,255,0.72)",
            }}
          >
            {ctaLabel}
          </Link>
        </div>

        {/* ── 브랜드 카드 ── */}
        {/* 태블릿·좁은 화면: 카드가 찌그러지지 않도록 최소 너비를 두고 가로 스크롤 */}
        <div className="flex flex-1 min-w-0 overflow-x-auto overscroll-x-contain">
          {displayBrands.map((brand, i) => (
            <Link
              key={brand.id}
              href={brand.href}
              onClick={onLinkClick}
              className="group flex flex-col overflow-hidden hover:bg-white/[0.02] transition-colors duration-200"
              style={{
                flex: "1 0 150px",
                borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.15)" : undefined,
              }}
            >
              {/* ── ① 브랜드명 ② 영문 포지셔닝 ③ 한글 설명 ── */}
              <div style={{ padding: "26px 14px 18px" }}>
                <h3
                  className={`${oxanium.className} text-white leading-tight`}
                  style={{
                    fontSize: "clamp(11px, 1.15vw, 15px)",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    marginBottom: "12px",
                  }}
                >
                  {brand.name}
                </h3>
                <p
                  className="uppercase leading-tight"
                  style={{
                    fontSize: "10px",
                    letterSpacing: "0.14em",
                    color: "rgba(255,255,255,0.65)",
                    marginBottom: "4px",
                  }}
                >
                  {brand.positioning}
                </p>
                <p
                  style={{
                    fontSize: "12px",
                    lineHeight: 1.65,
                    color: "rgba(255,255,255,0.58)",
                  }}
                >
                  {brand.descriptionKo}
                </p>
              </div>

              {/* ── ④ 브랜드 이미지 ── */}
              <div
                className="relative overflow-hidden flex-1"
                style={{ minHeight: "320px" }}
              >
                <div
                  className="absolute inset-0 group-hover:scale-[1.03] group-hover:brightness-[1.08] transition-[transform,filter] duration-300 ease-out"
                  style={{ background: brand.bg }}
                />
                <div
                  className="absolute bottom-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                >
                  <span
                    className={`${oxanium.className} text-white/80`}
                    style={{ fontSize: "12px" }}
                  >
                    →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
