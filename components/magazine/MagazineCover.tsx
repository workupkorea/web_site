import Link from "next/link";
import type { HomeMagazineConfig } from "@/lib/home-magazine";
import MagazineImg from "./MagazineImg";

// 매거진 커버 — 첫 화면에서 "이 배우가 워크업 모델"임을 바로 인지시키는 구간.
// 커버 이미지는 LCP 대상이라 priority 로드. 문구는 모두 HTML 레이어.
// 높이: 모바일은 상단 헤더 + 하단 탭바(BottomNav)를 뺀 값 → CTA가 탭바에 가리지 않게. PC는 헤더만 뺀 값.
export default function MagazineCover({
  issue,
  cover,
}: Pick<HomeMagazineConfig, "issue" | "cover">) {
  return (
    <section
      aria-label={`${cover.eyebrow} ${cover.actorName}`.trim()}
      className="mag-sans relative h-[calc(100svh-150px)] md:h-[calc(100svh-64px)] min-h-[520px] max-h-[860px] overflow-hidden bg-[#8b8880] text-white"
    >
      <MagazineImg image={cover.image} priority className="absolute inset-0 w-full h-full" />
      {/* 가독성용 상·하단 그라디언트 (이미지 위 별도 레이어) */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/45 to-transparent" />

      <p className="absolute left-5 top-6 md:left-14 md:top-10 text-[10px] md:text-[13px] tracking-[0.3em]">
        {issue.label}
        {issue.season && <span className="hidden md:inline"> &nbsp;·&nbsp; {issue.season}</span>}
      </p>

      {cover.coverLines.length > 0 && (
        <ul className="hidden md:block absolute right-14 top-10 text-right text-[13px] tracking-[0.15em] leading-8">
          {cover.coverLines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}

      <div className="absolute inset-x-5 bottom-8 md:inset-x-14 md:bottom-14 md:flex md:items-end md:justify-between md:gap-10">
        <div>
          {cover.eyebrow && <p className="italic text-base md:text-[22px] mb-1 md:mb-2">{cover.eyebrow}</p>}
          <h1 className="text-[52px] md:text-[120px] font-black leading-none tracking-tight break-keep">
            {cover.actorName}
          </h1>
          {cover.quote && (
            <p className="mt-3 md:mt-5 text-[15px] md:text-2xl opacity-90 break-keep">“{cover.quote}”</p>
          )}
        </div>
        <div className="mt-5 md:mt-0 flex flex-wrap gap-2 md:gap-3 shrink-0">
          <Link
            href="/store"
            className="inline-flex items-center min-h-[44px] bg-[#E5541B] px-5 md:px-7 text-[13px] md:text-sm tracking-wider hover:bg-[#d04a15] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            매장에서 입어보기
          </Link>
          <a
            href="#magazine-content"
            className="inline-flex items-center min-h-[44px] border border-white px-5 md:px-7 text-[13px] md:text-sm tracking-wider hover:bg-white hover:text-[#1d1e20] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            캠페인 보기 ↓
          </a>
        </div>
      </div>
    </section>
  );
}
