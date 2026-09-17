"use client";
import { useEffect, useRef } from "react";
import { ikSrc } from "@/lib/imageSrc";
import type { BrandLogoItem } from "@/lib/brand-marquee";

// 로고를 2벌 이어붙여 자동 스크롤(rAF)하고, 양쪽 화살표로 수동 이동도 지원한다.
// overflow-hidden 컨테이너라 사용자가 직접 드래그/휠로는 못 움직이고,
// 자동 흐름 + 화살표 클릭 + 로고 위 hover-to-pause만 가능하다.
export default function BrandMarqueeClient({ items }: { items: BrandLogoItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const track = [...items, ...items];

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf: number;
    const step = () => {
      if (!pausedRef.current) {
        const singleSetWidth = el.scrollWidth / 2;
        el.scrollLeft += 0.6;
        if (el.scrollLeft >= singleSetWidth) el.scrollLeft -= singleSetWidth;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const nudge = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    pausedRef.current = true;
    el.scrollBy({ left: dir * 240, behavior: "smooth" });
    window.setTimeout(() => {
      const singleSetWidth = el.scrollWidth / 2;
      if (el.scrollLeft >= singleSetWidth) el.scrollLeft -= singleSetWidth;
      else if (el.scrollLeft < 0) el.scrollLeft += singleSetWidth;
      pausedRef.current = false;
    }, 500);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <div ref={trackRef} className="flex items-center overflow-x-hidden">
        {track.map((b, i) => (
          <div
            key={`${b.id}-${i}`}
            aria-hidden={i >= items.length}
            className="flex h-16 flex-shrink-0 items-center justify-center px-6 md:h-20 md:px-8"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ikSrc(b.logoUrl, 240)}
              alt={i < items.length ? b.name : ""}
              className="h-[52%] w-auto max-w-[180px] object-contain grayscale opacity-70 transition-all hover:grayscale-0 hover:opacity-100"
            />
          </div>
        ))}
      </div>

      {/* 화면이 좁으면(모바일) 박스 바깥에 놓을 공간이 없어 데스크톱에서만 노출 */}
      <button
        type="button"
        onClick={() => nudge(-1)}
        aria-label="이전 브랜드"
        className="absolute top-1/2 -left-16 hidden h-9 w-9 -translate-y-1/2 items-center justify-center text-gray-300 transition-colors hover:text-gray-500 md:flex"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => nudge(1)}
        aria-label="다음 브랜드"
        className="absolute top-1/2 -right-16 hidden h-9 w-9 -translate-y-1/2 items-center justify-center text-gray-300 transition-colors hover:text-gray-500 md:flex"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
