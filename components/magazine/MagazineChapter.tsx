import type { ReactNode } from "react";
import type { MagazineChapter as Chapter, MagazineImage } from "@/lib/home-magazine";
import MagazineImg from "./MagazineImg";
import { ChapterNo, Credits, TextLink } from "./parts";

// 챕터 — 잡지 "스프레드" 구조. 레이아웃 3종(split / fullbleed / mosaic), 번호는 노출 순서로 자동 부여.
//  · 러닝헤드: 페이지 상단 가는 선 + No./키커/이슈
//  · 오프너: 큰 도판 + 비대칭 12단 그리드, 챕터 번호가 도판 모서리를 살짝 넘어 겹침
//  · 리드 문단(본문 첫 문단, 크게) / 본문 / 풀 쿼트(큰 인용문)
//  · 도판 캡션("01 — 설명")과 크레딧 박스
const pad = (n: number) => String(n).padStart(2, "0");

export default function MagazineChapter({ chapter, no, tight = false }: { chapter: Chapter; no: number; tight?: boolean }) {
  const paras = (chapter.body ?? "").split(/\n+/).map((t) => t.trim()).filter(Boolean);
  const props = { chapter, no, tight, headingId: `mag-chapter-${chapter.id}`, lead: paras[0], rest: paras.slice(1) };
  if (chapter.layout === "fullbleed") return <Fullbleed {...props} />;
  if (chapter.layout === "mosaic") return <Mosaic {...props} />;
  return <Split {...props} />;
}

type Props = { chapter: Chapter; no: number; headingId: string; lead?: string; rest: string[]; tight?: boolean };

// 챕터 탭 바로 아래에 붙을 때(tight)는 위쪽 여백을 줄인다
const sectionPad = (tight?: boolean) => (tight ? "px-5 pt-8 pb-10 md:px-14 md:pt-10 md:pb-24" : "px-5 py-10 md:px-14 md:py-24");

// ── 공용 조각 ──

// 러닝헤드 — "No. 01  키커 ··· ISSUE 01"
function RunningHead({ no, kicker, tone = "dark" }: { no: number; kicker: string; tone?: "dark" | "light" }) {
  const line = tone === "dark" ? "border-[#1d1e20]" : "border-white/70";
  const dim = tone === "dark" ? "text-[#1d1e20]/45" : "text-white/70";
  return (
    <div className={`flex items-baseline justify-between gap-4 border-t pt-3 text-[10px] md:text-[11px] tracking-[0.28em] uppercase ${line}`}>
      <span className="truncate">
        <b className="font-bold">No. {pad(no)}</b>
        {kicker && <span className={`ml-3 ${dim}`}>{kicker}</span>}
      </span>
    </div>
  );
}

// 도판 캡션 — "01 — 사진 설명"
function Caption({ n, text }: { n: number; text?: string }) {
  return (
    <figcaption className="mt-2.5 flex items-baseline gap-2 text-[11px] leading-snug text-[#55575b]">
      <b className="shrink-0 text-[#1d1e20] tracking-[0.12em]">{pad(n)}</b>
      {text && (
        <>
          <span aria-hidden>—</span>
          <span className="truncate">{text}</span>
        </>
      )}
    </figcaption>
  );
}

// 풀 쿼트 — 큰 따옴표 + 큰 인용문
function PullQuote({ children, tone = "dark", className = "" }: { children: ReactNode; tone?: "dark" | "light"; className?: string }) {
  return (
    <blockquote className={`relative ${className}`}>
      {/* 따옴표는 글 위에 걸쳐 두어(absolute) 인용문 첫 줄이 블록 맨 위에 오게 한다 — 옆 단 본문과 상단이 맞는다 */}
      <span aria-hidden className="mag-serif absolute left-0 bottom-full mb-2 text-[56px] md:text-[80px] leading-[0.6] font-bold text-[#E5541B]">“</span>
      <p className={`mag-serif text-[20px] md:text-[28px] font-semibold leading-[1.3] tracking-tight break-keep ${tone === "light" ? "text-white" : "text-[#1d1e20]"}`}>{children}</p>
    </blockquote>
  );
}

