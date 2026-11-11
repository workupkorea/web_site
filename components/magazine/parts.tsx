import Link from "next/link";
import type { ReactNode } from "react";
import type { MagazineCredit } from "@/lib/home-magazine";

// 매거진 공용 소품 — 섹션 라벨(키커), 텍스트 링크, 착용 크레딧.

export const MAGAZINE_ORANGE = "#E5541B";

export function Kicker({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "ink" | "light" }) {
  const color = tone === "accent" ? "text-[#E5541B]" : tone === "light" ? "text-white/85" : "text-[#1d1e20]";
  return <p className={`mag-label text-[10px] md:text-xs tracking-[0.3em] uppercase ${color}`}>{children}</p>;
}

// 챕터 번호 (01, 02 …)
export function ChapterNo({ n, className = "" }: { n: number; className?: string }) {
  return (
    <p aria-hidden className={`leading-[0.85] tracking-tight ${className}`}>
      {String(n).padStart(2, "0")}
    </p>
  );
}

// 밑줄 텍스트 링크 — 내부 경로는 next/link, 외부는 새 창. 터치 영역 44px 확보.
export function TextLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  const cls = `inline-flex items-center min-h-[44px] text-[13px] ${className}`;
  const inner = <span className="border-b border-current pb-0.5">{children}</span>;
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

// 착용 제품 태그 — "착용  [# 제품A →] [# 제품B →]" 형태의 글자 태그(칩).
// 링크가 있는 태그는 제품 상세로 이동, 없으면 표시만. 터치 영역 44px 확보(칩 자체는 작게).
export function Credits({ credits, tone = "dark" }: { credits: MagazineCredit[]; tone?: "dark" | "light" }) {
  if (credits.length === 0) return null;
  const label = tone === "dark" ? "text-[#55575b]" : "text-white/75";
  const chip =
    tone === "dark"
      ? "border-[#1d1e20]/25 text-[#1d1e20] group-hover:bg-[#1d1e20] group-hover:text-white"
      : "border-white/50 text-white group-hover:bg-white group-hover:text-[#1d1e20]";
  const plain = tone === "dark" ? "border-[#1d1e20]/15 text-[#55575b]" : "border-white/30 text-white/80";
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 text-xs md:text-[13px]">
      <span className={`mr-2 text-[10px] tracking-[0.25em] uppercase ${label}`}>Wearing</span>
      {credits.map((c, i) =>
        c.href ? (
          <TagLink key={i} href={c.href} className={`group inline-flex items-center min-h-[44px]`}>
            <span className={`rounded-full border px-3 py-1 font-semibold transition-colors ${chip}`}>#{c.name} →</span>
          </TagLink>
        ) : (
          <span key={i} className={`rounded-full border px-3 py-1 ${plain}`}>#{c.name}</span>
        )
      )}
    </div>
  );
}

// 내부 경로는 next/link, 외부 주소는 새 창
function TagLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
