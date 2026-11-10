"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { MagazineImage } from "@/lib/home-magazine";
import { Kicker } from "./parts";

// 비하인드 — B컷을 컨택트 시트처럼 모아 보여준다. 누르면 크게 보기(<dialog>: Esc 닫기·포커스 가둠 기본 제공).
// 처음엔 일부만 노출(모바일 6 / PC 12)하고 "더 보기"로 펼친다 — 초기 로드 이미지 수 절감.
const INITIAL_MOBILE = 6;
const INITIAL_PC = 12;

export default function MagazineBehind({ title, images: source, shuffle = false }: { title: string; images: MagazineImage[]; shuffle?: boolean }) {
  // shuffle: 서버 렌더는 등록 순서 → 하이드레이션 후 무작위로 섞는다(캐시된 페이지에서도 방문마다 달라짐)
  const [images, setImages] = useState(source);
  useEffect(() => {
    if (!shuffle) return setImages(source);
    const a = [...source];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    setImages(a);
  }, [source, shuffle]);
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const open = (i: number, el: HTMLButtonElement) => {
    triggerRef.current = el;
    setActive(i);
  };
  const close = useCallback(() => setActive(null), []);
  const step = useCallback(
    (d: number) => setActive((cur) => (cur === null ? cur : (cur + d + images.length) % images.length)),
    [images.length]
  );

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (active !== null && !dlg.open) dlg.showModal();
    if (active === null && dlg.open) {
      dlg.close();
      triggerRef.current?.focus(); // 닫으면 누른 썸네일로 포커스 복귀
    }
  }, [active]);

  if (images.length === 0) return null;
  const hiddenOnMobile = images.length - INITIAL_MOBILE;
  const hiddenOnPc = images.length - INITIAL_PC;
  const current = active !== null ? images[active] : null;

  return (
    <section aria-labelledby="mag-behind" className="bg-[#1d1e20] text-white px-5 py-10 md:px-14 md:py-16">
      <div className="md:flex md:items-end md:justify-between mb-5 md:mb-7">
        <div>
          <Kicker>Behind the scenes</Kicker>
          <h2 id="mag-behind" className="scroll-mt-24 mt-2 text-[22px] md:text-4xl font-bold">
            {title}
          </h2>
        </div>
        <p className="hidden md:block text-[13px] text-white/55">{images.length}컷</p>
      </div>

      <ul className="grid grid-cols-3 md:grid-cols-6 gap-1.5 md:gap-2">
        {images.map((img, i) => {
          // 접힌 상태: 모바일은 6장 이후, PC는 12장 이후 숨김
          const hide = expanded
            ? ""
            : `${i >= INITIAL_MOBILE ? "hidden" : ""} ${i < INITIAL_PC ? "md:block" : "md:hidden"}`;
          return (
            <li key={i} className={hide}>
              <button
                type="button"
                onClick={(e) => open(i, e.currentTarget)}
                aria-label={`${img.alt || "촬영 현장 사진"} 크게 보기`}
                className="relative block w-full aspect-[4/5] md:aspect-square bg-[#55575b] overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E5541B]"
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
          );
        })}
      </ul>

      {!expanded && (hiddenOnMobile > 0 || hiddenOnPc > 0) && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={`mt-3 min-h-[44px] text-[13px] text-white/70 hover:text-white ${hiddenOnPc > 0 ? "" : "md:hidden"}`}
        >
          <span className="md:hidden">+{Math.max(hiddenOnMobile, 0)}장 더 보기 →</span>
          <span className="hidden md:inline">+{Math.max(hiddenOnPc, 0)}장 더 보기 →</span>
        </button>
      )}

      <dialog
        ref={dialogRef}
        onClose={close}
        onClick={(e) => e.target === e.currentTarget && close()}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") step(-1);
          if (e.key === "ArrowRight") step(1);
        }}
        aria-label="촬영 현장 사진 크게 보기"
        className="m-auto max-w-[min(92vw,1100px)] max-h-[92svh] bg-transparent p-0 backdrop:bg-black/85"
      >
        {current && (
          <div className="relative">
            <img src={current.url} alt={current.alt} className="block max-w-full max-h-[86svh] object-contain mx-auto" />
            <div className="flex items-center justify-between mt-2 text-white text-[13px]">
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
              onClick={close}
              aria-label="닫기"
              className="absolute top-2 right-2 min-h-[44px] min-w-[44px] bg-black/50 text-white text-xl"
            >
              ✕
            </button>
          </div>
        )}
      </dialog>
    </section>
  );
}
