"use client";
import { useEffect, useRef } from "react";
import { ikSrc } from "@/lib/imageSrc";
import type { BrandLogoItem } from "@/lib/brand-marquee";

// 로고를 2벌 이어붙여 자동 스크롤(rAF)하고, 양쪽 화살표로 수동 이동도 지원한다.
// scrollLeft가 아니라 transform으로 이동시킨다 — iOS Safari는 scrollLeft를 정수 px로 반올림해
// 프레임당 0.6px 같은 미세 증가분을 누적해도 위치가 그대로라 마퀴가 멈춰 보이기 때문이다.
// 위치는 자바스크립트 float 값으로 직접 들고 있고, 시간(dt) 기반이라 저전력 모드(30fps)에서도 속도가 같다.
const SPEED_PX_PER_SEC = 36;
const NUDGE_PX = 240;

export default function BrandMarqueeClient({ items }: { items: BrandLogoItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const nudgeRemainingRef = useRef(0);
  const track = [...items, ...items];

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    let last = 0;
    let offset = 0;

    const step = (now: number) => {
      const dt = last ? Math.min(now - last, 100) : 0; // 탭 전환 후 복귀 시 튀는 것 방지
      last = now;
      const singleSetWidth = el.scrollWidth / 2;

      if (singleSetWidth > 0) {
        const remaining = nudgeRemainingRef.current;
        if (Math.abs(remaining) > 0.5) {
          const move = remaining * Math.min(1, dt / 120); // 화살표 클릭 시 부드럽게 감속하며 이동
          offset += move;
          nudgeRemainingRef.current -= move;
        } else if (!pausedRef.current) {
          offset += (SPEED_PX_PER_SEC * dt) / 1000;
        }
        offset = ((offset % singleSetWidth) + singleSetWidth) % singleSetWidth;
        el.style.transform = `translate3d(${-offset}px, 0, 0)`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const nudge = (dir: 1 | -1) => {
    nudgeRemainingRef.current += dir * NUDGE_PX;
  };

  // 터치 기기는 탭 뒤에 mouseenter가 남아(sticky hover) 마퀴가 영영 멈추므로 마우스일 때만 일시정지한다.
  return (
    <div
      className="relative"
      onPointerEnter={(e) => { if (e.pointerType === "mouse") pausedRef.current = true; }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") pausedRef.current = false; }}
    >
      <div className="overflow-hidden">
        <div ref={trackRef} className="flex w-max items-center will-change-transform">
          {track.map((b, i) => (
            <div
              key={`${b.id}-${i}`}
              aria-hidden={i >= items.length}
              className="flex h-16 flex-shrink-0 items-center justify-center px-6 md:h-20 md:px-8"
            >
              {b.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ikSrc(b.logoUrl, 240)}
                  alt={i < items.length ? b.name : ""}
                  className="h-[52%] w-auto max-w-[180px] object-contain grayscale opacity-70 transition-all hover:grayscale-0 hover:opacity-100"
                />
              ) : (
                // 로고 이미지가 없는 브랜드는 브랜드명을 텍스트로
                <span className="whitespace-nowrap text-lg font-black tracking-[0.08em] text-gray-400 transition-colors hover:text-gray-900 md:text-xl">
                  {b.name}
                </span>
              )}
            </div>
          ))}
        </div>
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
