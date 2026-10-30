import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBannerDetail, getHeroDetail, MAIN_DETAIL_SLUG } from "@/lib/editorial-blocks";
import { ikSrc } from "@/lib/imageSrc";
import ProductFeatureTabs from "@/components/ProductFeatureTabs";

// banner가 "main"이면 메인 기획전 상세, 숫자면 서브 배너 상세
const loadDetail = (slug: string, banner: string) =>
  banner === MAIN_DETAIL_SLUG ? getHeroDetail(slug) : getBannerDetail(slug, Number(banner));

type Props = { params: Promise<{ slug: string; banner: string }>; searchParams: Promise<{ product?: string; item?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, banner } = await params;
  const detail = await loadDetail(slug, banner);
  if (!detail) return { title: "기획전" };
  return {
    title: `${detail.title} — WORKUP`,
    description: detail.desc || `${detail.title} 기획전. 워크업 매장에서 직접 체험해보세요.`,
    openGraph: {
      title: `${detail.title} — WORKUP`,
      description: detail.desc,
      images: detail.imageUrl ? [detail.imageUrl] : undefined,
    },
  };
}

export default async function BannerDetailPage({ params, searchParams }: Props) {
  const { slug, banner } = await params;
  const { product: initialProductId, item: initialItemId } = await searchParams;
  const detail = await loadDetail(slug, banner);
  if (!detail) notFound();

  const products = detail.products.filter((p) => p.productId || p.name);

  return (
    <main className="bg-[#FAFAF8]">
      {/* ── 상단: 좌 텍스트 / 우 섹션이미지 ───────────────────── */}
      <section className="max-w-screen-xl mx-auto px-6 md:px-10 py-6 md:py-8">
        <div className="flex flex-col md:flex-row md:items-stretch gap-4 md:gap-6">
          {/* 좌: 기획전 타이틀 + 설명 — 오른쪽 이미지와 동일한 높이의 흰색 패널 */}
          <div className="md:flex-1 md:min-w-0 order-2 md:order-1 bg-white flex flex-col justify-center px-6 py-6 md:px-10 md:py-8">
            <h1 className="text-2xl md:text-4xl font-bold text-[#303236] leading-snug mb-5 whitespace-pre-line">
              {detail.title}
            </h1>
            {detail.desc && (
              <p className="text-sm md:text-base text-gray-500 leading-relaxed whitespace-pre-line">
                {detail.desc}
              </p>
            )}
          </div>

          {/* 우: 배너 섹션 이미지 (8:9) — PC에서는 폭을 줄여 하단 제품 리스트가 빨리 보이게 */}
          <div className="md:flex-none md:w-[300px] lg:w-[340px] order-1 md:order-2 max-md:max-w-[320px] max-md:mx-auto max-md:w-full">
            <div
              className="relative w-full overflow-hidden bg-gray-100 flex items-center justify-center"
              style={{ aspectRatio: "440 / 495" }}
            >
              {detail.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ikSrc(detail.imageUrl, 1200)} alt={detail.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-300 text-6xl font-black select-none">WU</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 하단: 제품 탭(제품명 클릭 시 이미지·컬러·사이즈·아코디언 전환) ─── */}
      {products.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-6 md:px-10 pb-16 md:pb-24">
          <ProductFeatureTabs products={products} initialProductId={initialProductId} initialItemId={initialItemId} />
        </section>
      )}

      {/* ── 최종 CTA: 매장 방문 유도 ──────────────────────────── */}
      <section className="bg-[#303236] py-14 md:py-20">
        <div className="max-w-screen-xl mx-auto px-6 md:px-12 text-center">
          <p className="text-[11px] tracking-[0.3em] text-[#E5541B] uppercase mb-5">VISIT US</p>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 leading-snug">
            직접 입어봐야<br className="sm:hidden" /> 알 수 있습니다
          </h2>
          <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-9">
            사진으로는 느낄 수 없는 착용감과 소재감을<br />
            가까운 워크업 매장에서 직접 확인하세요.
          </p>
          <Link
            href="/store"
            className="inline-flex items-center gap-2 bg-[#E5541B] text-white font-bold px-10 md:px-12 py-4 text-sm tracking-widest hover:bg-[#e04a0a] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            가까운 매장 찾기
          </Link>
        </div>
      </section>
    </main>
  );
}
