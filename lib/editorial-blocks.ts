import { createAdminClient } from "@/lib/supabase-server";
import { editorials } from "@/data/editorial";
import { productDisplayName } from "@/data/products";
import type { Editorial, EditorialSection, EditorialSectionItem, EditorialCardDetail } from "@/data/editorial";

// ── DB 원본 타입 ──────────────────────────────────────────────
export type HeroTag = { id: string; x: number; y: number; pc_x?: number; pc_y?: number; name: string; price: string; product_id: string; image_url: string; bg: string; item_id?: string };
export type ProductItem = { id: string; product_id: string; name: string; price: string; image_url: string; bg: string; card_detail?: EditorialCardDetail };
export type Banner = {
  title: string; desc: string; section_bg: string; image_url: string;
  label?: string;               // 상세페이지 상단 라벨 (배너별 기획전명)
  card_type?: "product" | "image"; // "image" = 통이미지 카드 (제목/설명/썸네일 없이 이미지 한 장)
  link?: string;                // 통이미지 카드 클릭 시 이동할 링크
  items: ProductItem[];
  detail_items?: ProductItem[]; // 상세페이지 전용 추가 상품
  tags?: HeroTag[];
};
export type DBBlock = {
  id: string; sort_order: number; is_visible: boolean; reversed: boolean;
  hero: { title: string; subtitle: string; hero_subtitle: string; desc: string; bg_color: string; image_url: string; image_url_pc?: string; image_position?: string; link: string; tags: HeroTag[] };
  banner1: Banner; banner2: Banner; banner3?: Banner; banner4?: Banner;
};

// ── DB 조회 ───────────────────────────────────────────────────
async function fetchBlocks(): Promise<DBBlock[] | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("site_settings")
      .select("config")
      .eq("section", "editorial_blocks")
      .maybeSingle();

    const raw = data?.config;
    const blockList: DBBlock[] | null =
      Array.isArray(raw) ? raw :
      (raw?.blocks && Array.isArray(raw.blocks)) ? raw.blocks :
      null;
    return blockList && blockList.length > 0 ? blockList : null;
  } catch {
    return null;
  }
}

// ── 매핑 헬퍼 ─────────────────────────────────────────────────
function mapItems(items?: ProductItem[]): EditorialSectionItem[] {
  return (items ?? [])
    .filter((i) => i.product_id || i.name)
    .map((i) => ({
      itemId: i.id,
      productId: i.product_id || "",
      name: i.name || "",
      price: i.price || "",
      bg: i.bg || "#f0f0f0",
      imageUrl: i.image_url || undefined,
      cardDetail: i.card_detail,
    }));
}

function makeSection(banner: Banner | undefined, detailHref?: string): EditorialSection {
  const pad: EditorialSectionItem = { productId: "", name: "", price: "", bg: "#f0f0f0" };
  const items = mapItems(banner?.items);
  while (items.length < 3) items.push(pad);
  const detailItems = mapItems(banner?.detail_items);
  const tags = (banner?.tags ?? [])
    .filter((t) => t.product_id)
    .map((t) => ({ x: t.x, y: t.y, name: t.name || "", price: t.price || "", productId: t.product_id, imageUrl: t.image_url || undefined }));
  return {
    sectionBg: banner?.section_bg || "#303236",
    title: banner?.title || "",
    desc: banner?.desc || "",
    imageUrl: banner?.image_url || undefined,
    cardType: banner?.card_type === "image" ? "image" : "product",
    link: banner?.link || undefined,
    items: [items[0], items[1], items[2]],
    detailItems,
    detailHref,
    tags,
  };
}

// 메인 배너 태그 클릭 이동 주소 — 제품이 들어 있는 첫 배너(1~4)의 상세페이지 + ?product=<id> (그 제품 탭이 열림).
// 상세페이지 링크가 꺼져 있거나 어느 배너에도 없으면 undefined → 제품 상세로 이동.
// 태그는 배너 제품에 연결된다. item_id가 없는 옛 태그는 같은 제품명의 배너 제품을 찾아 연결한다(제품 DB는 쓰지 않음).
function findTagItem(block: DBBlock, t: HeroTag): { item?: ProductItem; n: number } {
  const banners = [block.banner1, block.banner2, block.banner3, block.banner4];
  const all = (b?: Banner) => [...(b?.items ?? []), ...(b?.detail_items ?? [])];
  const norm = (v?: string) => (v ?? "").replace(/\s+/g, "").toLowerCase();
  const matchers: ((i: ProductItem) => boolean)[] = t.item_id
    ? [(i) => i.id === t.item_id]
    : [(i) => !!t.name && norm(i.name) === norm(t.name)];
  for (const m of matchers)
    for (let n = 0; n < banners.length; n++) {
      const item = all(banners[n]).find(m);
      if (item) return { item, n };
    }
  return { n: -1 };
}

