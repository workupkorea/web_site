import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { loadBrandCatalog, loadBrandPdfCatalog } from "@/lib/brandCatalog-server";
import UnifiedCatalogViewer from "@/components/UnifiedCatalogViewer";
import CatalogBodyClass from "@/components/CatalogBodyClass";
import { absoluteUrl } from "@/lib/site";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = (await loadBrandCatalog(id)) ?? (await loadBrandPdfCatalog(id));
  if (!data) return {};
  const name = data.brand.name;
  return {
    title: `${name} 카탈로그 | WORKUP`,
    description: `${name} 제품 카탈로그. WORKUP K-WORKER STORE.`,
  };
}

// 브랜드 카탈로그 진입점(메가메뉴·브랜드 카드가 모두 이 주소로 연결).
// 조립형 플립북 → PDF 카탈로그 → (둘 다 없으면) 브랜드 허브 순으로, 동일한 플립북 UI로 보여준다.
export default async function BrandCatalogPage({ params }: Props) {
  noStore();
  const { id } = await params;

  const assembled = await loadBrandCatalog(id);
  const pdf = assembled && assembled.pages.length > 0 ? null : await loadBrandPdfCatalog(id);
  const data = pdf ?? assembled;
  // 조립형·PDF 모두 없음: 브랜드 허브("준비 중" 안내)로 보낸다. 없는 브랜드면 허브가 404를 낸다.
  if (!data || (!pdf && assembled!.pages.length === 0)) redirect(`/brands/${id}`);

  const brandName = data.brand.name;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "HOME", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "BRAND", item: absoluteUrl("/brands") },
        { "@type": "ListItem", position: 3, name: `${brandName} 카탈로그` },
      ] },
      { "@type": "Brand", name: brandName, description: data.brand.description ?? "" },
    ],
  };

  return (
    <main>
      <CatalogBodyClass />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {pdf ? (
        <UnifiedCatalogViewer
          workupPages={[]}
          brands={[]}
          sourceLabel={brandName}
          pdf={{
            // react-pdf 클라이언트 fetch의 CORS 문제를 서버사이드 프록시로 우회
            url: `/api/pdf-proxy?url=${encodeURIComponent(pdf.catalog.pdf_url)}`,
            pageCount: pdf.catalog.page_count,
            downloadUrl: pdf.catalog.pdf_url,
          }}
        />
      ) : (
        <UnifiedCatalogViewer workupPages={assembled!.pages} brands={[]} sourceLabel={brandName} />
      )}
    </main>
  );
}
