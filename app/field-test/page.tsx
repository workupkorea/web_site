import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_TESTS, type Test } from "@/data/field-test";
import { getSiteSection } from "@/lib/site-settings";
import { ikSrc } from "@/lib/imageSrc";

const DEFAULT_HEADER = {
  title: "제품 검증 콘텐츠",
  description: "워크업은 제품을 팔기 전에 현장에서 먼저 씁니다.\n통과한 것만 올립니다. 수치는 현장 언어로 번역합니다.",
};

export const metadata: Metadata = {
  title: "FIELD TEST — 제품 검증 콘텐츠",
  description: "워크업이 현장에서 직접 검증한 제품 테스트 결과를 공개합니다.",
};

export default async function FieldTestPage() {
  const config = await getSiteSection<{ header?: typeof DEFAULT_HEADER; items?: Test[] }>("field_test_page");
  const header = config?.header ?? DEFAULT_HEADER;
  const tests = config?.items?.length ? config.items : DEFAULT_TESTS;

  return (
    <main>

      {/* ── 페이지 타이틀 ── */}
      <section className="pt-16 pb-0 bg-[#FAFAF8]">
        <div className="px-[15px] md:px-[70px]">
          <h1 className="text-[32px] md:text-[42px] font-bold text-[#303236] leading-tight mb-4">
            {header.title}
          </h1>
          <p className="text-[14px] text-gray-500 leading-relaxed max-w-xl">
            {header.description.split("\n").map((line, i) => (
              <span key={i}>{line}{i < header.description.split("\n").length - 1 && <br />}</span>
            ))}
          </p>
        </div>
      </section>

      {/* ── 테스트 결과 카드 ── */}
      <section className="bg-[#FAFAF8] pt-[60px] pb-16">
        <div className="px-[15px] md:px-[70px]">

          <div className="mb-8 flex items-center gap-3">
            <span className="bg-[#303236] text-white text-xs font-bold px-3 py-1.5">
              통과 {tests.length}건
            </span>
            <span className="text-xs text-gray-400">누적 {tests.length}건 테스트</span>
          </div>

          <div className="space-y-6">
            {tests.map((test) => (
              <div
                key={test.id}
                className="bg-white border-l-4 border-[#E5541B] overflow-hidden"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3">

                  {/* 테스트 이미지 (등록 시) 또는 플레이스홀더 */}
                  {test.image_url ? (
                    <div className="bg-[#303236] aspect-video lg:aspect-auto relative overflow-hidden min-h-[200px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ikSrc(test.image_url!, 1200)} alt={test.product} className="absolute inset-0 w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="bg-[#303236] aspect-video lg:aspect-auto flex flex-col items-center justify-center gap-3 p-8">
                      <div className="w-14 h-14 rounded-full border-2 border-white/20 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white/50 ml-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      <p className="text-white/40 text-xs tracking-widest uppercase text-center">테스트 이미지</p>
                      <p className="text-white/25 text-xs text-center">미등록</p>
                    </div>
                  )}

                  {/* 테스트 정보 */}
                  <div className="p-8 lg:col-span-2">
                    <div className="flex items-start justify-between gap-4 mb-5">
                      <div>
                        <p className="text-xs text-gray-400 tracking-widest uppercase mb-1">{test.category}</p>
                        <h3 className="text-[18px] font-bold text-[#303236] mb-1">{test.product}</h3>
                        <p className="text-sm text-gray-500">{test.title}</p>
                      </div>
                      <span className="flex-shrink-0 text-xs font-bold px-4 py-2 bg-[#E5541B] text-white">
                        통과
                      </span>
                    </div>

                    {/* 테스트 조건 */}
                    <div className="mb-5">
                      <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">테스트 조건</p>
                      <div className="flex flex-wrap gap-2">
                        {test.conditions.map((c) => (
                          <span key={c} className="text-xs bg-gray-100 text-gray-600 px-2 py-1">{c}</span>
                        ))}
                      </div>
                    </div>

                    {/* 수치 → 현장 언어 */}
                    <div className="mb-5 space-y-2">
                      <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">수치 → 현장 언어</p>
                      {test.data.map((d) => (
                        <div key={d.spec} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 font-mono">{d.spec}</div>
                          <div className="bg-orange-50 px-3 py-2 text-xs font-semibold text-[#E5541B]">→ {d.plain}</div>
                        </div>
                      ))}
                    </div>

                    {/* 착용자 피드백 */}
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">착용자 피드백</p>
                      <p className="text-sm text-gray-600 leading-relaxed">{test.feedback}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 하단 CTA ── */}
      <section className="py-20 bg-white border-t border-gray-100">
        <div className="px-[15px] md:px-[70px]">
          <p className="text-[11px] tracking-[0.2em] text-gray-400 uppercase mb-5">Experience</p>
          <h2 className="text-[26px] font-bold text-[#303236] mb-4">
            테스트 통과 제품을 직접 확인하세요.
          </h2>
          <p className="text-[13px] text-gray-500 mb-8 leading-relaxed">
            데이터로 검증됐지만, 몸으로 느끼는 건 직접 입어봐야 압니다.
          </p>
          <Link
            href="/store"
            className="inline-flex items-center gap-2 border border-[#303236] text-[#303236] text-[12px] tracking-widest font-medium px-8 py-3.5 hover:bg-[#303236] hover:text-white transition-colors"
          >
            근처 매장 찾아보기 →
          </Link>
        </div>
      </section>

    </main>
  );
}
