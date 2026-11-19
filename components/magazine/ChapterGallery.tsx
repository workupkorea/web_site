"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { MagazineImage } from "@/lib/home-magazine";

// 챕터 사진 전체 보기 — 챕터 레이아웃에는 일부 컷만 들어가므로, 버튼을 누르면 이 챕터의 모든 사진(A컷+B컷)을
// 한 화면에 모아 보여준다. 사진을 누르면 크게 보기(좌우 이동). <dialog>라 Esc 닫기·포커스 가둠이 기본 제공된다.
export default function ChapterGallery({ title, no, images, tone = "dark", full = false }: { title: string; no: number; images: MagazineImage[]; tone?: "dark" | "light"; full?: boolean }) {
  const listRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null); // 크게 보기 중인 사진 번호

  const close = useCallback(() => {
    setOpen(false);
    setActive(null);
  }, []);
  const step = useCallback(
    (d: number) => setActive((cur) => (cur === null ? cur : (cur + d + images.length) % images.length)),
    [images.length]
  );

  useEffect(() => {
    const dlg = listRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) {
      dlg.close();
      triggerRef.current?.focus(); // 닫으면 누른 버튼으로 포커스 복귀
    }
  }, [open]);

  if (images.length < 2) return null;
  const current = active !== null ? images[active] : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={`${full ? "flex w-full justify-center" : "inline-flex"} items-center gap-3 min-h-[48px] px-5 border text-[13px] md:text-sm font-semibold tracking-wide transition-colors ${tone === "light" ? "border-white/70 text-white hover:bg-white hover:text-[#1d1e20]" : "border-[#888686] text-[#888686] hover:border-[#1d1e20] hover:text-[#1d1e20] hover:bg-white"}  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5541B]`}
      >
        사진 속 하루 더 보기 · {images.length}
      </button>

      <dialog
        ref={listRef}
        onClose={close}
        onKeyDown={(e) => {
          if (active === null) return;
          if (e.key === "ArrowLeft") step(-1);
          if (e.key === "ArrowRight") step(1);
        }}
        aria-label={`CH ${String(no).padStart(2, "0")} ${title} 사진 모음`}
        className="m-0 w-screen h-[100svh] max-w-none max-h-none bg-[#1d1e20] text-white p-0 backdrop:bg-black/85"
      >
        {open && (
          <div className="h-full overflow-y-auto px-4 pb-10 md:px-10">
            <div className="sticky top-0 z-10 -mx-4 md:-mx-10 px-4 md:px-10 py-3 flex items-center justify-between gap-3 bg-[#1d1e20]">
              <p className="min-w-0 truncate text-[14px] md:text-base font-bold">
                <span className="text-[#E5541B]">CH {String(no).padStart(2, "0")}</span> {title}
                <span className="ml-2 text-[12px] font-normal text-white/55">{images.length}컷</span>
              </p>
              <button type="button" onClick={close} aria-label="닫기" className="min-h-[44px] min-w-[44px] text-xl">
                ✕
              </button>
            </div>

            <ul className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-2">
              {images.map((img, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={`${img.alt || title} ${i + 1}번 사진 크게 보기`}
                    className="relative block w-full aspect-[4/5] bg-[#55575b] overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E5541B]"
                  >
                    <img
                      src={img.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="magazine-img absolute inset-0 w-full h-full object-cover transition-opacity hover:opacity-85"
                      style={{ "--pos": img.position ?? "50% 50%" } as CSSProperties}
                    />
                  </button>
                </li>
              ))}
            </ul>

            {/* 크게 보기 — 목록 위에 덮는다 */}
            {current && (
              <div
                className="fixed inset-0 z-20 bg-black/95 flex flex-col"
                onClick={(e) => e.target === e.currentTarget && setActive(null)}
              >
                <div className="flex-1 min-h-0 flex items-center justify-center p-3" onClick={(e) => e.target === e.currentTarget && setActive(null)}>
                  <img src={current.url} alt={current.alt} className="max-w-full max-h-full object-contain" />
                </div>
                <div className="flex items-center justify-between px-2 pb-3 text-[13px]">
                  <button type="button" onClick={() => step(-1)} className="min-h-[44px] min-w-[44px] px-3" aria-label="이전 사진">
                    ←
                  </button>
                  <span aria-live="polite">
                    {(active ?? 0) + 1} / {images.length}
                  </span>
                  <button type="button" onClick={() => step(1)} className="min-h-[44px] min-w-[44px] px-3" aria-label="다음 사진">
                    →
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setActive(null)}
                  aria-label="목록으로"
                  className="absolute top-2 right-2 min-h-[44px] min-w-[44px] bg-black/50 text-xl"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
