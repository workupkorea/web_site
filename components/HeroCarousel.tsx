"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { bgColorWithAlpha } from "@/lib/color";
import { ikSrc } from "@/lib/imageSrc";

type TextLayer = {
  id: string;
  text: string;
  font_family: string;
  color: string;
  weight: number;
  align: "left" | "center" | "right";
  letter_spacing: number;
  scale_x: number;
  line_height: number;
  opacity?: number;
  bg_color?: string;
  pc_x: number; pc_y: number; pc_size: number;
  mobile_x: number; mobile_y: number; mobile_size: number;
};

type HeroSlide = {
  id: string;
  season_text: string;
  title: string;
  subtitle: string;
  btn1_text: string;
  btn1_link: string;
  btn1_visible: boolean;
  btn2_text: string;
  btn2_link: string;
  btn2_visible: boolean;
  pc_image_url: string | null;
  mobile_image_url: string | null;
  pc_video_url?: string | null;
  mobile_video_url?: string | null;
  video_duration?: number | null;
  link_url?: string | null;
  link_new_tab?: boolean | null;
  pc_image_position?: string | null;
  mobile_image_position?: string | null;
  pc_image_scale?: number | null;
  mobile_image_scale?: number | null;
  text_layers?: TextLayer[] | null;
  content_x?: number | null;
  content_y?: number | null;
  is_visible: boolean;
  sort_order: number;
};

const AUTO_INTERVAL = 5000;

