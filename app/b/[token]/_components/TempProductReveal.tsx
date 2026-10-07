"use client";
import { useEffect, useState } from "react";
import { NOTICE_COVER_ASPECT, noticeCoverAspect } from "@/lib/noticeImage";

// 대표 사진 한 장 + 상품명 + 설명만 보여준다 (여러 장을 모아보는 펼쳐보기 기능은 제거됨).
// 대표 사진은 가로형(640:451) 박스에 보여주고, 터치하면 큰 화면에서 스크롤하며 자세히 볼 수 있다.
// portrait(세로형)이면 잘라내지 않고 전체를 보여준다.
export default function TempProductReveal({
  images,
  name,
  tagline,
  portrait = false,
}: {
  images: string[];
  name: string;
  tagline?: React.ReactNode;
  portrait?: boolean;
}) {
  const cover = images[0];
  const [zoom, setZoom] = useState(false);

  // 확대 화면이 열려 있는 동안 뒤 화면 스크롤을 막는다.
  useEffect(() => {
    if (!zoom) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [zoom]);

  return (
    <div>
      <div className="mb-3">
        {cover ? (
          <button
            type="button"
            onClick={() => setZoom(true)}
            className={`relative block rounded-lg overflow-hidden bg-gray-50 ${portrait ? "w-3/5 mx-auto" : "w-full"}`}
            style={{ aspectRatio: noticeCoverAspect(portrait) }}
            aria-label={`${name} 사진 크게 보기`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={name} className={`w-full h-full ${portrait ? "object-contain" : "object-cover"}`} />
          </button>
        ) : (
          <div
            className="relative w-full rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center text-gray-300 text-xs"
            style={{ aspectRatio: NOTICE_COVER_ASPECT }}
          >
            이미지 없음
          </div>
        )}
      </div>

      <div className="min-w-0">
        <h2 className="font-bold text-[15.5px] text-gray-900">{name}</h2>
        {tagline}
      </div>

      {zoom && cover && (
        <div className="fixed inset-0 z-50 bg-black/90 overflow-auto overscroll-contain" onClick={() => setZoom(false)}>
          <button
            type="button"
            onClick={() => setZoom(false)}
            className="fixed top-3 right-3 z-10 w-11 h-11 rounded-full bg-black/60 text-white text-2xl leading-none flex items-center justify-center"
            aria-label="닫기"
          >
            ×
          </button>
          {/* 세로형은 화면 너비에 맞춰 세로 스크롤, 가로형은 더 크게 펼쳐 상하좌우로 스크롤 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt={name}
            onClick={(e) => e.stopPropagation()}
            className={`block h-auto max-w-none ${portrait ? "w-full" : "w-[220%]"}`}
          />
        </div>
      )}
    </div>
  );
}
