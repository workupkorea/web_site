import type { Metadata } from "next";
import ProductsGrid, { type CatItem } from "@/components/ProductsGrid";
import Hero from "@/components/Hero";
import SearchBar from "@/components/SearchBar";
import JsonLd from "@/components/JsonLd";
import { createAdminClient } from "@/lib/supabase-server";
import { siteUrl, absoluteUrl } from "@/lib/site";
import { getSearchConfig } from "@/lib/header-search-server";
import { getHeaderNavConfig } from "@/lib/header-nav-server";

export async function generateMetadata(): Promise<Metadata> {
  const nav = await getHeaderNavConfig();
  const productsNav = nav.items.find((it) => it.href === "/products");
  const isHidden = productsNav ? productsNav.isVisible === false : false;

  return {
    title: "PRODUCTS — 제품",
    description: "워크업이 검증한 기능성 워크웨어. 카테고리별로 찾아보세요.",
    // 카테고리·검색 등 쿼리스트링 조합(?cat=, ?q= 등)은 전부 이 페이지의 변형일 뿐이므로
    // 표준 URL을 명시해 구글이 "표준 없는 중복 페이지"로 잘못 판단하지 않게 한다.
    alternates: { canonical: "/products" },
    // 관리자에서 메뉴 비공개 처리 시 구글 인덱싱도 함께 차단
    ...(isHidden && { robots: { index: false, follow: false } }),
  };
}

// 첫 화면부터 최신 분류를 그리도록 서버에서 카테고리를 읽어 전달한다 (옛 카테고리 깜빡임 방지)
async function getCategories(): Promise<CatItem[]> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("site_settings")
      .select("config")
      .eq("section", "categories")
      .maybeSingle();
    const cats = data?.config?.categories;
    if (Array.isArray(cats)) return cats as CatItem[];
  } catch {
    // DB 실패 시 빈 목록 — 클라이언트에서 재시도
  }
  return [];
}

// 이 페이지가 개별 상품 판매 페이지가 아니라 카탈로그 열람 페이지임을 구글에 명시.
// (?cat=, ?q= 등 쿼리스트링 변형은 전부 이 페이지의 뷰일 뿐 — canonical과 함께 "표준 목록 페이지" 신호를 보강)
const collectionLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "PRODUCTS — 제품 | WORKUP",
  description: "워크업이 검증한 기능성 워크웨어. 카테고리별로 찾아보세요.",
  url: absoluteUrl("/products"),
  isPartOf: { "@type": "WebSite", name: "WORKUP", url: siteUrl },
};

export default async function ProductsPage() {
  const [initialCats, search] = await Promise.all([getCategories(), getSearchConfig()]);
  return (
    <main>
      <JsonLd data={collectionLd} />
      {/* 상단 상품 비주얼 슬라이더 (slide_type="product") — 슬라이드가 없으면 표시되지 않음 */}
      <Hero slideType="product" />
      <SearchBar search={search} />
      <ProductsGrid initialCats={initialCats} />
    </main>
  );
}
