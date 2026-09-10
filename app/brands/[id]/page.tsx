import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { BRANDS } from "@/lib/brands-data";
import { createAdminClient } from "@/lib/supabase-server";
import { brandSlug } from "@/lib/brandCatalog-server";
import { type BrandCatalog } from "@/data/brandCatalogs";
import { type BrandTocItem } from "@/types/catalog";
import BrandCatalogViewerWrapper from "@/components/BrandCatalogViewerWrapper";
import CatalogBodyClass from "@/components/CatalogBodyClass";
import PdfDownloadButton from "@/components/PdfDownloadButton";
import type { Brand } from "@/data/brands";

type Props = { params: Promise<{ id: string }> };

async function getBrandByName(name: string): Promise<Brand | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("brands")
      .select("*")
      .ilike("name", name)
      .single();
    if (error || !data) return null;
    return data as Brand;
  } catch {
    return null;
  }
}

// 정적 BRANDS에 없는 브랜드: slugify(name) === slug 로 DB에서 찾는다
async function getBrandBySlug(slug: string): Promise<Brand | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("brands").select("id, name, logo_url, description").order("name");
    return ((data as Brand[]) ?? []).find((b) => brandSlug(b.name) === slug) ?? null;
  } catch {
    return null;
  }
}

async function getCatalog(brandName: string): Promise<BrandCatalog | null> {
  noStore();
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("brand_catalogs")
      .select("*")
      .ilike("brand_name", `%${brandName}%`)
      .eq("is_visible", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return data as BrandCatalog | null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const staticBrand = BRANDS.find((b) => b.id === id) ?? null;
  const dbBrand = staticBrand ? await getBrandByName(staticBrand.name) : await getBrandBySlug(id);
  const name = dbBrand?.name ?? staticBrand?.name ?? "";
  const desc = dbBrand?.description ?? staticBrand?.description ?? "";
  if (!name) return {};
  return {
    title: `${name} 카탈로그 | WORKUP`,
    description: `${name} — ${desc}. WORKUP K-WORKER STORE에서 브랜드 카탈로그를 확인하세요.`,
  };
}

export default async function BrandPage({ params }: Props) {
  noStore();
  const { id } = await params;

  const staticBrand = BRANDS.find((b) => b.id === id) ?? null;

  // DB 조회: 정적 브랜드는 name 기준, 그 외에는 slugify(name) 기준
  const dbBrand = staticBrand ? await getBrandByName(staticBrand.name) : await getBrandBySlug(id);
  if (!staticBrand && !dbBrand) notFound();

  // 브랜드 데이터 (DB 우선, 정적값 폴백)
  const brandName = dbBrand?.name ?? staticBrand?.name ?? "";
  const brandPositioning = dbBrand?.positioning ?? staticBrand?.positioning ?? "";
  const brandDescription = dbBrand?.description ?? staticBrand?.description ?? "";
  const brandDescriptionKo = dbBrand?.name_ko ?? staticBrand?.descriptionKo ?? "";
  const brandAccentColor = dbBrand?.accent_color ?? staticBrand?.accentColor ?? "#333333";
  // mega_menu_image 우선, 없으면 image_bg가 URL인 경우 히어로 이미지로 사용
  const bgValue = dbBrand?.image_bg ?? (staticBrand?.imageBg ?? "");
  const bgIsImage = bgValue.startsWith("http");
  const heroImage = dbBrand?.mega_menu_image || (bgIsImage ? bgValue : "");
  const brandImageBg = bgIsImage ? "" : (bgValue || (staticBrand?.imageBg ?? ""));
  const heroX = dbBrand?.mega_menu_image_x ?? 50;
  const heroY = dbBrand?.mega_menu_image_y ?? 30;
  const heroTextColor = dbBrand?.hero_text_color || "#ffffff";

  const logoUrl = dbBrand?.logo_url ?? "";
  const logoText = dbBrand?.logo_text ?? "";

  const latestCatalog = await getCatalog(brandName);

  // 조립형 카탈로그(이미지+정보 입력형)가 공개 상태이고 항목이 있으면 링크를 노출한다.
  let hasAssembledCatalog = false;
  if (dbBrand?.catalog_enabled) {
    try {
      const sb = createAdminClient();
      const { count } = await sb
        .from("catalog_pages")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", String(dbBrand.id))
        .eq("is_visible", true);
      hasAssembledCatalog = (count ?? 0) > 0;
    } catch { /* 무시 — 링크만 숨김 */ }
  }

  const pdfUrl = latestCatalog?.pdf_url ?? "";
  // react-pdf 클라이언트 fetch의 CORS 문제를 서버사이드 프록시로 우회
  const proxyPdfUrl = pdfUrl ? `/api/pdf-proxy?url=${encodeURIComponent(pdfUrl)}` : "";

  const toc: BrandTocItem[] = [];
  // 포지셔닝은 쉼표로 구분해 여러 태그 지원. 한글명은 별도 태그로 마지막에 추가.
  const positioningTags = (brandPositioning ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const hashtags = [...positioningTags, brandDescriptionKo].filter(Boolean);

  return (
    <main className="min-h-screen bg-white">
      <CatalogBodyClass />

      {/* ── 브레드크럼 ── */}
      <nav className="border-b border-gray-100 bg-white">
        <div className="max-w-screen-xl mx-auto px-4 md:px-8 h-10 flex items-center gap-1.5 text-[11px] text-gray-400">
          <Link href="/" className="hover:text-gray-700 transition-colors">HOME</Link>
          <span>/</span>
          <Link href="/brands" className="hover:text-gray-700 transition-colors">BRAND</Link>
          <span>/</span>
          <span className="text-gray-700 font-semibold">{brandName}</span>
        </div>
      </nav>

      {/* ── 히어로 ── */}
      <section className="relative overflow-hidden" style={{ height: 280 }}>
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            alt={brandName}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: `${heroX}% ${heroY}%` }}
          />
        ) : (
          <div className="absolute inset-0" style={{ background: brandImageBg }} />
        )}
        <div className="absolute inset-0 bg-black/40" />

        <div className="relative h-full max-w-screen-xl mx-auto px-6 md:px-10 flex flex-col justify-end pb-8">
          <p className="text-[10px] tracking-[0.3em] font-bold uppercase mb-2" style={{ color: brandAccentColor }}>
            {brandPositioning}
          </p>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brandName} className="max-h-16 md:max-h-20 max-w-xs object-contain mb-3" />
          ) : (
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none mb-3" style={{ color: heroTextColor }}>
              {logoText || brandName}
            </h1>
          )}
          <p className="text-sm max-w-lg" style={{ color: heroTextColor, opacity: 0.7 }}>{brandDescription}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {hashtags.map((tag, i) => (
              <span key={i} className="text-[10px] rounded-full px-3 py-1"
                style={{ color: heroTextColor, opacity: 0.6, border: `1px solid ${heroTextColor}30` }}>
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 카탈로그 섹션 ── */}
      <section className="max-w-screen-xl mx-auto px-4 md:px-8 pt-4 pb-8">
        <div className="flex items-center justify-between mb-3 gap-4">
          <div>
            <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">
              {brandName} {latestCatalog?.season || "카탈로그"}
            </h2>
          </div>

          {hasAssembledCatalog ? (
            <Link
              href={`/brands/${id}/catalog`}
              className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white min-h-[44px]"
              style={{ backgroundColor: brandAccentColor }}
            >
              카탈로그 보기
            </Link>
          ) : null}

          {pdfUrl ? (
            <PdfDownloadButton pdfUrl={pdfUrl} fileName={`${brandName}_카탈로그.pdf`} />
          ) : (
            <button
              disabled
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-300 text-sm cursor-not-allowed select-none"
              title="준비 중입니다"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              PDF 다운로드
            </button>
          )}
        </div>

        {latestCatalog && pdfUrl ? (
          <BrandCatalogViewerWrapper
            pdfUrl={proxyPdfUrl}
            pageCount={latestCatalog.page_count}
            brandName={brandName}
            accentColor={brandAccentColor}
            toc={toc}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-24 border border-dashed border-gray-200 rounded-xl bg-gray-50">
            <p className="text-[10px] tracking-[0.28em] uppercase text-gray-300 mb-3">Coming Soon</p>
            <p className="text-gray-400 text-sm">{brandName} 카탈로그를 준비 중입니다.</p>
            <Link href="/catalog" className="mt-6 text-xs text-gray-400 underline underline-offset-2 hover:text-gray-700 transition-colors">
              전체 카탈로그 보기
            </Link>
          </div>
        )}
      </section>

      {/* ── 하단 CTA ── */}
      <section className="max-w-screen-xl mx-auto px-4 md:px-8 pb-16 mt-4">
        <div className="border border-gray-100 rounded-2xl p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-[9px] tracking-[0.3em] font-bold uppercase mb-1 text-gray-400">STORE</p>
            <h3 className="text-xl font-black text-gray-900">매장에서 직접 체험해보세요</h3>
            <p className="text-gray-500 text-sm mt-1">가까운 WORKUP 매장에서 {brandName} 제품을 착용해볼 수 있습니다.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
            <Link href="/stores"
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-colors"
              style={{ backgroundColor: brandAccentColor }}>
              가까운 매장 찾기
            </Link>
            <a href="tel:0000000000"
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 hover:border-gray-400 transition-colors">
              전화 문의
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
