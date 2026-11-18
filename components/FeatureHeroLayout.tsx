"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import type { Editorial, EditorialSection, EditorialSectionTag, EditorialTag } from "@/data/editorial";
import { ikSrc } from "@/lib/imageSrc";
import { heroPanelHeight } from "@/lib/heroPanel";

// 메인 배너 이미지 위 제품 태그 — 이미지 속 착용 제품 위에 "브랜드(작게, 위 오른쪽) + 제품명 박스"로 항상 노출.
// 점 좌표가 라벨의 중심이며, 클릭 시 제품 상세로 이동한다.
// inline=true(모바일·태블릿): 좌표 없이 목록 안에 일반 흐름으로 배치한다.
function TagChip({ tag, x, y, compact, px, inline }: { tag: EditorialTag; x?: number; y?: number; compact?: boolean; px?: boolean; inline?: boolean }) {
  const unit = px ? "px" : "%";
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  return (
    <>
    <button
      type="button"
      onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}
      aria-haspopup="dialog"
      aria-label={`${tag.brand ? tag.brand + " " : ""}${tag.name} 제품 정보 보기`}
      className={`${inline ? "relative items-start" : "absolute z-10 items-end"} flex flex-col min-h-[44px] justify-center group text-left`}
      style={inline ? undefined : { left: `${x}${unit}`, top: `${y}${unit}`, transform: "translate(-50%, -50%)" }}
    >
      {tag.brandLogo ? (
        // 브랜드 로고 — 배경 없이 흰색으로 표시 (어떤 색 로고든 brightness(0) invert(1)로 흰색 변환, 가독성용 그림자)
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ikSrc(tag.brandLogo, 200)}
          alt={tag.brand || tag.name}
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
    </button>
    {/* body로 포털 — 상위 요소의 쌓임 맥락(z-index)에 갇혀 하단 메뉴 뒤로 가려지는 것을 방지 */}
    {anchor && createPortal(<TagInfoPopup tag={tag} anchor={anchor} sheet={!!inline} onClose={() => setAnchor(null)} />, document.body)}
    </>
  );
}

