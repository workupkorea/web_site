"use client";
import { useState } from "react";

// 유튜브 파사드 — 처음엔 썸네일 + 재생 버튼만 그리고, 누를 때 iframe 을 로드한다.
// (페이지 로드 시 유튜브 스크립트 ~수백KB 를 받지 않아 성능에 유리, nocookie 도메인 사용)
export default function YouTubePlayer({
  id,
  title,
  vertical = false,
}: {
  id: string;
  title: string;
  vertical?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  // maxres 썸네일이 없는 영상은 hqdefault 로 대체
  const [thumb, setThumb] = useState(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);

  return (
    <div className={`relative w-full bg-black overflow-hidden ${vertical ? "aspect-[9/16]" : "aspect-video"}`}>
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
          className="group absolute inset-0 w-full h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E5541B]"
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
            className="absolute inset-0 w-full h-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
          />
          <span aria-hidden className="absolute inset-0 bg-black/25" />
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#E5541B] text-white shadow-lg transition-transform group-hover:scale-105"
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7 md:w-9 md:h-9 ml-1" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
