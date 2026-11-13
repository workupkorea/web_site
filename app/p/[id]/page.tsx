import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-server";

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type PopupPage = {
  id: string;
  admin_title: string;
  is_visible: boolean;
  label: string;
  label_color: string;
  title: string;
  description: string;
  hero_image_url: string;
  page_bg: string;
  product_section_title: string;
  product_ids: string[];
  cta_text: string;
  cta_link: string;
  sort_order: number;
};

// ── 데이터 로더 ───────────────────────────────────────────────────────────────

async function getPopupPages(): Promise<PopupPage[]> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("site_settings")
      .select("config")
      .eq("section", "popup_pages")
      .maybeSingle();
    const pages = (data?.config as { pages?: PopupPage[] } | null)?.pages;
    if (Array.isArray(pages)) return pages;
  } catch { /* empty */ }
  return [];
}

type ProductRow = { id: string; name: string; thumbnail_url?: string; price?: number };

async function getProducts(ids: string[]): Promise<ProductRow[]> {
  if (!ids.length) return [];
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("products")
      .select("id, name, thumbnail_url, price")
      .in("id", ids);
    if (!data) return [];
    return ids.flatMap(id => (data as ProductRow[]).filter(p => p.id === id));
  } catch {
    return [];
  }
}

// ── 메타데이터 ────────────────────────────────────────────────────────────────

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const pages = await getPopupPages();
  const page = pages.find(p => p.id === id);
  if (!page) return { title: { absolute: "워크업" } };
  return {
    title: page.title,
    description: page.description || `${page.title}. 워크업 매장에서 직접 체험해보세요.`,
    openGraph: {
      title: `${page.title} — 워크업`,
      description: page.description,
      images: page.hero_image_url ? [page.hero_image_url] : undefined,
    },
  };
}

// ── 페이지 컴포넌트 ───────────────────────────────────────────────────────────

export default async function PopupLandingPage({ params }: Props) {
  const { id } = await params;
  const pages = await getPopupPages();
  const page = pages.find(p => p.id === id && p.is_visible !== false);
  if (!page) notFound();

  const products = await getProducts(page.product_ids ?? []);
  const pageBg       = page.page_bg       || "#FAFAF8";
  const labelColor   = page.label_color   || "#E5541B";
  const ctaBg        = "#303236";

  return (
    <main style={{ background: pageBg }}>

      {/* ── 상단 히어로: 좌 텍스트 패널 / 우 이미지 ─────────────────────── */}
      <section className="max-w-screen-xl mx-auto px-6 md:px-10 py-10 md:py-16">
        <div className="flex flex-col md:flex-row md:items-stretch gap-5 md:gap-8">

          {/* 좌: 흰색 패널 — 라벨 + 제목 + 설명 */}
          <div className="md:flex-1 md:min-w-0 order-2 md:order-1 bg-white flex flex-col justify-center px-6 py-8 md:px-10 md:py-12">
            {page.label && (
              <p className="text-[11px] tracking-[0.25em] uppercase mb-4" style={{ color: labelColor }}>
                {page.label}
              </p>
            )}
            <h1 className="text-2xl md:text-4xl font-bold text-[#303236] leading-snug mb-5 whitespace-pre-line">
              {page.title}
            </h1>
            {page.description && (
              <p className="text-sm md:text-base text-gray-500 leading-relaxed whitespace-pre-line">
                {page.description}
              </p>
            )}
          </div>

          {/* 우: 히어로 이미지 (440:495 비율) */}
          <div className="md:flex-1 md:min-w-0 order-1 md:order-2">
            <div
              className="relative w-full overflow-hidden bg-gray-100 flex items-center justify-center"
              style={{ aspectRatio: "440 / 495" }}
            >
              {page.hero_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={page.hero_image_url}
                  alt={page.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-gray-300 text-6xl font-black select-none">WU</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 제품 그리드 ────────────────────────────────────────────────────── */}
      {products.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-6 md:px-10 pb-16 md:pb-24">
          <div className="flex items-baseline justify-between mb-6 md:mb-8 border-t border-gray-100 pt-10">
            <h2 className="text-lg md:text-xl font-bold text-[#303236]">
              {page.product_section_title || "이 기획전의 제품"}
            </h2>
            <span className="text-xs text-gray-400">{products.length}개 제품</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-10">
            {products.map(p => (
              <Link key={p.id} href={`/products/${p.id}`} className="group block">
                <div className="w-full aspect-square bg-gray-100 overflow-hidden flex items-center justify-center mb-3">
                  {p.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.thumbnail_url}
                      alt={p.name}
                      className="w-full h-full object-contain transition-transform duration-300"
                    />
                  ) : (
                    <span className="text-gray-300 text-sm font-black">WU</span>
                  )}
                </div>
                <p className="text-[13px] md:text-sm text-[#303236] leading-snug mb-1 line-clamp-2">{p.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── 매장 방문 CTA ─────────────────────────────────────────────────── */}
      <section className="py-14 md:py-20" style={{ background: ctaBg }}>
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
            href={page.cta_link || "/store"}
            className="inline-flex items-center gap-2 bg-[#E5541B] text-white font-bold px-10 md:px-12 py-4 text-sm tracking-widest hover:bg-[#e04a0a] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {page.cta_text || "가까운 매장 찾기"}
          </Link>
        </div>
      </section>

    </main>
  );
}