// 태그 클릭 시 뜨는 제품 정보 창 — PC(sheet=false)는 태그 옆 작은 팝오버, 모바일·태블릿(sheet=true)은 하단에서 올라오는 시트.
// 큰 제품 사진·브랜드·제품명·품번과 (있으면) 스마트스토어 버튼을 보여준다. 바깥 클릭·Esc·✕로 닫는다.
function TagInfoPopup({ tag, anchor, sheet, onClose }: { tag: EditorialTag; anchor: DOMRect; sheet: boolean; onClose: () => void }) {
  const [shown, setShown] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true)); // 다음 프레임에 활성화해야 슬라이드/페이드가 걸린다
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onScrollResize = () => { if (!sheet) onClose(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    closeRef.current?.focus();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
  }, [onClose, sheet]);

  const image = tag.info?.image || tag.imageUrl;
  const storeUrl = tag.info?.storeUrl && /^https?:\/\//.test(tag.info.storeUrl) ? tag.info.storeUrl : undefined;

  const content = (
    <div>
      {/* 제품 이미지 — 크게 보여준다 (PC: 팝업 폭 가득 정사각형 / 모바일: 화면 높이의 약 42%까지) */}
      <div className={`bg-gray-100 overflow-hidden ${sheet ? "aspect-square max-h-[40vh] mx-auto" : "aspect-square w-full"}`}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ikSrc(image, 800)} alt={tag.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 font-black text-3xl select-none">WU</div>
        )}
      </div>
      <div className={sheet ? "px-5 pt-4 pb-[max(1.75rem,env(safe-area-inset-bottom))]" : "px-4 pt-3 pb-4"}>
        {tag.brand && <p className="text-[11px] font-bold tracking-wider text-gray-500 uppercase mb-0.5">{tag.brand}</p>}
        <p className="text-[16px] font-semibold text-[#303236] leading-snug break-keep">{tag.name}</p>
        {tag.price && <p className="text-[13px] text-[#303236] mt-1">{tag.price}</p>}
        {(tag.info?.colors?.length || tag.info?.sizes?.length) ? (
          <dl className="mt-3 space-y-1 text-[13px] text-[#303236]">
            {!!tag.info?.colors?.length && (
              <div className="flex gap-3"><dt className="w-12 flex-shrink-0 text-gray-500">컬러</dt><dd>{tag.info.colors.join(" · ")}</dd></div>
            )}
            {!!tag.info?.sizes?.length && (
              <div className="flex gap-3"><dt className="w-12 flex-shrink-0 text-gray-500">사이즈</dt><dd>{tag.info.sizes.join(" ")}</dd></div>
            )}
          </dl>
        ) : null}
        {storeUrl && (
          <a href={storeUrl} target="_blank" rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-1 min-h-[44px] border border-[#303236] text-[#303236] text-[13px] font-semibold hover:bg-[#303236] hover:text-white transition-colors">
            스마트스토어에서 보기 <span aria-hidden>↗</span>
          </a>
        )}
      </div>
    </div>
  );

  const closeBtn = (
    <button ref={closeRef} type="button" onClick={onClose} aria-label="닫기"
      className="absolute top-2 right-2 z-10 w-9 h-9 rounded-full bg-white/85 flex items-center justify-center text-gray-600 hover:text-black text-base leading-none shadow">
      ✕
    </button>
  );

  if (sheet) {
    return (
      <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true" aria-label={`${tag.name} 제품 정보`}>
        <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
        <div
          className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out max-h-[92vh] overflow-y-auto"
          style={{ transform: shown ? "translateY(0)" : "translateY(100%)" }}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-300" aria-hidden />
          {closeBtn}
          {content}
        </div>
      </div>
    );
  }

  // PC 팝오버 — 태그 아래(공간이 부족하면 위)에 가운데 정렬, 화면 밖으로 나가지 않게 보정
  const W = 300;
  const left = Math.min(window.innerWidth - W - 12, Math.max(12, anchor.left + anchor.width / 2 - W / 2));
  const below = anchor.bottom + 8 + 480 < window.innerHeight;
  return (
    <div className="fixed inset-0 z-[1000]" onClick={onClose}>
      <div
        role="dialog" aria-label={`${tag.name} 제품 정보`}
        onClick={(e) => e.stopPropagation()}
        className={`absolute bg-white shadow-xl border border-gray-200 transition-all duration-200 ${shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}
        style={{ width: W, left, ...(below ? { top: anchor.bottom + 8 } : { bottom: window.innerHeight - anchor.top + 8 }) }}
      >
        {closeBtn}
        {content}
      </div>
    </div>
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

// 섹션 이미지 랜덤 로테이션 — 후보가 2장 이상이면 접속할 때마다 랜덤으로 시작하고 일정 간격으로 다른 이미지로 교체.
// SSR/첫 렌더는 대표 이미지(0번)로 고정해 hydration 불일치를 막고, 마운트 후 랜덤 선택. 현재 노출 중인 이미지 1장만 로드(트래픽 최소화).
const IMAGE_ROTATE_INTERVAL_MS = 8000;
// 섹션 제목이 비어 있을 때 쓰는 대체 alt (SEO·접근성: 빈 alt 방지)
const SECTION_IMAGE_ALT = "기획전 제품 이미지";
// 360° 회전 뷰어 — 좌우 드래그(터치 스와이프)로 프레임을 넘겨 제품을 돌려본다.
// 자동으로 돌지 않고, 사용자가 직접 돌릴 때만 움직인다.
function SpinViewer({ frames, alt, href }: { frames: string[]; alt: string; href?: string }) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const n = frames.length;
  const [idx, setIdx] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; start: number; moved: boolean } | null>(null);

  // 모든 프레임 미리 불러오기(드래그 중 깜빡임 방지)
  useEffect(() => { frames.forEach((u) => { const im = new Image(); im.src = ikSrc(u, 800); }); }, [frames]);
  const wrap = (v: number) => ((v % n) + n) % n;
  return (
    <div
      ref={box}
      className="absolute inset-0 bg-white select-none cursor-grab active:cursor-grabbing"
      style={{ touchAction: "pan-y" }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, start: idx, moved: false }; }}
      onPointerMove={(e) => {
        if (!drag.current || !box.current) return;
        if (Math.abs(e.clientX - drag.current.x) > 6) drag.current.moved = true;
        const w = box.current.clientWidth || 300;
        // 카드 너비의 약 1.2배를 끌면 한 바퀴
        setIdx(wrap(drag.current.start - Math.round(((e.clientX - drag.current.x) / (w * 1.2)) * n)));
      }}
      // 거의 움직이지 않고 뗐으면 "클릭" — 상세페이지로 이동. 끌었으면 회전만 한다.
      onPointerUp={() => { const d = drag.current; drag.current = null; if (d && !d.moved) linkRef.current?.click(); }}
      onPointerCancel={() => { drag.current = null; }}
      role="img"
      aria-label={`${alt} 회전 이미지`}
    >
      {/* 클릭 시 이 링크를 눌러 이동 — 진짜 <a>라서 미리보기 링크 처리(?campaign=1)와 이동 방식이 기존 카드와 같다 */}
      {href && <Link ref={linkRef} href={href} tabIndex={-1} aria-hidden className="hidden">{alt}</Link>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ikSrc(frames[idx], 800)} alt={alt} draggable={false} className="w-full h-full object-contain pointer-events-none" style={{ filter: "brightness(1.2) contrast(1.03)" }} />
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] tracking-wide text-gray-500 bg-white/90 border border-gray-200 rounded-full px-2.5 py-1 pointer-events-none">
        ↔ 드래그해서 돌려보기
      </span>
    </div>
  );
}

function RotatingImage({ urls, alt, className }: { urls: string[]; alt: string; className?: string }) {
  const [idx, setIdx] = useState(0);
  const count = urls.length;

  useEffect(() => {
    if (count < 2) return;
    setIdx(Math.floor(Math.random() * count));
    const timer = setInterval(() => {
      setIdx((cur) => (cur + 1 + Math.floor(Math.random() * (count - 1))) % count); // 현재와 다른 이미지
    }, IMAGE_ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [count]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={idx}
      src={ikSrc(urls[idx] ?? urls[0], 1200)}
      alt={alt}
      className={className}
      style={count > 1 ? { animation: "imgFade 0.7s ease-out" } : undefined}
    />
  );
}

// ── 메인 대배너 롤링 ──
// 첫 노출은 대표 이미지 그대로. 추가 이미지가 있으면 일정 간격마다 다음 사진으로 "천천히" 크로스페이드한다.
// 다음 사진은 미리 내려받은 뒤에만 전환(빈 화면·깜빡임 방지) — 전환 때 한 장씩만 받아 트래픽을 아낀다.
// 탭이 숨겨졌거나 '동작 줄이기' 설정이면 멈춘다. PC·모바일 레이아웃이 한 인덱스를 공유한다.
const HERO_ROLL_INTERVAL_MS = 7000;
const HERO_FADE_MS = 2200;

function useHeroRoll(pools: string[][], random = false) {
  const count = Math.max(...pools.map((p) => p.length));
  const [idx, setIdx] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<number[]>([0]);
  const poolsKey = pools.map((p) => p.join("|")).join("||");

  useEffect(() => {
    if (count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    let current = 0;
    const timers: number[] = [];
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      let next = (current + 1) % count;
      if (random) { do { next = Math.floor(Math.random() * count); } while (next === current); }
      const urls = [...new Set(pools.map((p) => p[next]).filter(Boolean))].map((u) => ikSrc(u, 1600));
      Promise.all(urls.map((u) => new Promise<void>((res) => { const im = new Image(); im.onload = im.onerror = () => res(); im.src = u; }))).then(() => {
        if (cancelled) return;
        // 새 사진을 투명 상태로 먼저 올린 뒤, 다음 프레임에 활성화해야 페이드가 걸린다
        setLoaded((l) => (l.includes(next) ? l : [...l, next]));
        timers.push(window.setTimeout(() => {
          if (cancelled) return;
          setPrev(current);
          current = next;
          setIdx(next);
        }, 60));
      });
    }, HERO_ROLL_INTERVAL_MS);
    return () => { cancelled = true; window.clearInterval(interval); timers.forEach(window.clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, poolsKey, random]);

  return { idx, prev, loaded };
}

// 겹쳐 쌓은 사진 — 새 사진은 위에서 서서히 나타나고, 이전 사진은 아래에서 그대로 받쳐 준다(중간에 배경이 비쳐 보이는 현상 방지).
function HeroFadeStack({
  pool, roll, alt, className, style,
}: {
  pool: string[]; roll: { idx: number; prev: number | null; loaded: number[] }; alt: string; className: string; style?: React.CSSProperties;
}) {
  return (
    <>
      {roll.loaded.map((i) => {
        const url = pool[i % pool.length];
        if (!url) return null;
        const active = i === roll.idx;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={ikSrc(url, 1600)}
            alt={active ? alt : ""}
            aria-hidden={!active}
            className={className}
            style={{ ...style, opacity: active || i === roll.prev ? 1 : 0, zIndex: active ? 1 : 0, transition: `opacity ${HERO_FADE_MS}ms ease-in-out` }}
          />
        );
      })}
    </>
  );
}

// 대배너 이동 버튼 (예: 매거진 보기) — 주소가 있을 때만 노출. 터치 영역 44px 이상.
function HeroCta({ label, href }: { label?: string; href?: string }) {
  if (!href) return null;
  const text = label || "자세히 보기";
  const cls =
    "inline-flex items-center gap-2 min-h-[44px] px-5 bg-white text-[#303236] text-[13px] font-semibold tracking-wide hover:bg-[#E5541B] hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
  const arrow = <span aria-hidden>→</span>;
  return /^https?:\/\//.test(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{text}{arrow}</a>
  ) : (
    <Link href={href} className={cls}>{text}{arrow}</Link>
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
          {(section.spinFrames?.length ?? 0) >= 2 ? (
            <SpinViewer frames={section.spinFrames!} alt={section.title || SECTION_IMAGE_ALT} href={section.detailHref} />
          ) : section.imageUrl ? (
            <RotatingImage
              urls={section.imageUrls?.length ? section.imageUrls : [section.imageUrl]}
              alt={section.title || SECTION_IMAGE_ALT}
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="text-gray-300 text-6xl font-black select-none">WU</span>
          )}
        </div>
        {/* 섹션이미지 클릭 → 배너 상세 기획전 페이지 (핫스팟 태그보다 아래 z-index) */}
        {section.detailHref && !((section.spinFrames?.length ?? 0) >= 2) && (
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
  headingTag: HeadingTag = "h1",
}: {
  editorial: Editorial;
  reversed?: boolean;
  headingTag?: "h1" | "h2";
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

  // 대배너 롤링 — 대표 이미지(0번) + 추가 이미지. PC/모바일 대표·추가 이미지는 각자(PC 추가 이미지가 없으면 모바일 것을 공통 사용).
  const heroExtras = editorial.heroImageUrls ?? [];
  const pcExtras = editorial.heroImageUrlsPc?.length ? editorial.heroImageUrlsPc : heroExtras;
  const pcPool = [editorial.heroImageUrlPc || editorial.heroImageUrl, ...pcExtras].filter((u): u is string => !!u);
  const mobilePool = [editorial.heroImageUrl || editorial.heroImageUrlPc, ...heroExtras].filter((u): u is string => !!u);
  const roll = useHeroRoll([pcPool, mobilePool], editorial.heroImageOrder === "random");
  // 제품 태그는 대표 이미지 좌표 기준이라 다른 사진일 땐 서서히 숨긴다
  // (숨길 땐 페이드가 끝난 뒤 visibility:hidden — 보이지 않는 태그가 클릭되는 것을 막는다)
  const tagFade = HERO_FADE_MS / 2;
  const tagStyle: React.CSSProperties =
    roll.idx === 0
      ? { opacity: 1, visibility: "visible", transition: `opacity ${tagFade}ms ease-in-out` }
      : { opacity: 0, visibility: "hidden", transition: `opacity ${tagFade}ms ease-in-out, visibility 0s linear ${tagFade}ms` };

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
          <HeroFadeStack
            pool={pcPool}
            roll={roll}
            alt={editorial.title}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
            style={{ objectPosition: imgPos }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60 z-[1]" />

        {/* 태그 — PC는 pcX/pcY 우선, 없으면 x/y 사용 */}
        {heroImageUrlPc && (
          <div className="absolute inset-0 z-10 pointer-events-none" style={tagStyle}>
            <PcTagLayer tags={tags} imageUrl={ikSrc(heroImageUrlPc, 1600)} position={imgPos} />
          </div>
        )}

        <div className="absolute bottom-10 left-8 z-[2] text-white">
          <p className="text-sm mb-2 opacity-80 tracking-wide">{editorial.heroSubtitle}</p>
          <p className="text-3xl font-bold leading-tight">{editorial.title}</p>
          {editorial.heroCtaHref && (
            <div className="mt-5"><HeroCta label={editorial.heroCtaLabel} href={editorial.heroCtaHref} /></div>
          )}
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
      {/* 페이지 대표 H1 — 반응형 3개 레이아웃이 모두 DOM에 있으므로 H1은 여기 한 곳에만 둔다 (SEO: H1 1개) */}
      {/* 홈처럼 다른 페이지에 여러 개 삽입되는 경우엔 headingTag="h2"로 내려 H1 중복을 막는다. */}
      <HeadingTag className="sr-only">{editorial.title}</HeadingTag>

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
          {mobilePool.length > 0 && (
            <HeroFadeStack
              pool={mobilePool}
              roll={roll}
              alt={editorial.title}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60 z-[1]" />

          <div className="absolute bottom-[39px] left-4 right-4 z-[2] text-white">
            <div style={tagStyle}><MobileTagList tags={tags} /></div>
            <p className="mb-1 opacity-80" style={{ fontSize: "12px" }}>{editorial.heroSubtitle}</p>
            <p className="text-[22px] leading-tight tracking-tight" style={{ fontWeight: 700 }}>{editorial.title}</p>
            {editorial.heroCtaHref && (
              <div className="mt-3"><HeroCta label={editorial.heroCtaLabel} href={editorial.heroCtaHref} /></div>
            )}
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
                  href={tag.href ?? `/products/${tag.productId}`}
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
          {mobilePool.length > 0 && (
            <HeroFadeStack
              pool={mobilePool}
              roll={roll}
              alt={editorial.title}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60 z-[1]" />

          <div className="absolute bottom-[39px] left-4 right-4 z-[2] text-white">
            <div style={tagStyle}><MobileTagList tags={tags} /></div>
            <p className="mb-1 opacity-80" style={{ fontSize: "12px" }}>{editorial.heroSubtitle}</p>
            <p className="text-[22px] leading-tight tracking-tight" style={{ fontWeight: 700 }}>{editorial.title}</p>
            {editorial.heroCtaHref && (
              <div className="mt-3"><HeroCta label={editorial.heroCtaLabel} href={editorial.heroCtaHref} /></div>
            )}
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
                {(section.spinFrames?.length ?? 0) >= 2 ? (
                  <SpinViewer frames={section.spinFrames!} alt={section.title || SECTION_IMAGE_ALT} href={section.detailHref} />
                ) : section.imageUrl ? (
                  <RotatingImage
                    urls={section.imageUrls?.length ? section.imageUrls : [section.imageUrl]}
                    alt={section.title || SECTION_IMAGE_ALT}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-gray-300 text-5xl font-black select-none">WU</span>
                )}
                {/* 섹션이미지 클릭 → 배너 상세 기획전 페이지 */}
                {section.detailHref && !((section.spinFrames?.length ?? 0) >= 2) && (
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
                  href={tag.href ?? `/products/${tag.productId}`}
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
