"use client";
import { useState } from "react";

// 유튜브 파사드 — 처음엔 썸네일 + 재생 버튼만 그리고, 누를 때 iframe 을 로드한다.
// (페이지 로드 시 유튜브 스크립트 ~수백KB 를 받지 않아 성능에 유리, nocookie 도메인 사용)
// 재생 전에는 영화 포스터처럼 보이도록: 모서리 크롭 마크 · 하단 그라데이션 위 제목/설명 · 링 모양 재생 버튼.
export default function YouTubePlayer({
  id,
  title,
  vertical = false,
  heading,
  caption,
  index,
}: {
  id: string;
  title: string;
  vertical?: boolean;
  /** 썸네일 위에 크게 얹을 영상 제목 */
  heading?: string;
  /** 제목 아래 한 줄 설명 */
  caption?: string;
  /** 여러 개일 때 표시할 번호(1부터) */
  index?: number;
}) {
  const [playing, setPlaying] = useState(false);
  // maxres 썸네일이 없는 영상은 hqdefault 로 대체
  const [thumb, setThumb] = useState(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);

  const corner = "absolute w-4 h-4 md:w-6 md:h-6 border-white/70 pointer-events-none";
  return (
    <div className={`relative w-full bg-black overflow-hidden ${vertical ? "ring-1 ring-white/10 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]" : ""} ${vertical ? "aspect-[9/16]" : "aspect-video"}`}>
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`영상 재생: ${title}`}
          className="group absolute inset-0 w-full h-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E5541B]"
        >
          <img
            src={thumb}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={(e) => {
              // 유튜브는 없는 maxres 에 120x90 회색 이미지를 돌려준다 → 작으면 hqdefault 로 교체
              if (e.currentTarget.naturalWidth <= 120) setThumb(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
            }}
            onError={() => setThumb(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)}
            className="absolute inset-0 w-full h-full object-cover saturate-[0.9] transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04]"
          />
          {/* 영화 같은 명암: 위·아래를 눌러 글자가 또렷하게 */}
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/45" />
          <span aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.45)_100%)]" />

          {/* 모서리 크롭 마크 */}
          <span aria-hidden className={`${corner} left-3 top-3 md:left-5 md:top-5 border-l-2 border-t-2`} />
          <span aria-hidden className={`${corner} right-3 top-3 md:right-5 md:top-5 border-r-2 border-t-2`} />
          <span aria-hidden className={`${corner} left-3 bottom-3 md:left-5 md:bottom-5 border-l-2 border-b-2`} />
          <span aria-hidden className={`${corner} right-3 bottom-3 md:right-5 md:bottom-5 border-r-2 border-b-2`} />

          {/* 상단 라벨 */}
          <span className="absolute left-6 top-6 md:left-9 md:top-9 flex items-center gap-2 text-[10px] md:text-[11px] font-bold tracking-[0.3em] text-white/90">
            <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[#E5541B]" />
            FILM{index ? <span className="text-white/60"> · {String(index).padStart(2, "0")}</span> : null}
          </span>

          {/* 재생 버튼 — 심플한 흰 원 + 삼각형 */}
          <span aria-hidden className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-white text-[#1d1e20] transition-transform duration-300 group-hover:scale-110">
            <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-6 md:h-6 ml-0.5" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>

          {/* 하단 제목·설명 */}
          {(heading || caption) && (
            <span className="absolute inset-x-6 bottom-6 md:inset-x-9 md:bottom-9 block pr-10">
              {heading && <span className="block text-[17px] md:text-[26px] font-black leading-tight tracking-tight text-white break-keep">{heading}</span>}
              {caption && <span className="block mt-1 text-[12px] md:text-[14px] text-white/75">{caption}</span>}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
