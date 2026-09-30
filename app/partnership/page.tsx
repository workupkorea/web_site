import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "파트너십 — 가맹·창업 / 입점·제휴 문의",
  description: "WORKUP 가맹·창업 및 브랜드 입점·제휴 문의 안내.",
};

const CHOICES = [
  {
    href: "/partnership/franchise",
    eyebrow: "Franchise",
    title: "가맹·창업 문의",
    desc: "WORKUP 브랜드로 독립 매장을 창업하고 싶으신 분을 위한 안내입니다.",
    bg: "#303236",
  },
  {
    href: "/partnership/wholesale",
    eyebrow: "Partnership",
    title: "브랜드 입점·제휴 문의",
    desc: "내 브랜드 제품을 WORKUP 매장에 납품·입점하고 싶은 브랜드를 위한 안내입니다.",
    bg: "#2d4f72",
  },
];

export default function PartnershipPage() {
  return (
    <main>
      {/* 히어로 */}
      <div className="bg-[#303236] py-20">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs tracking-widest text-[#E5541B] uppercase mb-3">PARTNERSHIP</p>
          <h1 className="text-4xl font-bold text-white mb-4">WORKUP과 함께</h1>
          <p className="text-gray-300 text-sm leading-relaxed max-w-xl">
            WORKUP 브랜드로 창업하거나, 내 브랜드를 WORKUP 매장에 입점시키고 싶다면
            아래에서 문의 유형을 선택해 주세요.
          </p>
        </div>
      </div>

      <div className="bg-[#FAFAF8] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-6">
            {CHOICES.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="group block border border-gray-200 bg-white overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="px-10 py-12 flex flex-col justify-between min-h-[260px]" style={{ backgroundColor: c.bg }}>
                  <div>
                    <p className="text-xs tracking-widest text-[#E5541B] uppercase mb-3">{c.eyebrow}</p>
                    <h2 className="text-2xl font-bold text-white mb-4">{c.title}</h2>
                    <p className="text-gray-300 text-sm leading-relaxed">{c.desc}</p>
                  </div>
                  <span className="mt-8 inline-flex items-center gap-2 text-white text-sm font-semibold group-hover:gap-3 transition-all">
                    문의하러 가기 →
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/products" className="text-xs text-[#303236] underline hover:text-[#E5541B] transition-colors">
              제품 라인업 먼저 둘러보기 →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
