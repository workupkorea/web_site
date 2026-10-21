"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { Editorial, EditorialSection, EditorialSectionTag, EditorialTag } from "@/data/editorial";
import { ikSrc } from "@/lib/imageSrc";
import { heroPanelHeight } from "@/lib/heroPanel";

// 메인 배너 이미지 위 제품 태그 — 이미지 속 착용 제품 위에 "브랜드(작게, 위 오른쪽) + 제품명 박스"로 항상 노출.
// 점 좌표가 라벨의 중심이며, 클릭 시 제품 상세로 이동한다.
// inline=true(모바일·태블릿): 좌표 없이 목록 안에 일반 흐름으로 배치한다.
function TagChip({ tag, x, y, compact, px, inline }: { tag: EditorialTag; x?: number; y?: number; compact?: boolean; px?: boolean; inline?: boolean }) {
  const unit = px ? "px" : "%";
  return (
    <Link
      href={tag.href ?? `/products/${tag.productId}`}
      aria-label={`${tag.brand ? tag.brand + " " : ""}${tag.name}`}
      className={`${inline ? "relative items-start" : "absolute z-10 items-end"} flex flex-col min-h-[44px] justify-center group`}
      style={inline ? undefined : { left: `${x}${unit}`, top: `${y}${unit}`, transform: "translate(-50%, -50%)" }}
    >
      {tag.brandLogo ? (
        // 브랜드 로고 — 배경 없이 흰색으로 표시 (어떤 색 로고든 brightness(0) invert(1)로 흰색 변환, 가독성용 그림자)
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ikSrc(tag.brandLogo, 200)}
          alt={tag.brand ?? ""}
          className={`object-contain mb-1 ${compact ? "h-[8px]" : "h-[11px]"}`}
          style={{ filter: "brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0,0,0,0.45))" }}
        />
      ) : tag.brand ? (
        <span
          className={`font-bold uppercase text-white leading-none tracking-wide mb-1 ${compact ? "text-[8px]" : "text-[10px]"}`}
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", textShadow: "0 1px 3px rgba(0,0,0,0.45)" }}
        >
          {tag.brand}
        </span>
      ) : null}
      <span
        className={`whitespace-nowrap text-[#303236] border border-[#303236]/25 bg-[#f4f1ea]/45 backdrop-blur-[2px] group-hover:bg-[#f4f1ea]/70 transition-colors leading-tight ${
          compact ? "px-1.5 py-px text-[13px]" : "px-2.5 py-0.5 text-[18px]"
        }`}
        // 제품명은 Pretendard(layout에서 CDN 로드, 전 굵기 제공) 500으로 표시
        // 자간 -0.05em + 장평 94%(scaleX) — scaleX는 레이아웃 폭을 줄이지 못해 음수 마진으로 박스를 같이 좁힌다
        style={{ fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif", fontWeight: 500, letterSpacing: "-0.05em" }}
      >
        <span className="inline-block" style={{ transform: "scaleX(0.94)", margin: `0 -${(tag.name.length * 0.03).toFixed(2)}em` }}>{tag.name}</span>
      </span>
    </Link>
  );
}

// 모바일·태블릿 태그 목록 — 이미지 위에 좌표로 흩뿌리면 위치 맞추기 어렵고 겹치므로, 제목 바로 위에 좌측 정렬로 모아 보여준다.
function MobileTagList({ tags }: { tags: EditorialTag[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-col items-start gap-1 mb-3">
      {tags.map((tag, i) => (
        <TagChip key={i} tag={tag} compact inline />
      ))}
    </div>
  );
}

// PC 히어로 패널용 태그 레이어 — 패널은 화면 높이에 따라 비율이 바뀌고 이미지는 object-cover로 잘리므로,
// 태그 좌표(%)를 "컨테이너"가 아니라 "이미지 자체" 기준으로 보고 실제 렌더된 이미지 영역(px)으로 환산한다.
function PcTagLayer({ tags, imageUrl, position }: { tags: EditorialTag[]; imageUrl: string; position: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setNat({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  let content: React.ReactNode = null;
  if (box && nat && box.w > 0 && nat.w > 0) {
    const scale = Math.max(box.w / nat.w, box.h / nat.h);
    const rw = nat.w * scale;
    const rh = nat.h * scale;
    const [pxStr, pyStr] = position.split(" ");
    const posX = (parseFloat(pxStr) || 50) / 100;
    const posY = (parseFloat(pyStr) || 0) / 100;
    const offX = (box.w - rw) * posX;
    const offY = (box.h - rh) * posY;
    content = tags.map((tag, i) => (
      <TagChip key={i} tag={tag} px x={offX + (rw * (tag.pcX ?? tag.x)) / 100} y={offY + (rh * (tag.pcY ?? tag.y)) / 100} />
    ));
  }
  return <div ref={ref} className="absolute inset-0 z-10 pointer-events-none [&>*]:pointer-events-auto">{content}</div>;
}

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
            aria-label={`${section.title} 스타일 보기`}
            className="absolute inset-0 z-[2]"
          >
            <span className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/95 text-[#303236] text-[11px] font-semibold px-2.5 py-1.5 shadow-md opacity-0 translate-y-1 group-hover/img:opacity-100 group-hover/img:translate-y-0 transition-all">
              스타일 보기
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
  const [sheetOpen, setSheetOpen] = useState(false);

  // PC 히어로(고정 패널) 높이 — 콘텐츠가 짧을 때 100vh가 섹션을 늘려 생기는 하단 공백을 방지.
  // 히어로 높이를 min(뷰포트, 콘텐츠 자연높이)로 맞춰 콘텐츠가 길면 100vh 고정·스크롤,
  // 짧으면 콘텐츠 높이에 맞춰 공백이 생기지 않게 한다.
  const contentRef = useRef<HTMLDivElement>(null);
  const [heroHeight, setHeroHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const update = () => setHeroHeight(heroPanelHeight(document.documentElement.clientWidth, window.innerHeight, el.offsetHeight));
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
  const heroImageUrlPc = editorial.heroImageUrlPc || editorial.heroImageUrl;
  const heroPanel = (
    <div
      className="sticky top-0 self-start overflow-hidden bg-gray-100"
      style={{ flex: "0 0 49.947%", minWidth: 0, height: heroHeight ? `${heroHeight}px` : "100vh" }}
    >
      <>
        {heroImageUrlPc && (
          <img
            src={ikSrc(heroImageUrlPc, 1600)}
            alt={editorial.title}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
            style={{ objectPosition: imgPos }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60 z-[1]" />

        {/* 태그 — PC는 pcX/pcY 우선, 없으면 x/y 사용 */}
        {heroImageUrlPc && <PcTagLayer tags={tags} imageUrl={ikSrc(heroImageUrlPc, 1600)} position={imgPos} />}

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

          <div className="absolute bottom-[39px] left-4 right-4 z-[2] text-white">
            <MobileTagList tags={tags} />
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

          <div className="absolute bottom-[39px] left-4 right-4 z-[2] text-white">
            <MobileTagList tags={tags} />
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
                    aria-label={`${section.title} 스타일 보기`}
                    className="absolute inset-0 z-[2]"
                  >
                    <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-white/95 text-[#303236] text-[11px] font-semibold px-2.5 py-1.5 shadow-md">
                      스타일 보기
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
