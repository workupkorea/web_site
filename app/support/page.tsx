import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSection } from "@/lib/site-settings";
import { getFooterConfig } from "@/lib/footer-server";
import { DEFAULT_SUPPORT, normalizeSupport, type SupportConfig } from "@/lib/site-content";
import SupportForm from "@/components/SupportForm";
import { ikSrc } from "@/lib/imageSrc";

export const metadata: Metadata = {
  title: "고객센터 · 1:1 문의",
  description: "제품·사이즈·매장 방문 등 1:1 문의.",
};

export default async function SupportPage() {
  const [supRaw, footer] = await Promise.all([
    getSiteSection<SupportConfig>("support_page"),
    getFooterConfig(),
  ]);
  const sup = normalizeSupport(supRaw);
  const telHref = `tel:${footer.cs_phone.replace(/[^0-9+]/g, "")}`;

  return (
    <main>
      <section className="bg-[#FAFAF8]">
        {/* ── 페이지 타이틀 (store 페이지와 동일한 흰 배경 타이틀 박스, 전체 폭) ── */}
        <div className="bg-white pt-10 pb-3 md:pt-12 md:pb-6 border-b border-gray-100">
          <div className="px-[15px] md:px-[70px]">
            {sup.hero_eyebrow && (
              <p className="text-xs tracking-widest text-[#E5541B] uppercase mb-3">{sup.hero_eyebrow}</p>
            )}
            {sup.hero_title && (
              <h1 className="text-[26px] md:text-[42px] font-[700] md:font-[500] text-[#303236] leading-tight mb-3">{sup.hero_title}</h1>
            )}
            {sup.hero_desc && (
              <p className="text-[13px] md:text-[17px] text-gray-500 leading-relaxed whitespace-pre-line">{sup.hero_desc}</p>
            )}
          </div>
        </div>

        <div className="pb-12 md:pb-16 pt-8 md:pt-10">
          <div className="px-[15px] md:px-[70px]">
          <div className="flex flex-col gap-6">

            {/* 상: 고객센터 정보 — 내용이 적어 세로로 늘리지 않고 가로 바 형태로 압축 */}
            <div className="border border-gray-200 bg-white overflow-hidden">
              {sup.guide_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ikSrc(sup.guide_image_url, 1200)} alt="고객센터 안내" className="w-full object-cover" />
              )}

              <div className="px-8 py-6 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">
                {sup.guide_image_url && (
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{sup.intro_desc}</p>
                )}

                <div>
                  <p className="text-xs text-gray-400 tracking-widest uppercase mb-1">고객센터</p>
                  <a href={telHref} className="text-2xl font-bold text-[#303236] hover:text-[#E5541B] transition-colors">
                    {footer.cs_phone}
                  </a>
                </div>

                <div className="text-sm text-gray-500 leading-relaxed sm:border-l sm:border-gray-200 sm:pl-8">
                  <p>{footer.cs_hours_weekday}</p>
                  <p>{footer.cs_hours_weekend}</p>
                </div>

                {/* 오프라인 전환 CTA */}
                <div className="flex flex-wrap gap-2.5 sm:ml-auto">
                  <a href={telHref}
                    className="inline-flex items-center gap-1.5 bg-[#E5541B] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#d6480a] transition-colors">
                    전화 문의
                  </a>
                  <Link href="/store"
                    className="inline-flex items-center gap-1.5 border border-[#303236] text-[#303236] text-sm font-semibold px-5 py-2.5 hover:bg-[#303236] hover:text-white transition-colors">
                    매장 찾기
                  </Link>
                </div>
              </div>
            </div>

            {/* 하: 1:1 문의 폼 */}
            <div className="flex flex-col border border-gray-200 bg-white overflow-hidden">
              <div className="px-8 py-8">
                <h3 className="text-base font-bold text-[#303236] mb-1">1:1 문의하기</h3>
                <p className="text-xs text-gray-400 mb-6">문의 구분을 선택하고 내용을 남겨 주세요.</p>
                <SupportForm />
              </div>
            </div>

          </div>

          {/* 다른 문의 경로 */}
          <div className="flex items-center justify-center gap-5 text-xs flex-wrap mt-8">
            <Link href="/partnership/franchise" className="text-[#303236] underline hover:text-[#E5541B] transition-colors">가맹·창업 문의</Link>
            <Link href="/partnership/wholesale" className="text-[#303236] underline hover:text-[#E5541B] transition-colors">입점·제휴 문의</Link>
            <Link href="/store" className="text-[#303236] underline hover:text-[#E5541B] transition-colors">매장 안내</Link>
          </div>
        </div>
      </div>
      </section>
    </main>
  );
}
