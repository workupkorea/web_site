"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
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
  const offsetRef = useRef(0);
  const draggingRef = useRef(false);
  const dragRef = useRef({ startX: 0, startOffset: 0, moved: false });
  const track = [...items, ...items];

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    let last = 0;

    const step = (now: number) => {
      const dt = last ? Math.min(now - last, 100) : 0; // 탭 전환 후 복귀 시 튀는 것 방지
      last = now;
      const singleSetWidth = el.scrollWidth / 2;

      if (singleSetWidth > 0) {
        let offset = offsetRef.current;
        const remaining = nudgeRemainingRef.current;
        if (draggingRef.current) {
          // 손가락으로 끄는 동안은 자동 이동 없이 손가락 위치만 따라간다.
        } else if (Math.abs(remaining) > 0.5) {
          const move = remaining * Math.min(1, dt / 120); // 화살표 클릭 시 부드럽게 감속하며 이동
          offset += move;
          nudgeRemainingRef.current -= move;
        } else if (!pausedRef.current) {
          offset += (SPEED_PX_PER_SEC * dt) / 1000;
        }
        offset = ((offset % singleSetWidth) + singleSetWidth) % singleSetWidth;
        offsetRef.current = offset;
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

  // 터치(스와이프) 드래그: 가로로 밀면 마퀴가 손가락을 따라 움직이고, 놓으면 다시 자동 이동한다.
  // touch-action: pan-y 이므로 세로 스크롤은 브라우저가 그대로 처리한다.
  const DRAG_THRESHOLD_PX = 6;
  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    dragRef.current = { startX: e.clientX, startOffset: offsetRef.current, moved: false };
    draggingRef.current = true;
    nudgeRemainingRef.current = 0;
  };
  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    if (!dragRef.current.moved && Math.abs(dx) > DRAG_THRESHOLD_PX) {
      dragRef.current.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (dragRef.current.moved) offsetRef.current = dragRef.current.startOffset - dx;
  };
  const onDragEnd = () => { draggingRef.current = false; };

  // 터치 기기는 탭 뒤에 mouseenter가 남아(sticky hover) 마퀴가 영영 멈추므로 마우스일 때만 일시정지한다.
  return (
    <div
      className="relative"
      onPointerEnter={(e) => { if (e.pointerType === "mouse") pausedRef.current = true; }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") pausedRef.current = false; }}
    >
      <div
        className="overflow-hidden [touch-action:pan-y]"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        // 드래그 직후 손을 뗄 때 링크가 눌려 이동하는 것을 막는다.
        onClickCapture={(e) => { if (dragRef.current.moved) { e.preventDefault(); e.stopPropagation(); dragRef.current.moved = false; } }}
      >
        <div ref={trackRef} className="flex w-max items-center will-change-transform">
          {track.map((b, i) => {
            const isCopy = i >= items.length;
            const logo = b.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ikSrc(b.logoUrl, 240)}
                alt={isCopy ? "" : b.name}
                className="h-[31%] w-auto max-w-[110px] object-contain md:h-[52%] md:max-w-[180px] grayscale opacity-70 transition-all hover:grayscale-0 hover:opacity-100"
              />
            ) : (
              // 로고 이미지가 없는 브랜드는 브랜드명을 텍스트로
              <span className="whitespace-nowrap text-sm font-black tracking-[0.08em] text-gray-400 transition-colors hover:text-gray-900 md:text-xl">
                {b.name}
              </span>
            );
            const boxClass = "flex h-[72px] min-w-[44px] flex-shrink-0 items-center justify-center px-4 md:h-20 md:px-8";

            return (
              <Link
                key={`${b.id}-${i}`}
                href={b.href}
                aria-hidden={isCopy}
                tabIndex={isCopy ? -1 : undefined}
                aria-label={`${b.name} 카탈로그 보기`}
                // 터치로 링크를 탭하면 포커스가 남아 마퀴가 멈추므로, 키보드 포커스(:focus-visible)일 때만 멈춘다.
                onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) pausedRef.current = true; }}
                onBlur={() => { pausedRef.current = false; }}
                className={`${boxClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#E5541B]`}
              >
                {logo}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 좌우 가장자리 페이드 — 로고가 갑자기 잘리지 않고 띠 배경으로 스며들게 한다 */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent md:w-16" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent md:w-16" />

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