// 리드 문단(크게) + 본문 — 고딕(사이트 기본 글꼴), 줄간격은 좁게. (명조는 풀 쿼트에만 쓴다)
function Copy({ lead, rest, tone = "dark" }: { lead?: string; rest: string[]; tone?: "dark" | "light" }) {
  const lc = tone === "light" ? "text-white" : "text-[#1d1e20]";
  const bc = tone === "light" ? "text-white/80" : "text-[#45474b]";
  return (
    <div className="mag-body">
      {lead && <p className={`text-[16px] md:text-[19px] font-medium leading-[1.5] break-keep ${lc}`}>{lead}</p>}
      {rest.length > 0 && (
        <div className={`${lead ? "mt-3" : ""} space-y-2 text-[14px] md:text-[17px] leading-[1.4] break-keep ${bc}`}>
          {rest.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// 크레딧 박스 — 가는 선 + CREDITS
function CreditBox({ chapter, tone = "dark" }: { chapter: Chapter; tone?: "dark" | "light" }) {
  const productHref = chapter.credits.find((c) => c.href)?.href;
  if (chapter.credits.length === 0 && !productHref) return null;
  return (
    <div className={`border-t pt-3 ${tone === "light" ? "border-white/40 text-white" : "border-[#1d1e20]"}`}>
      <p className={`mb-1 text-[10px] tracking-[0.28em] uppercase ${tone === "light" ? "text-white/70" : "text-[#1d1e20]/45"}`}>Credits</p>
      <Credits credits={chapter.credits} tone={tone} />
      {productHref && <TextLink href={productHref}>제품 자세히 보기 →</TextLink>}
    </div>
  );
}

const Rule = () => <span aria-hidden className="block w-10 h-[2px] bg-[#E5541B]" />;

// ── SPLIT: 오프너 스프레드 ──
// 위: 큰 도판(8단) + 오른쪽 4단(번호·제목·리드 → 디테일 도판 세로 2장 → 크레딧). 오른쪽이 길면 큰 도판이 같이 늘어나 높이가 맞는다.
// 아래: 풀 쿼트/본문이 있을 때만 이미지 없는 글 띠(풀 쿼트 · 본문)를 둔다. — 세로형 사진 위주라 가로 와이드 컷은 쓰지 않는다.
// 오른쪽에 채울 내용이 거의 없으면(리드·디테일·크레딧 없음) 번호+제목을 도판 옆 세로 가운데에 놓는다.
function Split({ chapter, no, headingId, lead, rest, tight }: Props) {
  const details = chapter.subs.slice(0, 2);
  const hasText = !!(chapter.quote || rest.length > 0);
  const hasCredits = chapter.credits.length > 0;
  const sparse = !lead && details.length === 0 && !hasCredits; // 오른쪽 단이 비어 보일 수 있는 경우
  return (
    <section aria-labelledby={headingId} className={sectionPad(tight)}>
      {!tight && <RunningHead no={no} kicker={chapter.kicker} />}

      <div className={`${tight ? "" : "mt-5 md:mt-10"} md:grid md:grid-cols-12 md:gap-x-8`}>
        <figure className="md:col-span-8 flex flex-col">
          <div className="relative -mx-5 md:mx-0 h-[460px] md:h-auto md:flex-1 md:min-h-[760px] bg-[#a7a397] overflow-hidden">
            <MagazineImg image={chapter.main} className="absolute inset-0 w-full h-full" />
            <ChapterNo n={no} className="md:hidden absolute left-4 bottom-1 text-[96px] font-black text-[#ff8a5c]" />
          </div>
          <Caption n={1} />
        </figure>

        <div className={`md:col-span-4 mt-8 md:mt-0 flex flex-col ${sparse ? "md:justify-center" : ""}`}>
          {/* 번호가 도판 모서리를 살짝 넘어 겹친다 */}
          <ChapterNo n={no} className="hidden md:block relative z-10 md:-ml-14 text-[190px] font-black text-[#E5541B]" />
          <h2 id={headingId} className="scroll-mt-24 md:mt-8 text-[28px] md:text-[42px] font-black tracking-tight leading-[1.2] break-keep">
            {chapter.title}
          </h2>
          <div className="my-4 md:my-6">
            <Rule />
          </div>
          {lead && <Copy lead={lead} rest={[]} />}

          {/* 디테일 도판 — 세로형 2장을 나란히(둘째는 아래로 어긋나게). 1장이면 한 줄 전체 */}
          {details.length > 0 && (
            <div className={`mt-8 md:mt-10 grid gap-3 md:gap-4 items-start ${details.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {details.map((img, i) => (
                <figure key={i} className={i === 1 ? "mt-6 md:mt-10" : ""}>
                  <div className="relative aspect-[4/5] bg-[#cfc8bc] overflow-hidden">
                    <MagazineImg image={img} className="absolute inset-0 w-full h-full" />
                  </div>
                  <Caption n={i + 2} />
                </figure>
              ))}
            </div>
          )}

          {hasCredits && (
            <div className="mt-8 md:mt-auto md:pt-8">
              <CreditBox chapter={chapter} />
            </div>
          )}
        </div>
      </div>

      {hasText && (
        <div className="mt-10 md:mt-20 md:grid md:grid-cols-12 md:gap-x-8 items-start border-t border-[#1d1e20]/15 pt-16 md:pt-24">
          {chapter.quote && rest.length > 0 ? (
            <>
              <div className="md:col-start-2 md:col-span-5">
                <PullQuote>{chapter.quote}</PullQuote>
              </div>
              <div className="md:col-start-8 md:col-span-5 mt-6 md:mt-0">
                <Copy rest={rest} />
              </div>
            </>
          ) : (
            <div className="md:col-start-3 md:col-span-8">
              {chapter.quote ? <PullQuote>{chapter.quote}</PullQuote> : <Copy rest={rest} />}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── FULLBLEED: 전면 도판 스프레드 ── 화면 가득 사진 위에 러닝헤드, 하단은 제목·리드·크레딧 3단 캡션 띠
function Fullbleed({ chapter, no, headingId, lead, rest, tight }: Props) {
  return (
    <section aria-labelledby={headingId} className={`relative ${tight ? "mt-6 md:mt-8" : ""} h-[680px] md:h-[860px] overflow-hidden bg-[#6f6d68] text-white`}>
      <MagazineImg image={chapter.main} className="absolute inset-0 w-full h-full" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/20" />

      {!tight && (
        <div className="absolute inset-x-5 top-5 md:inset-x-14 md:top-8">
          <RunningHead no={no} kicker={chapter.kicker} tone="light" />
        </div>
      )}

      {chapter.quote && (
        <PullQuote tone="light" className="hidden md:block absolute right-14 top-1/2 -translate-y-1/2 w-[380px]">
          {chapter.quote}
        </PullQuote>
      )}

      <div className="absolute inset-x-5 bottom-6 md:inset-x-14 md:bottom-10 md:grid md:grid-cols-12 md:gap-x-8 items-end">
        <div className="md:col-span-5">
          <ChapterNo n={no} className="text-[84px] md:text-[150px] font-black text-[#ff8a5c]" />
          <h2 id={headingId} className="scroll-mt-24 mt-3 md:mt-5 text-[26px] md:text-[40px] font-black tracking-tight leading-[1.2] break-keep">
            {chapter.title}
          </h2>
        </div>
        <div className="md:col-span-4 mt-4 md:mt-0">
          <Copy lead={lead} rest={rest.slice(0, 1)} tone="light" />
        </div>
        <div className="md:col-span-3 mt-5 md:mt-0">
          <CreditBox chapter={chapter} tone="light" />
        </div>
      </div>
    </section>
  );
}

// ── MOSAIC: 포토 에세이 ── 위: 번호+제목 / 리드, 가운데: 컨택트 시트형 그리드, 아래: 풀 쿼트·본문 / 크레딧
function Mosaic({ chapter, no, headingId, lead, rest, tight }: Props) {
  const [s0, s1, s2] = chapter.subs;
  // 보조 컷 배치 — 모바일: 우측 2단에 s0·s1 / PC: 좌측 s0, 우측 2단에 s1·s2
  const cell = (img: MagazineImage | undefined, cls: string, n: number) =>
    img ? (
      <figure className={`relative bg-[#cfc8bc] ${cls}`}>
        <MagazineImg image={img} className="absolute inset-0 w-full h-full" />
        <figcaption className="absolute left-2 bottom-1.5 z-[1] text-[10px] font-bold tracking-[0.18em] text-white [text-shadow:0_1px_4px_rgba(0,0,0,.55)]">{pad(n)}</figcaption>
      </figure>
    ) : (
      <div aria-hidden className={`bg-[#e7e3da] ${cls}`} />
    );
  return (
    <section aria-labelledby={headingId} className={sectionPad(tight)}>
      {!tight && <RunningHead no={no} kicker={chapter.kicker} />}

      <div className={`${tight ? "" : "mt-5 md:mt-10"} md:grid md:grid-cols-12 md:gap-x-8 items-end`}>
        <div className="md:col-span-7 flex items-end gap-4 md:gap-6">
          <ChapterNo n={no} className="text-[72px] md:text-[150px] font-black text-[#E5541B]" />
          <h2 id={headingId} className="scroll-mt-24 pb-1 md:pb-3 text-[24px] md:text-[44px] font-black tracking-tight leading-[1.2] break-keep">
            {chapter.title}
          </h2>
        </div>
        <div className="md:col-span-5 mt-4 md:mt-0 md:pb-3">
          <Copy lead={lead} rest={[]} />
        </div>
      </div>

      {/* 모바일: 메인 + 우측 2단 / PC: 좌 보조 · 중앙 메인 · 우 2단 */}
      <div className="mt-6 md:mt-10 grid grid-cols-[1.4fr_1fr] md:grid-cols-[1fr_1.35fr_1fr] gap-2 md:gap-3.5 h-[430px] md:h-[600px]">
        {cell(s0, "hidden md:block", 2)}
        <figure className="relative bg-[#8b8880]">
          <MagazineImg image={chapter.main} className="absolute inset-0 w-full h-full" />
          <figcaption className="absolute left-2 bottom-1.5 z-[1] text-[10px] font-bold tracking-[0.18em] text-white [text-shadow:0_1px_4px_rgba(0,0,0,.55)]">01</figcaption>
        </figure>
        <div className="grid grid-rows-2 gap-2 md:gap-3.5">
          {cell(s0, "md:hidden", 2)}
          {cell(s1, "", 3)}
          {cell(s2, "hidden md:block", 4)}
        </div>
      </div>

      {(chapter.quote || rest.length > 0 || chapter.credits.length > 0) && (
        <div className="mt-8 md:mt-14 md:grid md:grid-cols-12 md:gap-x-8 items-start">
          {(chapter.quote || rest.length > 0) && (
            <div className="md:col-span-7 space-y-6">
              {chapter.quote && <PullQuote>{chapter.quote}</PullQuote>}
              {rest.length > 0 && <Copy rest={rest} />}
            </div>
          )}
          {chapter.credits.length > 0 && (
            <div className={`mt-6 md:mt-0 md:col-span-4 ${chapter.quote || rest.length > 0 ? "md:col-start-9" : "md:col-start-1"}`}>
              <CreditBox chapter={chapter} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
