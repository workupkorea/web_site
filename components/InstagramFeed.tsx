"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { oxanium } from "@/lib/oxanium";
import {
  DEFAULT_INSTAGRAM_FEED,
  normalizeInstagramFeed,
  normalizeAccount,
  parseInstagramUrl,
  type InstagramFeedConfig,
} from "@/lib/instagram-feed";
import type { InstagramMedia } from "@/data/products";
import { ikSrc } from "@/lib/imageSrc";

// 로고와 유사한 영문 디스플레이 폰트 (WORKUP on Instagram 타이틀용)

// 상품 상세페이지 인스타 피드 — 해당 상품 등록 미디어를 9:16 세로 카드로 노출.
// 연한 그레이 배경 블록 + "WORKUP on Instagram" 타이틀로 영역 구분.
// 2장 이상이면 가로 스크롤(넘김) — 모바일 스와이프 / 데스크탑 좌우 화살표.
// 링크가 있으면 클릭 시 인스타 이동, 릴스/영상은 ▶ 배지. 미디어 없으면 렌더 안 함.
export default function InstagramFeed({ posts, contained }: { posts?: InstagramMedia[]; contained?: boolean }) {
  const [cfg, setCfg] = useState<InstagramFeedConfig>({ ...DEFAULT_INSTAGRAM_FEED });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [nav, setNav] = useState({ left: false, right: false });

  useEffect(() => {
    fetch("/api/admin/site-settings/instagram_feed")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setCfg(normalizeInstagramFeed(d)); })
      .catch(() => {});
  }, []);

  const items = (posts ?? []).filter((p) => p && typeof p.image === "string" && p.image.trim() !== "");

  const updateNav = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setNav({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => { updateNav(); }, [updateNav, items.length, cfg.is_visible]);

  if (!cfg.is_visible) return null;
  if (items.length === 0) return null;

  const acct = normalizeAccount(cfg.account);
  const scrollByView = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const followLink = acct && (
    <a href={acct.url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#333333]/70 hover:text-[#333333] transition-colors whitespace-nowrap">
      @{acct.handle} 팔로우 →
    </a>
  );

  const inner = (
    <div className="bg-[#f5f5f5] px-5 pt-6 pb-8 md:px-8 md:pt-7 md:pb-10">
      {/* 타이틀 (얇게) */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <h2 className={`${oxanium.className} flex items-center gap-2 text-lg md:text-xl text-[#333333]`}>
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
          <span><span className="font-bold">WORKUP</span> <span className="font-normal">on Instagram</span></span>
        </h2>
        {acct && <div className="hidden sm:block">{followLink}</div>}
      </div>

      {/* 가로 넘김 캐러셀 */}
      <div className="relative">
        {items.length > 1 && nav.left && (
          <button type="button" onClick={() => scrollByView(-1)} aria-label="이전"
            className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 w-9 h-9 items-center justify-center rounded-full bg-white shadow-md text-[#303236] hover:bg-gray-50 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}
        {items.length > 1 && nav.right && (
          <button type="button" onClick={() => scrollByView(1)} aria-label="다음"
            className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 w-9 h-9 items-center justify-center rounded-full bg-white shadow-md text-[#303236] hover:bg-gray-50 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        )}

        <div ref={scrollRef} onScroll={updateNav}
          className="flex gap-2.5 md:gap-3 overflow-x-auto snap-x snap-mandatory pb-1 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}>
          {items.map((item, i) => {
            const parsed = item.url ? parseInstagramUrl(item.url) : null;
            const isVideo = parsed?.type === "reel" || parsed?.type === "tv";
            const media = (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ikSrc(item.image, 600)} alt={`인스타그램 ${i + 1}`} loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300" />
                {isVideo && (
                  <span className="absolute top-2 right-2 z-10 text-white drop-shadow-md">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  </span>
                )}
                {item.url && <span className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors" />}
              </>
            );
            const cellCls = "group relative aspect-[9/16] w-[150px] sm:w-[175px] md:w-[200px] flex-shrink-0 snap-start overflow-hidden rounded-lg bg-gray-200";
            return item.url ? (
              <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className={`${cellCls} block`}>{media}</a>
            ) : (
              <div key={i} className={cellCls}>{media}</div>
            );
          })}
        </div>
      </div>

      {acct && <div className="mt-5 text-center sm:hidden">{followLink}</div>}
    </div>
  );

  if (contained) {
    return (
      <section className="py-10 md:py-14">
        <div className="max-w-screen-xl mx-auto px-6 md:px-12">{inner}</div>
      </section>
    );
  }
  // 탭 내부: 상세 정보 섹션의 상단·좌우 패딩(py-10/14, px-5/12)을 음수 여백으로 상쇄해
  // 그레이 밴드가 탭 바로 아래 상단 영역을 가득 채우게 한다.
  return <div className="-mt-10 -mx-5 mb-8 md:-mt-14 md:-mx-12">{inner}</div>;
}
