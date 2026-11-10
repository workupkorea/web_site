"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useChapter } from "./ChapterContext";

// 챕터 영역 — tabs 모드면 상단 챕터 탭으로 한 챕터씩 전환하고, 아니면 모든 챕터를 펼쳐 보여준다.
// 비활성 챕터도 DOM 에는 남겨(hidden) 목차 링크·SEO 에 쓰이고, 숨겨진 이미지는 지연 로드라 내려받지 않는다.
//
// 자동 롤링: 아주 천천히(챕터당 AUTO_MS) 다음 챕터로 넘어가고, 활성 탭 밑줄이 서서히 차오르며 진행 상황을 보여준다.
//  · 전환 시점은 밑줄 애니메이션이 끝날 때(onAnimationEnd) — 일시정지는 애니메이션을 멈추기만 하면 되어 타이머와 어긋나지 않는다.
//  · 탭 줄이 화면에 보일 때만 진행하고, 마우스를 올리거나 키보드 포커스가 있거나 탭(브라우저 창)이 가려지면 멈춘다.
//  · 사용자가 직접 챕터를 고르면(탭/목차 클릭) 자동 롤링을 멈춘다. '동작 줄이기' 설정이면 자동 롤링을 하지 않는다.
export type ChapterTabItem = { id: string; no: number; title: string; node: ReactNode };

const AUTO_MS = 9000; // 챕터 하나를 보여주는 시간(아주 천천히)
const pad = (n: number) => String(n).padStart(2, "0");

export default function MagazineChapterTabs({ chapters }: { chapters: ChapterTabItem[] }) {
  const ctx = useChapter();
  const barRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reduced, setReduced] = useState(false);

  const tabs = !!ctx?.tabs && chapters.length > 1;
  const active = ctx?.activeId ?? chapters[0]?.id;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    const vis = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", vis);
    return () => {
      mq.removeEventListener("change", on);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  // 탭 줄이 화면에 보일 때만 롤링
  useEffect(() => {
    const el = barRef.current;
    if (!el || !tabs) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [tabs]);

  if (chapters.length === 0) return null;

  const auto = tabs && !reduced && !ctx?.autoStopped; // 자동 롤링 사용 여부
  const running = auto && inView && pageVisible && !hover; // 지금 진행 중인지
  const advance = () => {
    const idx = chapters.findIndex((c) => c.id === active);
    ctx?.autoAdvance(chapters[(idx + 1) % chapters.length].id);
  };

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocusCapture={() => setHover(true)} onBlurCapture={() => setHover(false)}>
      {tabs && (
        <div ref={barRef} className="mag-own-bg px-5 pt-10 md:px-14 md:pt-16 bg-[#f6f4ef] text-[#1d1e20]">
          <p className="text-[10px] md:text-[11px] font-bold tracking-[0.28em] uppercase">Chapters</p>
          {/* 탭 줄 — 가는 선 하나 위에 활성 탭의 오렌지 밑줄이 (롤링 중에는 서서히 차오르며) 겹친다 */}
          <div role="tablist" aria-label="챕터 전환" className="mt-3 flex gap-8 md:gap-12 overflow-x-auto border-b border-[#1d1e20]/20 [scrollbar-width:none]">
            {chapters.map((c) => {
              const on = c.id === active;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  id={`mag-tab-${c.id}`}
                  aria-selected={on}
                  aria-controls={`mag-panel-${c.id}`}
                  onClick={() => ctx?.setActiveId(c.id)}
                  className={`relative shrink-0 -mb-px flex items-baseline gap-2.5 border-b-2 py-3 md:py-4 outline-none transition-colors duration-700 focus-visible:ring-2 focus-visible:ring-[#E5541B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f6f4ef] ${
                    on ? (auto ? "border-[#1d1e20]/25 text-[#1d1e20]" : "border-[#E5541B] text-[#1d1e20]") : "border-transparent text-[#1d1e20]/45 hover:text-[#1d1e20]"
                  }`}
                >
                  <span className={`text-[13px] md:text-[16px] font-black transition-colors duration-700 ${on ? "text-[#E5541B]" : ""}`}>{pad(c.no)}</span>
                  <span className="text-[15px] md:text-[20px] font-bold tracking-tight whitespace-nowrap">{c.title || "Chapter"}</span>
                  {on && auto && (
                    <span
                      key={active}
                      aria-hidden
                      className="absolute left-0 right-0 -bottom-[2px] h-[2px] bg-[#E5541B] origin-left"
                      style={{ animation: `mag-progress ${AUTO_MS}ms linear forwards`, animationPlayState: running ? "running" : "paused" }}
                      onAnimationEnd={advance}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {chapters.map((c) => (
        <div
          key={c.id}
          id={`mag-panel-${c.id}`}
          role={tabs ? "tabpanel" : undefined}
          aria-labelledby={tabs ? `mag-tab-${c.id}` : undefined}
          hidden={tabs && c.id !== active}
          className="mag-fade-in"
        >
          {c.node}
        </div>
      ))}
    </div>
  );
}
