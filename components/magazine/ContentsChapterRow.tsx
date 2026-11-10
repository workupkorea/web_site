"use client";
import { useEffect, useState } from "react";

// 목차의 "챕터" 항목 — 챕터가 여러 개면 제목이 위로 한 줄씩 순차적으로 롤링된다(자동 전환).
//  · 롤링 중인 챕터를 누르면 그 챕터로 이동(탭 모드면 해당 챕터로 전환).
//  · 마우스를 올리거나 키보드 포커스가 있으면 멈춘다. '동작 줄이기' 설정이면 자동 롤링을 하지 않는다.
//  · 마지막 → 처음은 첫 항목을 맨 끝에 한 번 더 두어 끊김 없이 이어진다.
type Item = { id: string; title: string; note: string };

const LINE = 1.35; // 제목 한 줄 높이(em)
const NOTE_LINE = 1.7;
const SLIDE_MS = 1100;

export default function ContentsChapterRow({ number, items, interval = 7000 }: { number: string; items: Item[]; interval?: number }) {
  const len = items.length;
  const [idx, setIdx] = useState(0); // 0..len (len = 맨 끝에 붙인 첫 항목 복제본)
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [instant, setInstant] = useState(false); // 복제본 → 처음으로 되돌릴 때 애니메이션 없이

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (len < 2 || paused || reduced) return;
    const t = setInterval(() => setIdx((i) => (i >= len ? i : i + 1)), interval);
    return () => clearInterval(t);
  }, [len, paused, reduced, interval]);

  // 복제본까지 넘어가면 슬라이드가 끝난 뒤 애니메이션 없이 0으로 되돌린다
  useEffect(() => {
    if (idx !== len || len < 2) return;
    const t = setTimeout(() => {
      setInstant(true);
      setIdx(0);
      requestAnimationFrame(() => requestAnimationFrame(() => setInstant(false)));
    }, SLIDE_MS + 40);
    return () => clearTimeout(t);
  }, [idx, len]);

  const cur = items[idx % len];
  const rolled = [...items, items[0]]; // 끊김 없는 순환용

  const track = (lineEm: number) => ({
    transform: `translateY(calc(${-idx} * ${lineEm}em))`,
    transition: instant ? "none" : `transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
  });

  return (
    <li className="border-t border-[#1d1e20]/25 last:border-b">
      <a
        href={`#mag-chapter-${cur.id}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className="group flex items-baseline gap-4 md:gap-8 py-4 md:py-6 min-h-[44px] hover:bg-[#f6f4ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E5541B] transition-colors"
      >
        <span className="shrink-0 w-8 md:w-14 text-[13px] md:text-[18px] font-black text-[#E5541B]">{number}</span>
        <span className="min-w-0 flex-1">
          {/* 제목 롤링 */}
          <span className="block overflow-hidden text-[18px] md:text-[28px] font-bold tracking-tight" style={{ height: `${LINE}em`, lineHeight: LINE }}>
            <span className="block will-change-transform" style={track(LINE)}>
              {rolled.map((it, i) => (
                <span key={i} className="block truncate" style={{ height: `${LINE}em` }} aria-hidden={i === len ? true : undefined}>
                  {it.title}
                </span>
              ))}
            </span>
          </span>
          {/* 키커 롤링 */}
          <span className="block overflow-hidden mt-1 text-[11px] md:text-xs tracking-[0.12em] uppercase text-[#55575b]" style={{ height: `${NOTE_LINE}em`, lineHeight: NOTE_LINE }}>
            <span className="block will-change-transform" style={track(NOTE_LINE)}>
              {rolled.map((it, i) => (
                <span key={i} className="block truncate" style={{ height: `${NOTE_LINE}em` }} aria-hidden={i === len ? true : undefined}>
                  {it.note}
                </span>
              ))}
            </span>
          </span>
        </span>
        {len > 1 && (
          <span className="shrink-0 hidden sm:flex items-center gap-1.5 text-[11px] tabular-nums text-[#55575b]" aria-hidden>
            <b className="text-[#1d1e20]">{(idx % len) + 1}</b>/{len}
          </span>
        )}
        <span aria-hidden className="shrink-0 text-lg text-[#1d1e20]/40 transition-transform group-hover:translate-x-1 group-hover:text-[#E5541B]">
          →
        </span>
      </a>
    </li>
  );
}
