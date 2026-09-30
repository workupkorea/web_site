import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { BRANDS } from "@/lib/brands-data";
import { createAdminClient } from "@/lib/supabase-server";
import { brandSlug } from "@/lib/brandCatalog-server";
import type { Brand } from "@/data/brands";
import BrandsPageClient from "@/components/BrandsPageClient";

export const metadata: Metadata = {
  title: "브랜드 카탈로그",
  description: "WORKUP K-WORKER STORE 입점 브랜드 카탈로그를 한눈에 확인하세요.",
};

export type BrandItem = {
  id: string;
  name: string;
  positioning: string;
  descriptionKo: string;
  description: string;
  href: string;              // 카드 클릭 시 이동 (조립형 카탈로그 있으면 플립북, 없으면 브랜드 허브)
  accentColor: string;
  heroImage: string;
  imageBg: string;
  hasCatalog: boolean;
};

async function getBrandsData(): Promise<BrandItem[]> {
  noStore();
  try {
    const supabase = createAdminClient();
    const [{ data: dbBrands }, { data: catalogs }, { data: asmItems }] = await Promise.all([
      supabase.from("brands").select("id, name, name_ko, positioning, description, accent_color, image_bg, mega_menu_image, is_visible, catalog_enabled, catalog_cover_url").order("sort_order", { ascending: true }).order("name", { ascending: true }),
      supabase.from("brand_catalogs").select("brand_name").eq("is_visible", true),
      supabase.from("catalog_pages").select("brand_id").eq("is_visible", true).neq("brand_id", ""),
    ]);

    // 이름 표기 차이(예: "MAD DOG" vs "MADDOG")를 흡수하는 정규화 키
    const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");

    const catalogNames = new Set(
      (catalogs ?? []).map((c: { brand_name: string }) => norm(c.brand_name))
    );
    // 조립형 카탈로그(공개 + 노출 제품 1개 이상)를 가진 브랜드 id
    const asmBrandIds = new Set(
      ((asmItems as { brand_id: unknown }[]) ?? []).map((r) => String(r.brand_id))
    );
    const hasAssembled = (db: Brand | null | undefined) =>
      !!db && db.catalog_enabled === true && asmBrandIds.has(String(db.id));
    const findDb = (name: string) =>
      (dbBrands ?? []).find((d: Brand) => norm(d.name) === norm(name)) ?? null;

    // 정적 BRANDS → 매칭되는 DB 레코드가 is_visible=false면 제외
    const staticVisible = BRANDS.filter((b) => {
      const db = findDb(b.name);
      return !db || db.is_visible !== false;
    });

    // DB 전용 브랜드: 정적 BRANDS와 정규화 이름이 겹치지 않고 is_visible=false가 아닌 것
    const staticNorm = new Set(BRANDS.map((b) => norm(b.name)));
    const dbOnlyVisible = (dbBrands ?? []).filter(
      (d: Brand) => !staticNorm.has(norm(d.name)) && d.is_visible !== false
    );

    // 정적 브랜드 → BrandItem 변환
    const staticItems: BrandItem[] = staticVisible.map((b) => {
      const db = findDb(b.name);
      const bgValue = db?.image_bg || b.imageBg || "";
      // 카드 이미지: 목록 카드 전용 이미지(catalog_cover_url) 우선 → 메가메뉴 이미지 → 배경 URL
      const heroImage = db?.catalog_cover_url || db?.mega_menu_image || (bgValue.startsWith("http") ? bgValue : "") || "";
      return {
        id: b.id,
        name: db?.name || b.name,
        // DB 레코드가 있으면 그 값이 유일한 소스 — 관리자가 비운 항목은 화면에서도 비운다
        // (정적 하드코딩(lib/brands-data) 폴백을 쓰지 않는다)
        positioning: db ? (db.positioning ?? "") : b.positioning,
        descriptionKo: db ? (db.name_ko ?? "") : b.descriptionKo,
        description: db ? (db.description ?? "") : b.description,
        // 조립형 카탈로그가 있으면 카드 클릭 시 플립북으로 바로 이동 (브릿지 페이지 생략)
        href: hasAssembled(db) ? `${b.href}/catalog` : b.href,
        accentColor: db?.accent_color || b.accentColor,
        heroImage,
        imageBg: heroImage ? "" : bgValue,
        hasCatalog: catalogNames.has(norm(b.name)) || hasAssembled(db),
      };
    });

    // DB 전용 브랜드 → BrandItem 변환
    const dbOnlyItems: BrandItem[] = dbOnlyVisible.map((d: Brand) => {
      const bgValue = d.image_bg || "";
      const heroImage = d.catalog_cover_url || d.mega_menu_image || (bgValue.startsWith("http") ? bgValue : "") || "";
      const catalog = catalogNames.has(norm(d.name)) || hasAssembled(d);
      return {
        id: String(d.id),
        name: d.name,
        positioning: d.positioning || "",
        descriptionKo: d.name_ko || "",
        description: d.description || "",
        href: hasAssembled(d) ? `/brands/${brandSlug(d.name)}/catalog` : `/brands/${brandSlug(d.name)}`,
        accentColor: d.accent_color || "#333333",
        heroImage,
        imageBg: heroImage ? "" : bgValue,
        hasCatalog: catalog,
      };
    });

    const allItems = [...staticItems, ...dbOnlyItems];

    // 정렬: 카탈로그 있는 브랜드 먼저, 각 그룹 내 가나다순
    allItems.sort((a, b) => {
      if (a.hasCatalog !== b.hasCatalog) return a.hasCatalog ? -1 : 1;
      const aKo = (a.descriptionKo || a.name).toLowerCase();
      const bKo = (b.descriptionKo || b.name).toLowerCase();
      return aKo.localeCompare(bKo, "ko");
    });

    return allItems;
  } catch {
    // DB 조회 실패 시 최소 정보만 (브랜드명·이동경로). 설명 문구는 DB가 유일한 소스라 비운다.
    return BRANDS.map((b) => ({
      id: b.id,
      name: b.name,
      positioning: "",
      descriptionKo: "",
      description: "",
      href: b.href,
      accentColor: b.accentColor,
      heroImage: "",
      imageBg: b.imageBg,
      hasCatalog: false,
    }));
  }
}

export default async function BrandsPage() {
  const brands = await getBrandsData();
  return (
    <main className="min-h-screen bg-white">
      {/* 헤더 히어로 */}
      <section className="relative bg-gray-900 overflow-hidden">
        <div className="max-w-screen-xl mx-auto px-6 md:px-10 py-8 md:py-10">
          <p className="text-[10px] tracking-[0.3em] text-[#E5541B] uppercase font-bold mb-2">K-WORKER STORE</p>
          <h1 className="text-2xl md:text-3xl font-black text-white leading-tight">
            <span className="text-[#E5541B]">WORKUP</span>이 선택한 좋은 브랜드들
          </h1>
        </div>
      </section>

      {/* 브랜드 그리드 (클라이언트: 탭 필터) */}
      <BrandsPageClient brands={brands} />
    </main>
  );
}
