import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { BRANDS } from "@/lib/brands-data";
import { createAdminClient } from "@/lib/supabase-server";
import { brandSlug } from "@/lib/brandCatalog-server";
import { type BrandCatalog } from "@/data/brandCatalogs";
import UnifiedCatalogViewer from "@/components/UnifiedCatalogViewer";
import CatalogBodyClass from "@/components/CatalogBodyClass";
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
  const brandAccentColor = dbBrand?.accent_color ?? staticBrand?.accentColor ?? "#333333";
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

  // PDF 카탈로그가 있으면 조립형 플립북(/brands/[id]/catalog)과 동일하게 뷰어만 화면 가득 보여준다
  // (브레드크럼·제목·다운로드 버튼 없음 — 저장은 뷰어 상단 「PDF 저장」으로)
  if (latestCatalog && pdfUrl) {
    return (
      <main style={{ backgroundColor: "#12161c" }}>
        <CatalogBodyClass />
        <h1 className="sr-only">{brandName} {latestCatalog.season || "카탈로그"}</h1>
        <UnifiedCatalogViewer
          workupPages={[]}
          brands={[]}
          sourceLabel={brandName}
          pdf={{ url: proxyPdfUrl, pageCount: latestCatalog.page_count, downloadUrl: pdfUrl }}
        />
      </main>
    );
  }

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

      {/* ── 카탈로그 섹션 ── */}
      <section className="max-w-screen-xl mx-auto px-4 md:px-8 pt-4 pb-8">
        <div className="flex items-center justify-between mb-3 gap-4">
          <div>
            <h1 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">
              {brandName} 카탈로그
            </h1>
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

        </div>

        <div className="flex flex-col items-center justify-center text-center py-24 border border-dashed border-gray-200 rounded-xl bg-gray-50">
          <p className="text-[10px] tracking-[0.28em] uppercase text-gray-300 mb-3">Coming Soon</p>
          <p className="text-gray-400 text-sm">{brandName} 카탈로그를 준비 중입니다.</p>
          <Link href="/catalog" className="mt-6 text-xs text-gray-400 underline underline-offset-2 hover:text-gray-700 transition-colors">
            전체 카탈로그 보기
          </Link>
        </div>
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
