"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { Editorial, EditorialSection, EditorialSectionTag } from "@/data/editorial";
import { ikSrc } from "@/lib/imageSrc";

// 섹션 이미지 위 상품 핫스팟 — 클릭 시 제품 상세로 이동 (PC는 hover 라벨)
function SectionTags({ tags }: { tags?: EditorialSectionTag[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const valid = (tags ?? []).filter((t) => t.productId);
  if (valid.length === 0) return null;

  return (
    <div className="absolute inset-0 z-[3]">
      {valid.map((t, i) => (
        <div
          key={i}
          className="absolute"
          style={{ left: `${t.x}%`, top: `${t.y}%`, transform: "translate(-50%, -50%)" }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
        >
          <Link
            href={`/products/${t.productId}`}
            aria-label={t.name || "상품 보기"}
            className="relative flex items-center justify-center w-9 h-9"
          >
            <span
              className="rounded-full transition-transform w-3 h-3 xl:w-4 xl:h-4 border-2 xl:border-[3px] border-white/60 xl:border-white bg-white/10 xl:bg-white/25 shadow-[0_0_0_1px_rgba(0,0,0,0.2)]"
              style={{ transform: hovered === i ? "scale(1.3)" : "scale(1)" }}
            />
          </Link>
          {hovered === i && t.name && (
            <div
              className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap bg-white shadow-xl px-3 py-2 pointer-events-none ${
                t.y < 22 ? "top-full mt-1.5" : "bottom-full mb-1.5"
              }`}
            >
              <p className="text-[11px] text-[#303236] font-medium leading-snug">{t.name}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// 통이미지 카드 — 제목·설명·썸네일 없이 이미지 한 장 (PR 소식 등). link 지정 시 클릭 이동.
// fill=true(PC): 카드(행) 전체 높이를 채움(하단까지·object-cover). fill=false(모바일): 원본 비율.
function ImageOnlyCard({ imageUrl, link, title, fill = false }: { imageUrl?: string; link?: string; title?: string; fill?: boolean }) {
  const img = imageUrl ? (
    <img
      src={ikSrc(imageUrl, 1200)}
      alt={title || "기획전 이미지"}
      className={fill ? "absolute inset-0 w-full h-full object-cover" : "block w-full h-auto"}
    />
  ) : (
    <div
      className={`flex items-center justify-center bg-gray-100 ${fill ? "absolute inset-0" : "w-full"}`}
      style={fill ? undefined : { aspectRatio: "440 / 495" }}
    >
      <span className="text-gray-300 text-6xl font-black select-none">WU</span>
    </div>
  );
  const style = fill ? ({ flex: "1 1 0", minHeight: 0, position: "relative" } as const) : undefined;
  if (!link) return fill ? <div style={style} className="block w-full">{img}</div> : img;
  return /^https?:\/\//.test(link) ? (
    <a href={link} target="_blank" rel="noopener noreferrer" style={style} className="block w-full">{img}</a>
  ) : (
    <Link href={link} style={style} className="block w-full">{img}</Link>
  );
}

function WhiteBox({
  section,
  colIndex,
  delayMs = 0,
}: {
  section: EditorialSection;
  colIndex: number;
  delayMs?: number;
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.08 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const duration = colIndex % 2 === 0 ? 650 : 900;
  const translateY = colIndex % 2 === 0 ? 40 : 70;

  return (
    <div
      ref={ref}
      style={{
        width: "100%",
        // 통이미지형은 행(옆 카드) 전체 높이를 채운다 — 하단까지
        height: section.cardType === "image" ? "100%" : undefined,
        backgroundColor: "white",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transform: visible ? "translateY(0)" : `translateY(${translateY}px)`,
        transition: `transform ${duration}ms ease-out`,
        transitionDelay: `${delayMs}ms`,
      }}
    >
      {section.cardType === "image" ? (
        <ImageOnlyCard imageUrl={section.imageUrl} link={section.link} title={section.title} fill />
      ) : (
      <>
      {/* 이미지 — 440:495 = 8:9 컨테이너, object-contain으로 잘림 없음 */}
      <div className="group/img relative w-full flex-shrink-0" style={{ paddingBottom: "112.5%" }}>
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          {section.imageUrl ? (
            <img
              src={ikSrc(section.imageUrl, 1200)}
              alt={section.title}
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="text-gray-300 text-6xl font-black select-none">WU</span>
          )}
        </div>
        {/* 섹션이미지 클릭 → 배너 상세 기획전 페이지 (핫스팟 태그보다 아래 z-index) */}
        {section.detailHref && (
          <Link
            href={section.detailHref}
            aria-label={`${section.title} 기획전 보기`}
            className="absolute inset-0 z-[2]"
          >
            <span className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/95 text-[#303236] text-[11px] font-semibold px-2.5 py-1.5 shadow-md opacity-0 translate-y-1 group-hover/img:opacity-100 group-hover/img:translate-y-0 transition-all">
              기획전 보기
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        )}
        <SectionTags tags={section.tags} />
      </div>

      {/* 텍스트 + 썸네일 */}
      <div
        style={{
          paddingTop: "25px",
          paddingLeft: "20px",
          paddingRight: "20px",
          paddingBottom: "30px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h3
          className="text-[18px] lg:text-[20px] xl:text-[22px] break-keep tracking-tight"
          style={{
            fontWeight: 500,
            color: "#303236",
            lineHeight: 1.3,
            marginBottom: "20px",
          }}
        >
          {section.title}
        </h3>
        <p
          style={{
            fontSize: "15px",
            color: "#6b7280",
            lineHeight: 1.5,
            letterSpacing: "-0.02em",
            marginBottom: 0,
          }}
        >
          {section.desc}
        </p>
      </div>
      </>
      )}
    </div>
  );
}

export default function FeatureHeroLayout({
  editorial,
  reversed = false,
}: {
  editorial: Editorial;
  reversed?: boolean;
}) {
  const [hoveredTag, setHoveredTag] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // PC 히어로(고정 패널) 높이 — 콘텐츠가 짧을 때 100vh가 섹션을 늘려 생기는 하단 공백을 방지.
  // 히어로 높이를 min(뷰포트, 콘텐츠 자연높이)로 맞춰 콘텐츠가 길면 100vh 고정·스크롤,
  // 짧으면 콘텐츠 높이에 맞춰 공백이 생기지 않게 한다.
  const contentRef = useRef<HTMLDivElement>(null);
  const [heroHeight, setHeroHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const update = () => setHeroHeight(Math.min(window.innerHeight, el.offsetHeight));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sheetOpen]);

  const { tags, sections } = editorial;

  // ── PC 히어로 패널 ──────────────────────────────────────────
  const imgPos = editorial.heroImagePosition ?? "50% 0%";
  const heroPanel = (
    <div
      className="sticky top-0 self-start overflow-hidden bg-gray-100"
      style={{ flex: "0 0 49.947%", minWidth: 0, height: heroHeight ? `${heroHeight}px` : "100vh" }}
    >
      <>
        {editorial.heroImageUrl && (
          <img
            src={ikSrc(editorial.heroImageUrl, 1600)}
            alt={editorial.title}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
            style={{ objectPosition: imgPos }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60 z-[1]" />

        {/* 태그 — PC는 pcX/pcY 우선, 없으면 x/y 사용 */}
        {tags.map((tag, i) => (
          <div
            key={i}
            className="absolute z-10"
            style={{ left: `${tag.pcX ?? tag.x}%`, top: `${tag.pcY ?? tag.y}%`, transform: "translate(-50%, -50%)" }}
            onMouseEnter={() => setHoveredTag(i)}
            onMouseLeave={() => setHoveredTag(null)}
          >
            <button
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                border: "4px solid rgba(255,255,255,0.92)",
                backgroundColor: "transparent",
                cursor: "pointer",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.12)",
                transform: hoveredTag === i ? "scale(1.35)" : "scale(1)",
                transition: "transform 200ms ease",
              }}
            />
            {hoveredTag === i && (
              <div className="absolute left-8 top-1/2 -translate-y-1/2 bg-white shadow-xl z-20 w-[220px] p-4">
                <p className="text-[13px] text-[#303236] font-medium mb-4 leading-snug">{tag.name}</p>
                <Link
                  href={`/products/${tag.productId}`}
                  className="flex items-center justify-between border border-gray-300 px-3 py-2 text-[12px] text-[#303236] hover:bg-gray-50 transition-colors"
                >
                  상품 보러가기
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        ))}

        <div className="absolute bottom-10 left-8 z-[2] text-white">
          <p className="text-sm mb-2 opacity-80 tracking-wide">{editorial.heroSubtitle}</p>
          <p className="text-3xl font-bold leading-tight">{editorial.title}</p>
        </div>
      </>
    </div>
  );

  // ── 콘텐츠 패널 (우측 4카드) ────────────────────────────────
  const contentPanel = (
    <div
      ref={contentRef}
      style={{
        flex: "0 0 50.053%",
        minWidth: 0,
        backgroundColor: "#f2f1ed",
        paddingTop: "25px",
        paddingBottom: "25px",
        paddingLeft: "20px",
        paddingRight: "25px",
        display: "flex",
        flexDirection: "column",
        gap: "25px",
      }}
    >
      <div style={{ display: "flex", gap: "25px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <WhiteBox section={sections[0]} colIndex={0} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <WhiteBox section={sections[1] ?? sections[0]} colIndex={1} delayMs={80} />
        </div>
      </div>
      <div style={{ display: "flex", gap: "25px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <WhiteBox section={sections[2] ?? sections[0]} colIndex={2} delayMs={160} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <WhiteBox section={sections[3] ?? sections[1]} colIndex={3} delayMs={240} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ── PC 레이아웃 (xl+) — 1280px 이상 ── */}
      <div
        className="hidden xl:flex xl:items-start bg-white"
        style={reversed ? { position: "relative", zIndex: 1 } : undefined}
      >
        {reversed ? (
          <>
            {contentPanel}
            {heroPanel}
          </>
        ) : (
          <>
            {heroPanel}
            {contentPanel}
          </>
        )}
      </div>

      {/* ── 태블릿 레이아웃 (md ~ xl) — 768px ~ 1280px ── */}
      <div className="hidden md:block xl:hidden">

        {/* 히어로 이미지 — 전체 너비 */}
        <div
          className="relative w-full overflow-hidden bg-gray-100"
          style={{ aspectRatio: "3 / 4" }}
        >
          {editorial.heroImageUrl && (
            <img
              src={ikSrc(editorial.heroImageUrl, 1200)}
              alt={editorial.title}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60 z-[1]" />

          {tags.map((tag, i) => (
            <button
              key={i}
              className="absolute z-10"
              style={{
                left: `${tag.x}%`,
                top: `${tag.y}%`,
                transform: "translate(-50%, -50%)",
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                border: "4px solid rgba(255,255,255,0.92)",
                backgroundColor: "transparent",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.25)",
              }}
              onClick={() => setSheetOpen(true)}
              aria-label={tag.name}
            />
          ))}

          <div className="absolute bottom-[39px] left-4 z-[2] text-white">
            <p className="mb-1 opacity-80" style={{ fontSize: "12px" }}>{editorial.heroSubtitle}</p>
            <h1 className="text-[22px] leading-tight tracking-tight" style={{ fontWeight: 700 }}>{editorial.title}</h1>
          </div>
        </div>

        {/* 카드 목록 — 2열 */}
        <div
          style={{
            backgroundColor: "#f2f1ed",
            paddingTop: "30px",
            paddingLeft: "15px",
            paddingRight: "15px",
            paddingBottom: "30px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div style={{ display: "flex", gap: "20px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <WhiteBox section={sections[0]} colIndex={0} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <WhiteBox section={sections[1] ?? sections[0]} colIndex={1} delayMs={80} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "20px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <WhiteBox section={sections[2] ?? sections[0]} colIndex={2} delayMs={160} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <WhiteBox section={sections[3] ?? sections[1]} colIndex={3} delayMs={240} />
            </div>
          </div>
        </div>

        {/* 바텀시트 백드롭 */}
        <div
          aria-hidden="true"
          className={`fixed inset-0 z-[62] bg-black/50 transition-opacity duration-300 md:hidden ${
            sheetOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setSheetOpen(false)}
        />

        {/* 바텀시트 본체 */}
        <div
          className="fixed bottom-0 left-0 right-0 z-[63] bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)] max-h-[80vh] flex flex-col transition-transform duration-300 ease-out md:hidden"
          style={{ transform: sheetOpen ? "translateY(0)" : "translateY(110%)" }}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex justify-center pt-3.5 pb-2 flex-shrink-0">
            <div className="w-9 h-1 bg-gray-300 rounded-full" />
          </div>

          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
            <h3 className="text-[15px] font-bold text-[#303236]">대표 상품</h3>
            <button
              onClick={() => setSheetOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              aria-label="닫기"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-5 pt-4 pb-4">
            <div className="space-y-4">
              {tags.map((tag, i) => (
                <Link
                  key={i}
                  href={`/products/${tag.productId}`}
                  className="flex items-center gap-4"
                  onClick={() => setSheetOpen(false)}
                >
                  <div
                    className="flex-shrink-0 bg-gray-100 flex items-center justify-center overflow-hidden"
                    style={{ width: "72px", height: "72px" }}
                  >
                    {tag.imageUrl ? (
                      <img src={ikSrc(tag.imageUrl, 400)} alt={tag.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-gray-300 text-xs font-black">WU</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#303236] leading-snug">{tag.name}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          <div className="px-5 pb-6 pt-3 flex-shrink-0">
            <Link
              href={`/products/feature/${editorial.slug}`}
              className="flex items-center justify-center gap-2 w-full bg-[#303236] text-white py-4 text-[14px] font-semibold tracking-wide"
              onClick={() => setSheetOpen(false)}
            >
              기획전 바로가기
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* ── 모바일 레이아웃 (< md) — 768px 이하 ── */}
      <div className="md:hidden">

        {/* 히어로 이미지 — 3:4 비율 컨테이너, 이미지+태그가 동일 좌표 공간 */}
        <div
          className="relative w-full overflow-hidden bg-gray-100"
          style={{ aspectRatio: "3 / 4" }}
        >
          {editorial.heroImageUrl && (
            <img
              src={ikSrc(editorial.heroImageUrl, 1200)}
              alt={editorial.title}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60 z-[1]" />

          {tags.map((tag, i) => (
            <button
              key={i}
              className="absolute z-10"
              style={{
                left: `${tag.x}%`,
                top: `${tag.y}%`,
                transform: "translate(-50%, -50%)",
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                border: "4px solid rgba(255,255,255,0.92)",
                backgroundColor: "transparent",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.25)",
              }}
              onClick={() => setSheetOpen(true)}
              aria-label={tag.name}
            />
          ))}

          <div className="absolute bottom-[39px] left-4 z-[2] text-white">
            <p className="mb-1 opacity-80" style={{ fontSize: "12px" }}>{editorial.heroSubtitle}</p>
            <h1 className="text-[22px] leading-tight tracking-tight" style={{ fontWeight: 700 }}>{editorial.title}</h1>
          </div>
        </div>

        {/* 카드 목록 — 1열, 4개 카드 모두 노출 */}
        <div
          style={{
            backgroundColor: "#f2f1ed",
            paddingTop: "30px",
            paddingLeft: "0px",
            paddingRight: "0px",
            paddingBottom: "30px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {sections.map((section, i) => (
            <div key={i} style={{ backgroundColor: "white", overflow: "hidden", width: "100%" }}>
              {section.cardType === "image" ? (
                <ImageOnlyCard imageUrl={section.imageUrl} link={section.link} title={section.title} />
              ) : (
              <>
              {/* 이미지 — object-contain으로 잘림 없음 */}
              <div
                className="relative w-full flex items-center justify-center bg-gray-100"
                style={{ aspectRatio: "440 / 495" }}
              >
                {section.imageUrl ? (
                  <img
                    src={ikSrc(section.imageUrl, 1200)}
                    alt={section.title}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-gray-300 text-5xl font-black select-none">WU</span>
                )}
                {/* 섹션이미지 클릭 → 배너 상세 기획전 페이지 */}
                {section.detailHref && (
                  <Link
                    href={section.detailHref}
                    aria-label={`${section.title} 기획전 보기`}
                    className="absolute inset-0 z-[2]"
                  >
                    <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-white/95 text-[#303236] text-[11px] font-semibold px-2.5 py-1.5 shadow-md">
                      기획전 보기
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </Link>
                )}
                <SectionTags tags={section.tags} />
              </div>

              {/* 텍스트 */}
              <div style={{ paddingTop: "20px", paddingLeft: "15px", paddingRight: "15px", paddingBottom: "20px" }}>
                <h3 className="text-[18px] lg:text-[20px] break-keep" style={{ fontWeight: 700, color: "#303236", marginBottom: "16px" }}>
                  {section.title}
                </h3>
                <p style={{ fontSize: "13px", color: "#6b7280", lineHeight: 1.7, marginBottom: 0 }}>
                  {section.desc}
                </p>
              </div>
              </>
              )}
            </div>
          ))}
        </div>

        {/* 모바일 바텀시트 백드롭 */}
        <div
          aria-hidden="true"
          className={`fixed inset-0 z-[62] bg-black/50 transition-opacity duration-300 md:hidden ${
            sheetOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setSheetOpen(false)}
        />

        {/* 모바일 바텀시트 본체 */}
        <div
          className="fixed bottom-0 left-0 right-0 z-[63] bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)] max-h-[80vh] flex flex-col transition-transform duration-300 ease-out md:hidden"
          style={{ transform: sheetOpen ? "translateY(0)" : "translateY(110%)" }}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex justify-center pt-3.5 pb-2 flex-shrink-0">
            <div className="w-9 h-1 bg-gray-300 rounded-full" />
          </div>

          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
            <h3 className="text-[15px] font-bold text-[#303236]">대표 상품</h3>
            <button
              onClick={() => setSheetOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              aria-label="닫기"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-5 pt-4 pb-4">
            <div className="space-y-4">
              {tags.map((tag, i) => (
                <Link
                  key={i}
                  href={`/products/${tag.productId}`}
                  className="flex items-center gap-4"
                  onClick={() => setSheetOpen(false)}
                >
                  <div
                    className="flex-shrink-0 bg-gray-100 flex items-center justify-center overflow-hidden"
                    style={{ width: "72px", height: "72px" }}
                  >
                    {tag.imageUrl ? (
                      <img src={ikSrc(tag.imageUrl, 400)} alt={tag.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-gray-300 text-xs font-black">WU</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#303236] leading-snug">{tag.name}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          <div className="px-5 pb-6 pt-3 flex-shrink-0">
            <Link
              href={`/products/feature/${editorial.slug}`}
              className="flex items-center justify-center gap-2 w-full bg-[#303236] text-white py-4 text-[14px] font-semibold tracking-wide"
              onClick={() => setSheetOpen(false)}
            >
              기획전 바로가기
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
