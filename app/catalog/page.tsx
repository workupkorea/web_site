import type { Metadata } from "next";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase-server";
import type { CatalogPage } from "@/data/catalog";
import { brandPageUrl, brandCoverUrl, type BrandCatalog } from "@/data/brandCatalogs";
import UnifiedCatalogViewer, { type BrandEntry, type AssembledCatalogLink } from "@/components/UnifiedCatalogViewer";
import CatalogBodyClass from "@/components/CatalogBodyClass";
import { BRANDS } from "@/lib/brands-data";
import { brandSlug } from "@/lib/brandCatalog-server";

export const metadata: Metadata = {
  title: "2026 SS 카탈로그",
  description: "WORKUP 2026 Spring/Summer 신제품 카탈로그와 입점 브랜드 카탈로그를 한곳에서.",
};

type CatalogData = {
  pages: CatalogPage[];
  brands: BrandCatalog[];
  assembled: AssembledCatalogLink[]; // 조립형 카탈로그(이미지+정보 입력형) — 별도 페이지로 링크
};

// WORKUP 카탈로그 페이지 + 타사 브랜드 PDF + 조립형 카탈로그 링크를 함께 읽는다(관리자 수정 즉시 반영).
async function getData(): Promise<CatalogData> {
  noStore();
  try {
    const supabase = createAdminClient();
    const [{ data: pages }, { data: brandsData }, { data: catBrands }, { data: items }] = await Promise.all([
      supabase.from("catalog_pages").select("*").eq("is_visible", true).eq("brand_id", "").order("sort_order", { ascending: true }).order("id", { ascending: true }),
      supabase.from("brand_catalogs").select("*").eq("is_visible", true).order("sort_order", { ascending: true }).order("id", { ascending: true }),
      supabase.from("brands").select("id, name").eq("catalog_enabled", true),
      supabase.from("catalog_pages").select("brand_id").eq("is_visible", true).neq("brand_id", ""),
    ]);

    // 노출 제품이 1개 이상인 조립형 카탈로그만 링크로 노출
    const withItems = new Set(((items as { brand_id: unknown }[]) ?? []).map((r) => String(r.brand_id)));
    const assembled: AssembledCatalogLink[] = ((catBrands as { id: unknown; name: string }[]) ?? [])
      .filter((b) => withItems.has(String(b.id)))
      .map((b) => {
        const slug =
          BRANDS.find((s) => s.name.toLowerCase() === (b.name ?? "").toLowerCase())?.id ||
          brandSlug(b.name);
        return slug ? { name: b.name, href: `/brands/${slug}/catalog` } : null;
      })
      .filter((x): x is AssembledCatalogLink => x !== null);

    return { pages: (pages as CatalogPage[]) ?? [], brands: (brandsData as BrandCatalog[]) ?? [], assembled };
  } catch {
    return { pages: [], brands: [], assembled: [] };
  }
}

export default async function CatalogPage() {
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT ?? "";
  const { pages, brands, assembled } = await getData();

  const brandEntries: BrandEntry[] = brands
    .filter((b) => b.pdf_public_id)
    .map((b) => ({
      id: b.id,
      name: b.brand_name,
      cover: b.thumbnail_url || (urlEndpoint ? brandCoverUrl(urlEndpoint, b.pdf_public_id) : ""),
      pages: urlEndpoint && b.page_count > 0 ? Array.from({ length: b.page_count }, (_, i) => brandPageUrl(urlEndpoint, b.pdf_public_id, i + 1)) : [],
      pdf_url: b.pdf_url || "",
    }));

  if (pages.length === 0 && brandEntries.length === 0 && assembled.length === 0) {
    return <main><CatalogEmpty /></main>;
  }

  return (
    <main>
      <CatalogBodyClass />
      <UnifiedCatalogViewer workupPages={pages} brands={brandEntries} assembledLinks={assembled} />
    </main>
  );
}

// 등록된 카탈로그가 없을 때 — 빈 화면 대신 매장/제품으로 안내(오프라인 전환 유지).
function CatalogEmpty() {
  return (
    <div className="bg-[#0d1826] flex flex-col items-center justify-center text-center px-6" style={{ height: "calc(100vh - var(--wu-topbar-h, 36px) - var(--wu-header-h, 97px))" }}>
      <p className="text-[10px] tracking-[0.3em] text-[#E5541B] uppercase mb-4">Catalog</p>
      <h1 className="text-2xl md:text-3xl font-bold text-white leading-snug mb-3">카탈로그를 준비하고 있습니다</h1>
      <p className="text-sm text-gray-400 leading-relaxed mb-8">새 카탈로그가 곧 공개됩니다.<br />그동안 제품과 가까운 매장을 먼저 둘러보세요.</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/products" className="inline-block bg-[#E5541B] text-white text-sm tracking-widest px-7 py-3 hover:bg-[#d05518] transition-colors">제품 보기</Link>
        <Link href="/store" className="inline-block border border-white/40 text-white text-sm tracking-widest px-7 py-3 hover:bg-white hover:text-[#303236] transition-colors">매장 찾기</Link>
      </div>
      <Link href="/" className="mt-6 text-xs text-white/40 hover:text-white/80 tracking-widest transition-colors">메인으로 ←</Link>
    </div>
  );
}
