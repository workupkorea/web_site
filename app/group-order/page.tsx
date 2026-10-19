import type { Metadata } from "next";
import GroupOrderPage, { type GroupProduct, type Industry } from "./GroupOrderPage";
import { createAdminClient } from "@/lib/supabase-server";
import { isPubliclyVisible } from "@/data/products";

// 공개 카탈로그에 등록된 상품만 참고 상품으로 보여준다. 단체 공급 가능 여부는 상담에서 확인한다.
const productIds: Record<Industry, string[]> = {
  site: [
    "d14cc2a4d2b8", // 작업조끼
    "d3ecd2c0b79cb4dc-c6ccd06cd32cce20", // 포틀랜드 워크팬츠
    "ba40d2f0c274b4dc-d3f4b85cd2f0", // 멀티쉴드 폴로티
  ],
  logistics: [
    "ba54c26c-ba40d2f0d3eccf13-c870b07c", // 메쉬 멀티포켓 조끼
    "d2b8b9accf54d2b8-cfe8b9c1-b871-c2acb9acbe0c-d3f4b85cd2f0", // 트리코트 쿨링 폴로티
    "c194b9acb4dc-c708b4dcc790cf13", // 솔리드 윈드자켓
  ],
  service: [
    "b4dcb77cc774d54f-ce74b77c-d2f0c154ce20", // 드라이핏 카라 티셔츠
    "c6b0ba3cc2a4-d06cb86d-b85cace0-d2f0", // 우먼스 크롭 워크 셔츠
    "c720d2f8b9acd2f0-c154ce20", // 유틸리티 셔츠
  ],
};

export const metadata: Metadata = {
  title: "단체복·대량구매 상담",
  description: "WORKUP 단체복과 대량구매. 일하는 환경에 맞는 제품을 살펴보고 수량, 로고 작업, 납품 일정을 상담해 보세요.",
  // 로컬 검토 단계. 정식 공개 시 검색 노출과 사이트맵 등록을 함께 결정한다.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

async function getGroupProducts(): Promise<Record<Industry, GroupProduct[]>> {
  const empty: Record<Industry, GroupProduct[]> = { site: [], logistics: [], service: [] };
  try {
    const ids = [...new Set(Object.values(productIds).flat())];
    const { data, error } = await createAdminClient()
      .from("products")
      .select("id, name, price, image_url, status")
      .in("id", ids);
    if (error) throw error;
    const products = new Map(
      (data ?? [])
        .filter((row) => row.image_url && isPubliclyVisible({ status: row.status ?? undefined }))
        .map((row) => [row.id, {
          id: row.id as string,
          name: row.name as string,
          price: (row.price ?? "") as string,
          imageUrl: row.image_url as string,
        } satisfies GroupProduct]),
    );
    return {
      site: productIds.site.flatMap((id) => products.has(id) ? [products.get(id)!] : []),
      logistics: productIds.logistics.flatMap((id) => products.has(id) ? [products.get(id)!] : []),
      service: productIds.service.flatMap((id) => products.has(id) ? [products.get(id)!] : []),
    };
  } catch (error) {
    console.error("[group-order] 참고 상품 조회 실패:", error);
    return empty;
  }
}

export default async function Page() {
  return <GroupOrderPage products={await getGroupProducts()} />;
}
