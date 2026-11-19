import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBannerDetail, getHeroDetail, MAIN_DETAIL_SLUG } from "@/lib/editorial-blocks";
import { ikSrc } from "@/lib/imageSrc";
import ProductFeatureGrid from "@/components/ProductFeatureGrid";
import { isAdmin } from "@/lib/admin-auth";

// banner가 "main"이면 메인 기획전 상세, 숫자면 서브 배너 상세
const loadDetail = (slug: string, banner: string, preview: boolean) =>
  banner === MAIN_DETAIL_SLUG ? getHeroDetail(slug, preview) : getBannerDetail(slug, Number(banner), preview);

// ?campaign=1 : 관리자 예약 미리보기(/magazine-preview)에서 이동한 경우에만 예약 오픈 전 기획전도 열어 준다.
// 공개 접속(관리자 아님)에는 영향이 없고, 파라미터가 있을 때만 로그인 쿠키를 확인한다.
async function isCampaignPreview(campaign?: string) {
  if (campaign !== "1") return false;
  return process.env.NODE_ENV !== "production" || (await isAdmin());
}

type Props = { params: Promise<{ slug: string; banner: string }>; searchParams: Promise<{ product?: string; item?: string; campaign?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug, banner } = await params;
  const detail = await loadDetail(slug, banner, await isCampaignPreview((await searchParams).campaign));
  if (!detail) return { title: "기획전" };
  return {
    title: `${detail.title}`,
    description: detail.desc || `${detail.title} 기획전. 워크업 매장에서 직접 체험해보세요.`,
    openGraph: {
      title: `${detail.title} — 워크업`,
      description: detail.desc,
      images: detail.imageUrl ? [detail.imageUrl] : undefined,
    },
  };
}

export default async function BannerDetailPage({ params, searchParams }: Props) {
  const { slug, banner } = await params;
  const { product: initialProductId, item: initialItemId, campaign } = await searchParams;
  const detail = await loadDetail(slug, banner, await isCampaignPreview(campaign));
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
          <div className="md:flex-none md:w-[300px] lg:w-[340px] order-1 md:order-2 max-md:w-full">
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

      {/* ── 하단: 제품 카드 목록(사진+제품명, 클릭 시 제품 상세로 이동) ─── */}
      {products.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-6 md:px-10 pb-16 md:pb-24">
          <ProductFeatureGrid products={products} initialProductId={initialProductId} initialItemId={initialItemId} />
        </section>
      )}

      {/* ── 하단: 메인페이지로 이동 ─────────────────────────── */}
      <section className="max-w-screen-xl mx-auto px-6 md:px-10 pb-16 md:pb-24">
        <Link
          href="/"
          className="flex items-center justify-center w-full min-h-[56px] border border-[#303236] text-[#303236] text-sm font-bold tracking-wide hover:bg-[#303236] hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#303236]"
        >
          메인페이지로
        </Link>
      </section>
    </main>
  );
}
