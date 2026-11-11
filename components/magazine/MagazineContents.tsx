import {
  buildAutoContentsItems,
  contentsItemHref,
  isContentsItemAvailable,
  type HomeMagazineConfig,
} from "@/lib/home-magazine";
import ContentsChapterRow from "./ContentsChapterRow";

// 목차(In this issue) — 잡지의 목차 페이지.
//  · 기본: 노출되는 구간(인터뷰·챕터·비하인드·착용 제품)을 섹션 순서대로 자동 나열한다.
//  · 관리자가 "직접 편집"으로 바꾸면 편집한 항목(제목·보조 문구·이동 대상)을 그대로 쓴다. 가리키는 구간이 노출되지 않으면 그 항목은 빠진다.
//  · target "chapters" 항목은 챕터가 여러 개여도 한 줄로 묶어 제목을 순차 롤링한다(ContentsChapterRow).
const pad = (n: number) => String(n).padStart(2, "0");

export default function MagazineContents({ config }: { config: HomeMagazineConfig }) {
  if (!config.contents.enabled) return null;

  const items = (config.contents.items ?? buildAutoContentsItems(config)).filter((it) => isContentsItemAvailable(config, it));
  if (items.length === 0) return null;

  const heading = (config.contents.heading ?? "In this\nissue").split("\n");
  const subtitle = config.contents.subtitle ?? config.issue.season;

  return (
    <section aria-labelledby="mag-contents" className="mag-sans px-5 py-12 md:px-14 md:py-24 bg-white text-[#1d1e20]">
      <div className="mag-label flex items-baseline justify-between text-[10px] md:text-[11px] tracking-[0.28em] uppercase">
        <b className="font-bold">Contents</b>
        <span className="text-[#1d1e20]/45">{config.issue.label}</span>
      </div>

      <div className="mt-6 md:mt-12 md:grid md:grid-cols-12 md:gap-x-8">
        <div className="md:col-span-4">
          <h2 id="mag-contents" className="mag-display text-[34px] md:text-[56px] font-black tracking-tight leading-[1.05]">
            {heading.map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </h2>
          {subtitle && <p className="mag-label mt-3 md:mt-5 text-[11px] tracking-[0.22em] uppercase text-[#1d1e20]/55">{subtitle}</p>}
        </div>

        <ol className="md:col-span-8 mt-8 md:mt-0">
          {items.map((it, i) => {
            if (it.target === "chapters") {
              return (
                <ContentsChapterRow
                  key={it.id}
                  number={pad(i + 1)}
                  items={config.chapters.map((c) => ({ id: c.id, title: c.title || "Chapter", note: c.kicker }))}
                />
              );
            }
            const external = /^https?:\/\//.test(it.href ?? "");
            return (
              <li key={it.id} className="border-t border-[#1d1e20]/25 last:border-b">
                <a
                  href={contentsItemHref(it)}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group flex items-baseline gap-4 md:gap-8 py-4 md:py-6 min-h-[44px] hover:bg-[#f6f4ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E5541B] transition-colors"
                >
                  <span className="shrink-0 w-8 md:w-14 text-[13px] md:text-[18px] font-black text-[#E5541B]">{pad(i + 1)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[18px] md:text-[28px] font-bold tracking-tight leading-snug break-keep">{it.title}</span>
                    {it.note && <span className="block mt-1 text-[11px] md:text-xs tracking-[0.12em] uppercase text-[#55575b] truncate">{it.note}</span>}
                  </span>
                  <span aria-hidden className="shrink-0 text-lg text-[#1d1e20]/40 transition-transform group-hover:translate-x-1 group-hover:text-[#E5541B]">→</span>
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
