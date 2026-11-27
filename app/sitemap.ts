import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { products as staticProducts, isPubliclyVisible } from "@/data/products";
import { editorials } from "@/data/editorial";
import { createAdminClient } from "@/lib/supabase-server";
import { getPublicStores } from "@/lib/publicStores";
import { isProductsHidden } from "@/lib/header-nav-server";
import { listCatalogBrandSlugs } from "@/lib/brandCatalog-server";
import { getPrRoom } from "@/lib/pr-room-server";
import { getHomeLayout } from "@/lib/home-layout-server";
import { getHomeMagazine } from "@/lib/home-magazine-server";
import { resolveHomeLayout } from "@/lib/home-layout";
import { isMagazinePublishable } from "@/lib/home-magazine";
import { getSiteSection } from "@/lib/site-settings";

// DB의 공개·삭제 상태를 요청 시점 기준으로 반영한다 (빌드 때 목록이 고정되지 않도록)
export const dynamic = "force-dynamic";

// 검색 노출 대상 정적 마케팅 페이지 (관리자·개인/기능·noindex 페이지 제외)
// /franchise 는 /partnership/franchise 를 정본으로 지정했으므로 넣지 않는다.
const staticPaths = [
  "",
  "/products",
  "/store",
  "/brands",
  "/group-order",
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

type Entry = MetadataRoute.Sitemap[number];

const entry = (path: string, rest: Omit<Entry, "url"> = {}): Entry => ({
  url: `${siteUrl}${path}`,
  changeFrequency: "weekly",
  priority: 0.7,
  ...rest,
});

// 한 영역의 조회가 실패해도 나머지 사이트맵은 유지한다
async function safely(load: () => Promise<Entry[]>): Promise<Entry[]> {
  try {
    return await load();
  } catch (e) {
    console.error("[sitemap]", e);
    return [];
  }
}

// 공개 제품 상세 — 실제 등록된 DB 상품 기준.
// Supabase(PostgREST) 응답이 1000행을 넘으면 조용히 잘리므로 페이지네이션으로 전부 가져온다.
async function getProductEntries(): Promise<Entry[]> {
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
      .map((p) => entry(`/products/${p.id}`, {
        ...(p.updated_at ? { lastModified: new Date(p.updated_at) } : {}),
        priority: 0.8,
      }));
  } catch {
    // DB 조회 실패 시에만 정적 폴백 사용
    return staticProducts.filter(isPubliclyVisible).map((p) => entry(`/products/${p.id}`, { priority: 0.8 }));
  }
}

// 매장 상세 — 상세 페이지가 실제로 열리는 매장만(운영 중 + "스토어 페이지" 노출).
// getPublicStores 는 오픈·폐업 예정일 처리와 DB 장애 폴백을 포함하므로, 폴백 데이터(pageActive 미정)는 제외한다.
async function getStoreEntries(): Promise<Entry[]> {
  const stores = await getPublicStores();
  return stores
    .filter((s) => s.pageActive === true)
    .map((s) => entry(`/store/${s.id}`, { changeFrequency: "monthly", priority: 0.8 }));
}

async function getBrandEntries(): Promise<Entry[]> {
  return (await listCatalogBrandSlugs()).map((slug) => entry(`/brands/${slug}/catalog`));
}

// 보도자료·공지 — 외부 원문 링크만 있는 글은 목록에서 외부로 이동하므로 제외
async function getPrEntries(): Promise<Entry[]> {
  const { posts } = await getPrRoom();
  return posts.filter((p) => p.is_visible && !p.link).map((p) => entry(`/pr/${p.id}`, { changeFrequency: "monthly" }));
}

async function getPopupEntries(): Promise<Entry[]> {
  const config = await getSiteSection<{ pages?: { id: string; is_visible?: boolean }[] }>("popup_pages");
  return (config?.pages ?? []).filter((p) => p.is_visible !== false).map((p) => entry(`/p/${p.id}`));
}

// 매거진 — app/magazine/page.tsx 의 비로그인 노출 조건과 동일
async function getMagazineEntries(): Promise<Entry[]> {
  const [layout, magazine] = await Promise.all([getHomeLayout(), getHomeMagazine()]);
  const visible = resolveHomeLayout(layout).sections.find((s) => s.key === "magazine")?.visible;
  return visible && isMagazinePublishable({ ...magazine, topBanner: "magazine" }) ? [entry("/magazine")] : [];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // PRODUCTS 메뉴 비공개(내부 정책) 시 상품 계열 페이지는 noindex이므로 사이트맵에서도 제외
  const productsHidden = await isProductsHidden();

  const staticEntries = staticPaths
    .filter((path) => !(productsHidden && path === "/products"))
    .map((path) => entry(path, path === "" ? { changeFrequency: "daily", priority: 1 } : {}));

  const dynamicEntries = await Promise.all([
    productsHidden ? Promise.resolve([]) : safely(getProductEntries),
    productsHidden
      ? Promise.resolve([])
      : Promise.resolve(editorials.map((ed) => entry(`/products/feature/${ed.slug}`))),
    safely(getStoreEntries),
    safely(getBrandEntries),
    safely(getPrEntries),
    safely(getPopupEntries),
    safely(getMagazineEntries),
  ]);

  return [...staticEntries, ...dynamicEntries.flat()];
}