function tagHref(block: DBBlock, t: HeroTag, href: (n: number) => string | undefined): string | undefined {
  const { item, n } = findTagItem(block, t);
  const base = item && n >= 0 ? href(n + 1) : undefined;
  return base && item ? `${base}?item=${encodeURIComponent(item.id)}` : undefined;
}

export function blockToEditorial(block: DBBlock): Editorial {
  // 서브배너 1~4 모두 상세페이지 링크 활성
  const href = (n: number) => `/products/feature/${block.id}/${n}`;
  const s1 = makeSection(block.banner1, href(1));
  const s2 = makeSection(block.banner2, href(2));
  const s3 = block.banner3 ? makeSection(block.banner3, href(3)) : s1;
  const s4 = block.banner4 ? makeSection(block.banner4, href(4)) : s2;

  return {
    slug: block.id,
    badge: "",
    title: block.hero?.title || "",
    subtitle: block.hero?.subtitle || "",
    desc: block.hero?.desc || "",
    bg: block.hero?.bg_color || "#303236",
    heroImageUrl: block.hero?.image_url || undefined,
    heroImageUrlPc: block.hero?.image_url_pc || undefined,
    heroImagePosition: block.hero?.image_position || undefined,
    textAccent: "#E5541B",
    heroSubtitle: block.hero?.hero_subtitle || "",
    tags: (block.hero?.tags ?? []).map((t) => {
      // 배너 제품에 연결된 태그는 그 제품의 현재 이름·브랜드(배너에 입력한 값)를 쓴다
      const item = findTagItem(block, t).item;
      return {
        x: t.x, y: t.y, pcX: t.pc_x, pcY: t.pc_y,
        href: tagHref(block, t, href),
        name: item?.name || t.name, price: t.price, productId: t.product_id,
        bg: t.bg || "#303236", imageUrl: t.image_url || undefined,
        itemId: item?.id,
        brand: item?.card_detail?.brand,
      };
    }),
    sections: [s1, s2, s3, s4],
  };
}

// ── 에디토리얼 아이템에 브랜드 접두 채우기 ("[브랜드] 상품명") ──
// 썸네일 상품명 앞에 브랜드명을 노출 — 사이트 전역(productDisplayName)과 동일 규칙.
async function enrichEditorialBrands(
  list: { editorial: Editorial; reversed: boolean }[]
): Promise<{ editorial: Editorial; reversed: boolean }[]> {
  const ids = new Set<string>();
  for (const { editorial } of list)
    for (const s of editorial.sections)
      for (const it of s.items) if (it.productId) ids.add(it.productId);
  // 메인 배너 이미지 위 태그도 브랜드 표시를 위해 함께 조회
  for (const { editorial } of list)
    for (const t of editorial.tags) if (t.productId) ids.add(t.productId);

  const brandMap = await fetchBrandMap([...ids]);
  // 브랜드 로고 — /admin/catalog/brands 에 등록된 brands.logo_url (이름 대소문자 무시 매칭)
  const logoMap = await fetchBrandLogoMap();
  for (const { editorial } of list)
    for (const t of editorial.tags) {
      // 배너 제품(itemId)에 연결된 태그는 배너에 입력한 브랜드를 그대로 쓰고, 옛 태그만 제품 DB 브랜드를 쓴다
      if (!t.itemId) t.brand = brandMap[t.productId]?.brand;
      t.brandLogo = t.brand ? logoMap[brandKey(t.brand)] : undefined;
    }
  for (const { editorial } of list)
    for (const s of editorial.sections)
      for (const it of s.items) {
        if (!it.productId) continue;
        const b = brandMap[it.productId];
        it.displayName = productDisplayName({ name: it.name, brand: b?.brand, hideBrandPrefix: b?.hide });
      }
  return list;
}

