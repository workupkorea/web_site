"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { HomeMagazineConfig } from "@/lib/home-magazine";
import MagazineImg from "./MagazineImg";
import { Kicker } from "./parts";
import { useChapter } from "./ChapterContext";

// 배우가 입은 제품 — 착용컷 크롭 + 제품명. 가격·구매 버튼 없음(제품 상세·매장 찾기로 연결).
//  · 챕터 연동: 상단 챕터를 전환하면 그 챕터에 연결된 제품(+ 공통 제품)으로 바뀐다. "전체 제품 보기"로 모두 볼 수도 있다.
//  · PC에서 4개를 넘으면 가로로 스크롤(화살표/스와이프). 모바일은 2열로 이어서 쌓는다.
const PC_VISIBLE = 4;
const pad = (n: number) => String(n).padStart(2, "0");

// 매장 방문 유도 버튼 — PC는 헤더 오른쪽, 모바일은 목록 아래에 한 번씩만 노출한다.
function StoreButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/store"
      className={`group inline-flex items-center gap-3 min-h-[48px] px-6 bg-[#1d1e20] text-white text-[13px] md:text-sm font-semibold tracking-wide hover:bg-[#E5541B] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5541B] ${className}`}
    >
      가까운 매장에서 직접 만나보기
      <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
    </Link>
  );
}

export default function MagazineWearing({
  wearing,
  chapters,
}: {
  wearing: HomeMagazineConfig["wearing"];
  chapters: { id: string; no: number; title: string }[];
}) {
  const ctx = useChapter();
  const active = ctx?.activeId ?? null;
  const [showAll, setShowAll] = useState(false);
  const scroller = useRef<HTMLUListElement>(null);

  // 챕터가 바뀌면 다시 챕터별 보기로, 목록도 맨 앞으로
  useEffect(() => {
    setShowAll(false);
    scroller.current?.scrollTo({ left: 0 });
  }, [active]);

  if (!wearing.enabled || wearing.items.length === 0) return null;

  const known = new Set(chapters.map((c) => c.id));
  const isLinked = (i: HomeMagazineConfig["wearing"]["items"][number]) => !!i.chapterId && known.has(i.chapterId);
  const hasLinks = wearing.items.some(isLinked);
  const forActive = active ? wearing.items.filter((i) => !isLinked(i) || i.chapterId === active) : wearing.items;
  // 챕터에 연결된 제품이 하나라도 있으면 항상 챕터별로 보여준다 — 이 챕터에 연결된 제품이 없으면
  // 다른 챕터의 제품을 대신 보여주지 않고 안내 문구를 보여준다("전체 제품 보기"로 모두 볼 수 있음)
  const byChapter = !!active && hasLinks;
  const filtered = byChapter && !showAll ? forActive : wearing.items;
  const items = filtered;
  const activeChapter = chapters.find((c) => c.id === active);
  const scrollable = items.length > PC_VISIBLE;

  const slide = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section aria-labelledby="mag-wearing" className="px-5 py-10 md:px-14 md:py-16">
      <div className="flex items-end justify-between gap-4 mb-4 md:mb-7">
        <div className="min-w-0">
          <Kicker>Wearing</Kicker>
          <h2 id="mag-wearing" className="scroll-mt-24 mt-2 text-[22px] md:text-[34px] font-bold">
            {wearing.title}
          </h2>
          {byChapter && activeChapter && (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 text-[12px] md:text-[13px] text-[#55575b]">
              <span>
                <b className="text-[#E5541B]">No. {pad(activeChapter.no)}</b> {activeChapter.title}
              </span>
              <button type="button" onClick={() => setShowAll((v) => !v)} className="min-h-[44px] underline underline-offset-2 hover:text-[#1d1e20]">
                {showAll ? "챕터별로 보기" : "전체 제품 보기"}
              </button>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {scrollable && (
            <span className="hidden md:flex gap-2">
              <button type="button" onClick={() => slide(-1)} aria-label="이전 제품" className="min-h-[44px] min-w-[44px] border border-[#1d1e20]/30 hover:bg-[#1d1e20] hover:text-white transition-colors">
                ←
              </button>
              <button type="button" onClick={() => slide(1)} aria-label="다음 제품" className="min-h-[44px] min-w-[44px] border border-[#1d1e20]/30 hover:bg-[#1d1e20] hover:text-white transition-colors">
                →
              </button>
            </span>
          )}
          <div className="hidden md:block">
            <StoreButton />
          </div>
        </div>
      </div>

      {items.length === 0 && (
        <p className="py-10 text-center text-[13px] md:text-sm text-[#55575b] border border-dashed border-[#1d1e20]/20">
          이 챕터에서 입은 제품은 준비 중이에요.
        </p>
      )}
      <ul
        ref={scroller}
        key={`${active}-${showAll}`}
        className="grid grid-cols-2 gap-3 md:flex md:gap-5 md:overflow-x-auto md:snap-x md:snap-mandatory md:pb-3 [scrollbar-width:thin]"
      >
        {items.map((item) => {
          const body = (
            // 제품 사진 + 제품명을 하나의 실선 박스로 묶고, 글자는 가운데 정렬
            <div className="border border-[#1d1e20]/30 bg-white">
              <div className="relative aspect-[3/4] bg-[#c6bfb2] overflow-hidden">
                <MagazineImg image={item.image} className="absolute inset-0 w-full h-full transition-transform duration-500 group-hover:scale-[1.03]" />
              </div>
              <div className="px-3 pb-4 pt-1 text-center">
                <p className="text-[13px] md:text-sm font-bold">{item.name}</p>
                {item.caption && <p className="mt-0.5 text-xs text-[#55575b]">{item.caption}</p>}
              </div>
            </div>
          );
          return (
            <li key={item.id} className="md:shrink-0 md:snap-start md:w-[calc((100%-60px)/4)]">
              {item.href ? (
                <Link href={item.href} className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E5541B]">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
      <div className="md:hidden mt-5">
        <StoreButton className="w-full justify-center" />
      </div>
    </section>
  );
}
