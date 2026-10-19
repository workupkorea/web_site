"use client";
// 썸네일만 먼저 보여주고, 누르면 그 자리에서 재생(iframe은 클릭 후에만 로드 → 초기 성능 보호).
import { useState } from "react";

export default function YoutubeLongformCard({ id, title, showTitle = true }: { id: string; title: string; showTitle?: boolean }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div>
      <div className="relative aspect-video overflow-hidden bg-black">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`${title} 재생`}
            className="group absolute inset-0 w-full h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E5541B]"
          >
            <img
              src={`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`}
              // 고해상도(1280×720)가 없는 영상은 기본 썸네일로 대체
              onError={(e) => {
                const img = e.currentTarget;
                const fallback = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
                if (img.src !== fallback) img.src = fallback;
              }}
              alt={title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/35 transition-colors">
              <span className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-6 h-6 ml-0.5 text-[#303236]" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
          </button>
        )}
      </div>
      {showTitle && <p className="mt-3 text-sm font-medium text-[#303236] line-clamp-2">{title}</p>}
    </div>
  );
}