// 브랜드명 비교용 키 — 대소문자·공백·특수문자 무시
const brandKey = (n: string) => n.toLowerCase().replace(/[\s.\-_]+/g, "");

async function fetchBrandLogoMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("brands").select("name, name_ko, logo_url");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data ?? []).forEach((r: any) => {
      if (!r.logo_url) return;
      // 영문명·한글명(name_ko) 모두로 찾을 수 있게 등록 — 배너 제품 브랜드는 한글(예: 디트로잇)일 수 있다
      for (const n of [r.name, r.name_ko]) if (n) map[brandKey(String(n))] = r.logo_url;
    });
  } catch {
    // 로고 조회 실패 시 브랜드 텍스트로 대체
  }
  return map;
}

// ── 홈 에디토리얼 목록 ────────────────────────────────────────
export async function getHomeEditorials(): Promise<{ editorial: Editorial; reversed: boolean }[]> {
  const blockList = await fetchBlocks();
  if (blockList) {
    const blocks = blockList
      .filter((b) => b.is_visible !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    if (blocks.length > 0) {
      const list = blocks.map((b) => ({ editorial: blockToEditorial(b), reversed: b.reversed ?? false }));
      return enrichEditorialBrands(list);
    }
  }
  return editorials.map((ed, i) => ({ editorial: ed, reversed: i % 2 === 1 }));
}

// ── 배너별 상세페이지 데이터 ──────────────────────────────────
export type DetailProduct = EditorialSectionItem & { displayName: string };
export type BannerDetail = {
  blockId: string;
  bannerIndex: number;
  editorialTitle: string;      // 상위 기획전(블록) 제목 — 메타용
  label: string;               // 상단 라벨 (배너별 기획전명, 없으면 블록 제목 폴백)
  title: string;
  desc: string;
  imageUrl?: string;           // 배너 섹션 이미지
  bg: string;
  products: DetailProduct[];   // 메인 items + detail_items 합본 (브랜드 접두 포함)
};

// 상품 id → 브랜드 정보 조회 (제품명 앞 "[브랜드]" 접두용)
async function fetchBrandMap(ids: string[]): Promise<Record<string, { brand?: string; hide: boolean }>> {
  const map: Record<string, { brand?: string; hide: boolean }> = {};
  const valid = ids.filter(Boolean);
  if (valid.length === 0) return map;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("products")
      .select("id, brand, hide_brand_prefix")
      .in("id", valid);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data ?? []).forEach((r: any) => {
      map[r.id] = { brand: r.brand ?? undefined, hide: r.hide_brand_prefix ?? false };
    });
  } catch {
    // 조회 실패 시 브랜드 없이 진행
  }
  return map;
}

export async function getBannerDetail(blockId: string, bannerIndex: number): Promise<BannerDetail | null> {
  if (bannerIndex < 1 || bannerIndex > 4) return null;
  const blockList = await fetchBlocks();
  if (!blockList) return null;
  const block = blockList.find((b) => b.id === blockId);
  if (!block || block.is_visible === false) return null;

  const banner = [block.banner1, block.banner2, block.banner3, block.banner4][bannerIndex - 1];
  if (!banner) return null;

  const merged = [...mapItems(banner.items), ...mapItems(banner.detail_items)]
    // 중복 상품(productId 기준) 제거 — 메인/추가에 같은 상품이 들어간 경우
    .filter((p, i, arr) => !p.productId || arr.findIndex((q) => q.productId === p.productId) === i);

  // 브랜드 접두명 구성 — 제품 DB에서 brand/hide_brand_prefix 조회
  const brandMap = await fetchBrandMap(merged.map((p) => p.productId));
  const products: DetailProduct[] = merged.map((p) => {
    const b = brandMap[p.productId];
    return { ...p, displayName: productDisplayName({ name: p.name, brand: b?.brand, hideBrandPrefix: b?.hide }) };
  });

  return {
    blockId: block.id,
    bannerIndex,
    editorialTitle: block.hero?.title || "",
    label: banner.label?.trim() || block.hero?.title || "",
    title: banner.title || "",
    desc: banner.desc || "",
    imageUrl: banner.image_url || undefined,
    bg: banner.section_bg || "#303236",
    products,
  };
}
