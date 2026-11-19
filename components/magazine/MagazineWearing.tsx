"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { HomeMagazineConfig } from "@/lib/home-magazine";
import MagazineImg from "./MagazineImg";
import { useChapter } from "./ChapterContext";

// 배우가 입은 제품 — 착용컷 크롭 + 제품명. 가격·구매 버튼 없음(제품 상세·매장 찾기로 연결).
//  · 챕터 연동: 상단 챕터를 전환하면 그 챕터에 연결된 제품(+ 공통 제품)으로 바뀐다. "전체 제품 보기"로 모두 볼 수도 있다.
//  · PC는 4열, 모바일은 2열 그리드로 전부 펼쳐 보여준다.
// 사이즈 표기 통일: "00M~4XL"→"M - 4XL", "30N~36N"→"30 - 36" (이미 등록된 값도 화면에서 보정)
const normSz = (z: string) => z.replace(/^0{1,2}(?=[A-Za-z])/, "").replace(/^(\d+)N$/, "$1");
function fmtSize(raw: string) {
  const parts = raw.trim().split(/\s*[~\-–]\s*/).map((x) => normSz(x.trim())).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} - ${parts[parts.length - 1]}` : raw;
}
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

  return (
    <section aria-labelledby="mag-wearing" className="px-5 py-8 md:px-14 md:py-16">
      <div className="flex items-end justify-between gap-4 mb-4 md:mb-7">
        <div className="min-w-0">
          <h2 id="mag-wearing" className="scroll-mt-24 text-[22px] md:text-[34px] font-bold">
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
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5"
      >
        {items.map((item) => {
          const body = (
            // 제품 사진 + 제품명을 하나의 실선 박스로 묶고, 글자는 가운데 정렬
            <div className="border border-gray-200 bg-white h-full">
              {/* 제품 상세(기획전) 이미지와 같은 1:1 비율 */}
              <div className="relative aspect-square bg-gray-100 overflow-hidden">
                <MagazineImg image={{ ...item.image, mobileUrl: undefined, mobilePosition: undefined, more: undefined, mobileMore: undefined, random: undefined }} className="absolute inset-0 w-full h-full transition-transform duration-500 group-hover:scale-[1.03]" />
                {/* "전체 제품 보기" 상태 — 이 제품이 어느 챕터에서 입은 제품인지 표기 */}
                {showAll && byChapter && (() => {
                  const ch = isLinked(item) ? chapters.find((c) => c.id === item.chapterId) : null;
                  return (
                    <span className="absolute left-3 top-2.5 text-[12px] md:text-[13px] font-bold tracking-wider text-[#E5541B]">
                      {ch ? `CH ${pad(ch.no)}` : "공통"}
                    </span>
                  );
                })()}
              </div>
              <div className="px-3 pt-4 pb-4 md:px-4 text-center">
                <p className="text-sm md:text-[15px] font-semibold text-[#303236] leading-snug break-keep">{item.name}</p>
                {/* 품번·컬러·사이즈 — 메인 에디토리얼 제품 정보와 같은 항목 */}
                {(item.styleNo || item.colors || item.sizes) && (
                  <dl className="mt-1.5 space-y-0.5 text-[12px] text-gray-500 break-keep">
                    {item.styleNo && <div><dt className="inline">품번 : </dt><dd className="inline">{item.styleNo}</dd></div>}
                    {item.colors && <div><dt className="inline">컬러 : </dt><dd className="inline">{item.colors}</dd></div>}
                    {item.sizes && <div><dt className="inline">사이즈 : </dt><dd className="inline">{fmtSize(item.sizes)}</dd></div>}
                  </dl>
                )}
              </div>
            </div>
          );
          return (
            <li key={item.id}>
              {item.href ? (
                <Link href={item.href} target="_blank" rel="noopener noreferrer" className="group block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E5541B]">
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
