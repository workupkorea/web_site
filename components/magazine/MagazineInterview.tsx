import type { HomeMagazineConfig } from "@/lib/home-magazine";
import MagazineImg from "./MagazineImg";
import { Kicker, TextLink } from "./parts";

// 인터뷰 — 배우가 직접 입어본 브랜드라는 신뢰를 주는 구간 (큰 인용구 + 짧은 문답)
export default function MagazineInterview({ interview }: { interview: HomeMagazineConfig["interview"] }) {
  if (!interview.enabled || !interview.image.url || !interview.quote) return null;
  return (
    <section aria-labelledby="mag-interview" className="md:grid md:grid-cols-[minmax(0,560px)_1fr] bg-[#f6f4ef]">
      <div className="relative h-[420px] md:h-auto md:min-h-[720px] bg-[#c6bfb2]">
        <MagazineImg image={interview.image} className="absolute inset-0 w-full h-full" />
      </div>
      <div className="px-5 py-10 md:px-[clamp(40px,7vw,110px)] md:py-24 md:self-center">
        <Kicker>Interview</Kicker>
        <h2 id="mag-interview" className="scroll-mt-24 mt-4 md:mt-6 text-2xl md:text-[44px] font-bold leading-[1.4] break-keep">
          “{interview.quote}”
        </h2>
        {interview.qa.length > 0 && (
          <>
            <div className="h-px bg-[#1d1e20]/20 my-6 md:my-8" />
            <dl className="mag-body space-y-4 md:space-y-5">
              {interview.qa.map((x, i) => (
                <div key={i} className="text-[13px] md:text-[15px] leading-[1.85]">
                  <dt className="font-bold">Q. {x.q}</dt>
                  <dd className="text-[#45474b]">{x.a}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        {interview.linkHref && (
          <TextLink href={interview.linkHref} className="mt-4">
            {interview.linkLabel || "인터뷰 전문 보기"} →
          </TextLink>
        )}
      </div>
    </section>
  );
}