export default function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const total = slides.length;
  const touchStartX = useRef<number | null>(null);
  // 슬라이드별 동영상 엘리먼트(PC/모바일) 보관 — 현재 슬라이드 영상만 처음부터 재생.
  const videoMap = useRef<Record<number, { pc: HTMLVideoElement | null; mobile: HTMLVideoElement | null }>>({});
  const endedHandledRef = useRef(false);

  // 자동 슬라이드(이미지). 동영상 슬라이드는 노출 시간(video_duration)이 설정된 경우 그 시간 후 전환,
  // 설정하지 않았다면 타이머로 넘기지 않고 영상이 1회 재생 완료되면 onEnded 로 넘어간다.
  useEffect(() => {
    if (total <= 1) return;
    const cur = slides[current];
    if (cur?.pc_video_url) {
      if (!cur.video_duration) return;
      const t = setTimeout(() => setCurrent((c) => (c + 1) % total), cur.video_duration * 1000);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCurrent((c) => (c + 1) % total), AUTO_INTERVAL);
    return () => clearTimeout(t);
  }, [current, total, slides]);

  // 현재 슬라이드가 동영상이면 처음부터 재생, 나머지 영상은 일시정지.
  useEffect(() => {
    endedHandledRef.current = false;
    Object.entries(videoMap.current).forEach(([k, v]) => {
      const isCur = Number(k) === current;
      [v.pc, v.mobile].forEach((el) => {
        if (!el) return;
        try {
          if (isCur) { el.currentTime = 0; const p = el.play(); if (p) p.catch(() => {}); }
          else el.pause();
        } catch { /* noop */ }
      });
    });
  }, [current]);

  // 동영상 1회 재생 완료 → 다음 슬라이드로 (PC/모바일 중복 호출 방지).
  const onVideoEnd = (idx: number) => {
    if (idx !== current || endedHandledRef.current) return;
    endedHandledRef.current = true;
    setCurrent((c) => (c + 1) % total);
  };

  const navigate = (dir: 1 | -1) => {
    setCurrent((c) => (c + dir + total) % total);
  };

  // 슬라이드 클릭 시 이동 (link_url 설정된 경우만)
  const goToSlideLink = (slide: HeroSlide) => {
    if (!slide.link_url) return;
    if (slide.link_new_tab) { window.open(slide.link_url, "_blank", "noopener,noreferrer"); return; }
    if (slide.link_url.startsWith("/")) router.push(slide.link_url);
    else window.location.href = slide.link_url;
  };

  // 터치 스와이프
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) navigate(diff > 0 ? 1 : -1);
    touchStartX.current = null;
  };

  return (
    <section
      className="relative bg-[#303236] overflow-hidden aspect-[750/695] md:aspect-[1920/680] touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >

      {/* 슬라이드 트랙 — section을 absolute로 가득 채운 뒤 translateX 슬라이딩 */}
      <div
        className="absolute inset-0 flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {slides.map((slide, idx) => {
          const pcImage = slide.pc_image_url;
          const mobileImage = slide.mobile_image_url || pcImage;
          const pcVideo = slide.pc_video_url;
          const mobileVideo = slide.mobile_video_url || pcVideo;

          const layers = slide.text_layers ?? [];
          // 노출 시간이 지정된 동영상은 시간이 찰 때까지 루프 재생, 아니면 1회 재생 후 onEnded로 전환
          const loopVideo = total <= 1 || !!slide.video_duration;

          const clickable = !!slide.link_url;

          return (
            <div
              key={slide.id}
              className={`flex-shrink-0 w-full h-full relative flex flex-col justify-center overflow-hidden${clickable ? " cursor-pointer" : ""}`}
              style={{ containerType: "inline-size" }}
              {...(clickable ? {
                role: "link",
                tabIndex: 0,
                onClick: () => goToSlideLink(slide),
                onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goToSlideLink(slide); } },
              } : {})}
            >
              {/* 배경 — 동영상 슬라이드 우선, 없으면 이미지, 둘 다 없으면 액센트 */}
              {pcVideo ? (
                <>
                  <video
                    ref={(el) => { (videoMap.current[idx] ??= { pc: null, mobile: null }).pc = el; }}
                    src={pcVideo}
                    autoPlay muted playsInline preload="metadata"
                    loop={loopVideo}
                    onEnded={() => onVideoEnd(idx)}
                    className="absolute inset-0 w-full h-full object-cover hidden md:block"
                    style={{
                      objectPosition: slide.pc_image_position || "50% 50%",
                      transform: `scale(${slide.pc_image_scale || 1})`,
                      transformOrigin: slide.pc_image_position || "50% 50%",
                    }}
                  />
                  <video
                    ref={(el) => { (videoMap.current[idx] ??= { pc: null, mobile: null }).mobile = el; }}
                    src={mobileVideo || pcVideo}
                    autoPlay muted playsInline preload="metadata"
                    loop={loopVideo}
                    onEnded={() => onVideoEnd(idx)}
                    className="absolute inset-0 w-full h-full object-cover md:hidden"
                    style={{
                      objectPosition: slide.mobile_image_position || "50% 50%",
                      transform: `scale(${slide.mobile_image_scale || 1})`,
                      transformOrigin: slide.mobile_image_position || "50% 50%",
                    }}
                  />
                </>
              ) : pcImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ikSrc(pcImage, 1920)}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover hidden md:block"
                    style={{
                      objectPosition: slide.pc_image_position || "50% 50%",
                      transform: `scale(${slide.pc_image_scale || 1})`,
                      transformOrigin: slide.pc_image_position || "50% 50%",
                    }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ikSrc(mobileImage || pcImage, 800)}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover md:hidden"
                    style={{
                      objectPosition: slide.mobile_image_position || "50% 50%",
                      transform: `scale(${slide.mobile_image_scale || 1})`,
                      transformOrigin: slide.mobile_image_position || "50% 50%",
                    }}
                  />
                </>
              ) : (
                <div className="absolute right-0 top-0 h-full w-1/3 bg-[#152238] hidden lg:block" />
              )}

              {/* 자유 배치 텍스트 개체 (PC/모바일 각각 좌표·크기) */}
              {layers.length > 0 && (
                <>
                  <div className="hidden md:block">
                    {layers.map((l) => (
                      <div key={l.id} className="absolute z-[2]" style={{
                        left: `${l.pc_x}%`, top: `${l.pc_y}%`,
                        fontFamily: l.font_family || undefined, color: l.color,
                        fontWeight: l.weight, textAlign: l.align,
                        letterSpacing: `${l.letter_spacing}px`, lineHeight: l.line_height,
                        fontSize: `${(l.pc_size / 1920 * 100).toFixed(3)}cqw`,
                        transform: `scaleX(${l.scale_x})`, transformOrigin: "left top",
                        whiteSpace: "pre-wrap",
                        ...(l.bg_color ? { backgroundColor: bgColorWithAlpha(l.bg_color, l.opacity ?? 1), padding: "0.08em 0.35em" } : {}),
                      }}>{l.text}</div>
                    ))}
                  </div>
                  <div className="md:hidden">
                    {layers.map((l) => (
                      <div key={l.id} className="absolute z-[2]" style={{
                        left: `${l.mobile_x}%`, top: `${l.mobile_y}%`,
                        fontFamily: l.font_family || undefined, color: l.color,
                        fontWeight: l.weight, textAlign: l.align,
                        letterSpacing: `${l.letter_spacing}px`, lineHeight: l.line_height,
                        fontSize: `${(l.mobile_size / 750 * 100).toFixed(3)}cqw`,
                        transform: `scaleX(${l.scale_x})`, transformOrigin: "left top",
                        whiteSpace: "pre-wrap",
                        ...(l.bg_color ? { backgroundColor: bgColorWithAlpha(l.bg_color, l.opacity ?? 1), padding: "0.08em 0.35em" } : {}),
                      }}>{l.text}</div>
                    ))}
                  </div>
                </>
              )}

              {/* 버튼 CTA — content_x/content_y 위치 (텍스트는 자유 배치 캔버스 사용) */}
              {((slide.btn1_visible && slide.btn1_text) || (slide.btn2_visible && slide.btn2_text)) && (
                <div
                  className="absolute z-[2]"
                  style={{
                    left: `${slide.content_x ?? 5}%`,
                    top: `${slide.content_y ?? 35}%`,
                    transform: "translateY(-50%)",
                  }}
                >
                  <div className="flex flex-wrap gap-4">
                    {slide.btn1_visible && slide.btn1_text && (
                      <a
                        href={slide.btn1_link}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-block bg-[#E5541B] text-white text-sm tracking-widest px-8 py-3 hover:bg-[#d05518] transition-colors"
                      >
                        {slide.btn1_text}
                      </a>
                    )}
                    {slide.btn2_visible && slide.btn2_text && (
                      <a
                        href={slide.btn2_link}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-block border border-white text-white text-sm tracking-widest px-8 py-3 hover:bg-white hover:text-[#303236] transition-colors"
                      >
                        {slide.btn2_text}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 좌우 화살표 (PC 전용) */}
      {total > 1 && (
        <>
          <button
            onClick={() => navigate(-1)}
            className="hidden md:flex absolute top-1/2 -translate-y-1/2 z-[3] items-center justify-center p-2 opacity-80 hover:opacity-100 transition-opacity"
            style={{ left: 100 }}
            aria-label="이전 슬라이드"
          >
            <svg
              fill="none"
              stroke="white"
              strokeWidth={1}
              viewBox="0 0 24 24"
              style={{ width: 80, height: 120 }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => navigate(1)}
            className="hidden md:flex absolute top-1/2 -translate-y-1/2 z-[3] items-center justify-center p-2 opacity-80 hover:opacity-100 transition-opacity"
            style={{ right: 100 }}
            aria-label="다음 슬라이드"
          >
            <svg
              fill="none"
              stroke="white"
              strokeWidth={1}
              viewBox="0 0 24 24"
              style={{ width: 80, height: 120 }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* 하단 페이지 카운터 pill + 모바일 전용 넘김 버튼(PC는 좌우 화살표로 대체됨) */}
      {total > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[3] flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="md:hidden flex items-center justify-center w-11 h-11 opacity-80 active:opacity-100 transition-opacity"
            aria-label="이전 슬라이드"
          >
            <svg fill="none" stroke="white" strokeWidth={1.5} viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="bg-black/50 backdrop-blur-sm text-white text-xs md:text-sm font-medium px-3 py-1 md:px-5 md:py-2 rounded-full tracking-wide select-none">
            {current + 1}
            <span className="opacity-50 mx-1 md:mx-1.5">/</span>
            {total}
          </div>
          <button
            onClick={() => navigate(1)}
            className="md:hidden flex items-center justify-center w-11 h-11 opacity-80 active:opacity-100 transition-opacity"
            aria-label="다음 슬라이드"
          >
            <svg fill="none" stroke="white" strokeWidth={1.5} viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}
