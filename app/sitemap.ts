import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { products as staticProducts, isPubliclyVisible } from "@/data/products";
import { createAdminClient } from "@/lib/supabase-server";
import { getPublicStores } from "@/lib/publicStores";
import { getHeaderNavConfig } from "@/lib/header-nav-server";

// 검색 노출 대상 정적 마케팅 페이지 (관리자·개인/기능 페이지 제외)
const staticPaths = [
  "",
  "/products",
  "/catalog",
  "/store",
  "/brands",
  "/field-test",
  "/people",
  "/story",
  "/studio",
  "/pr",
  "/careers",
  "/partnership",
  "/partnership/franchise",
  "/partnership/wholesale",
  "/support",
  "/privacy",
  "/terms",
];

// PRODUCTS 메뉴 비공개 여부 — products/page.tsx의 noindex 판정과 동일 기준
async function isProductsHidden(): Promise<boolean> {
  try {
    const nav = await getHeaderNavConfig();
    const productsNav = nav.items.find((it) => it.href === "/products");
    return productsNav ? productsNav.isVisible === false : false;
  } catch {
    // 설정 조회 실패 시 기존대로 포함
    return false;
  }
}

// 공개 제품 상세 (지역명+제품명 검색 유입) — 실제 등록된 DB 상품 기준.
// 예전엔 정적 폴백(data/products.ts, 약 50건)만 넣어 대부분의 실제 상품이 사이트맵에서 빠지고,
// 폴백 목록에 있는데 DB에서 상태가 바뀌었거나 삭제된 상품은 색인 요청 후 404가 나는 원인이 됐다.
// Supabase(PostgREST) 응답이 1000행을 넘으면 조용히 잘리므로 페이지네이션으로 전부 가져온다.
async function getProductEntries(now: Date): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = createAdminClient();
    const PAGE = 1000;
    const rows: { id: string; status: string | null; updated_at: string | null }[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("products")
        .select("id, status, updated_at")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < PAGE) break;
    }
    if (rows.length === 0) throw new Error("no rows");
    return rows
      .filter((p) => isPubliclyVisible({ status: p.status ?? undefined }))
      .map((p) => ({
        url: `${siteUrl}/products/${p.id}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : now,
        changeFrequency: "weekly",
        priority: 0.8,
      }));
  } catch {
    // DB 조회 실패 시에만 정적 폴백 사용
    return staticProducts.filter(isPubliclyVisible).map((p) => ({
      url: `${siteUrl}/products/${p.id}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // PRODUCTS 메뉴 비공개 시 목록·상세는 noindex이므로 사이트맵에서도 제외
  // (noindex 페이지를 사이트맵에 넣으면 구글에 상충 신호를 보냄)
  const productsHidden = await isProductsHidden();

  const staticEntries: MetadataRoute.Sitemap = staticPaths
    .filter((path) => !(productsHidden && path === "/products"))
    .map((path) => ({
      url: `${siteUrl}${path}`,
      lastModified: now,
      changeFrequency: path === "" ? "daily" : "weekly",
      priority: path === "" ? 1 : 0.7,
    }));

  const productEntries = productsHidden ? [] : await getProductEntries(now);

  // 매장 상세 (지역명+매장명 로컬 SEO). 데이터 조회 실패해도 사이트맵은 유지.
  let storeEntries: MetadataRoute.Sitemap = [];
  try {
    const stores = await getPublicStores();
    storeEntries = stores.map((s) => ({
      url: `${siteUrl}/store/${s.id}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    }));
  } catch {
    // 조회 실패 시 매장 항목만 생략
  }

  return [...staticEntries, ...productEntries, ...storeEntries];
}
