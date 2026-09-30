import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { products as staticProducts, getProductById, productDisplayName, isPubliclyVisible, type Product } from "@/data/products";
import { createAdminClient, mapFromDb } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";
import ProductDetailClient from "@/components/ProductDetailClient";
import ProductBreadcrumb from "@/components/ProductBreadcrumb";
import ProductImageGallery from "@/components/ProductImageGallery";
import ProductTabs from "@/components/ProductTabs";
import StickyAside from "@/components/StickyAside";
import MobileProductNav from "@/components/MobileProductNav";
import InstagramFeed from "@/components/InstagramFeed";
import JsonLd from "@/components/JsonLd";
import { absoluteUrl } from "@/lib/site";
import { getHeaderNavConfig } from "@/lib/header-nav-server";

type Props = { params: Promise<{ id: string }> };

export const revalidate = 0;

export async function generateStaticParams() {
  return staticProducts.map((p) => ({ id: p.id }));
}

// DB 스키마엔 없는 리치 상세 필드 — static(data/products.ts)에서 오버레이로 보강
const RICH_FIELDS = [
  "coreValues", "recommendedFor", "keyFeatures", "sizeRecs", "fitNote",
  "materialSpecs", "washCare", "productReviews", "detailPoints", "lifestyleScenes", "sizePrices",
] as const;

function withRichOverlay(base: Product, id: string): Product {
  const staticP = getProductById(id);
  if (!staticP) return base;
  const s = staticP as unknown as Record<string, unknown>;
  const merged = { ...base } as unknown as Record<string, unknown>;
  for (const f of RICH_FIELDS) {
    const sv = s[f];
    const bv = merged[f];
    const bvEmpty = bv === undefined || bv === null || (Array.isArray(bv) && bv.length === 0);
    if (sv !== undefined && bvEmpty) merged[f] = sv;
  }
  return merged as unknown as Product;
}

async function fetchProduct(id: string) {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("products").select("*").eq("id", id).single();
    if (data) return withRichOverlay(mapFromDb(data), id);
  } catch {}
  return getProductById(id);
}

async function fetchRelatedProducts(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("products").select("*").in("id", ids);
    if (data?.length) return data.map(mapFromDb).filter(isPubliclyVisible);
  } catch {}
  return (ids.map((id) => getProductById(id)).filter(Boolean) as Product[]).filter(isPubliclyVisible);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [product, nav] = await Promise.all([fetchProduct(id), getHeaderNavConfig()]);
  if (!product) return { title: "제품을 찾을 수 없습니다" };

  const productsNav = nav.items.find((it) => it.href === "/products");
  const isHidden = productsNav ? productsNav.isVisible === false : false;

  // 관리자가 지정한 metaTitle/metaDesc 우선, 없으면 제품명·태그라인으로 자동 생성
  const title = product.metaTitle?.trim() || `${product.name} — WORKUP ${product.line}`;
  const description = product.metaDesc?.trim() || product.tagline;
  const ogImage = absoluteUrl(product.imageUrl);
  return {
    title,
    description,
    // 표준 URL 명시 — 같은 상품이 다른 쿼리스트링으로 접근돼도 구글이 이 URL을 정본으로 보게 함
    alternates: { canonical: `/products/${id}` },
    // 카톡·SNS 공유 시 제품 대표 이미지가 미리보기로 노출되도록 OG 이미지 지정
    openGraph: {
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    // 관리자에서 제품 메뉴 비공개 처리 시 개별 상품 페이지도 인덱싱 차단
    ...(isHidden && { robots: { index: false, follow: false } }),
  };
}

const SIZE_GUIDE = [
  { size: "S",   chest: "88-92",   waist: "72-76", hip: "90-94" },
  { size: "M",   chest: "92-96",   waist: "76-80", hip: "94-98" },
  { size: "L",   chest: "96-100",  waist: "80-84", hip: "98-102" },
  { size: "XL",  chest: "100-104", waist: "84-88", hip: "102-106" },
  { size: "2XL", chest: "104-108", waist: "88-92", hip: "106-110" },
];

const WASH_ICON_MAP: Record<string, string> = {
  "cold": "🌡️",
  "no-dry": "🚫",
  "no-bleach": "🚫",
  "low-iron": "♨️",
  "hand-wash": "🤲",
};

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;
  const product = await fetchProduct(id);
  if (!product) notFound();
  // 판매중지·진열대기 상품은 고객 노출 금지 — 단, 관리자는 등록 전 미리보기가 필요해 예외로 허용
  const isPreview = !isPubliclyVisible(product);
  const admin = isPreview ? await isAdmin() : false;
  if (isPreview && !admin) notFound();

  const relatedProducts = await fetchRelatedProducts(product.relatedIds ?? []);
  const isNewLayout = !!(product.keyFeatures && product.keyFeatures.length > 0);
  // 제품에 카테고리가 여러 개 등록된 경우(멀티 카테고리) 전부 breadcrumb에서 펼쳐볼 수 있도록 전달
  const productCats: { main: string; sub: string }[] = product.categories?.length
    ? product.categories
    : product.category ? [{ main: product.category, sub: product.subCategory ?? "" }] : [];

  // 검색엔진 구조화 데이터(Product). 제품명·이미지·브랜드·카테고리로
  // "지역명+제품명" 검색 이해도를 높인다.
  // offers.availability는 InStoreOnly — 온라인 구매가 아닌 매장 방문 유도형
  // 카탈로그라는 사실을 구글에 정확히 알리기 위한 값 (구매 버튼/결제는 추가하지 않음).
  const numericPrice = Number((product.price || "").replace(/[^0-9]/g, ""));
  const images = [product.imageUrl, ...(product.subImages ?? [])]
    .map((u) => absoluteUrl(u))
    .filter(Boolean);

  const productLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: productDisplayName(product),
    description: product.metaDesc?.trim() || product.tagline,
    // Google Rich Results 필수 필드: 최소 1개 이미지 URL 필수
    ...(images.length > 0 ? { image: images } : {}),
    brand: { "@type": "Brand", name: product.brand || "WORKUP" },
    // category 필드: 필수 (Google 권장). 없으면 기본값 지정
    ...(product.category ? { category: product.category } : { category: "의류" }),
    sku: product.sku || product.id,
    url: absoluteUrl(`/products/${product.id}`),
    ...(product.manufacturer
      ? { manufacturer: { "@type": "Organization", name: product.manufacturer } }
      : {}),
    ...(numericPrice > 0
      ? {
          offers: {
            "@type": "Offer",
            price: numericPrice,
            priceCurrency: "KRW",
            availability: "https://schema.org/InStoreOnly",
            itemCondition: "https://schema.org/NewCondition",
            url: absoluteUrl(`/products/${product.id}`),
            seller: { "@type": "Organization", name: product.brand || "WORKUP" },
            // Google 권장: 반품 정책 (InStoreOnly 카탈로그용 기본 정책)
            hasMerchantReturnPolicy: {
              "@type": "MerchantReturnPolicy",
              applicableCountry: "KR",
              returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
              merchantReturnDays: 14,
              returnMethod: "https://schema.org/ReturnInStore",
            },
            // Google 권장: 배송 정보 (InStoreOnly 카탈로그용)
            shippingDetails: {
              "@type": "ShippingDeliveryTime",
              shippingDestination: {
                "@type": "DeliveryAddress",
                addressCountry: "KR",
              },
              shippingLabel: "매장 방문 체험",
              transitTime: {
                "@type": "QuantitativeValue",
                unitCode: "DAY",
                value: 0,
              },
            },
          },
        }
      : {}),
  };

  return (
    <main className={`bg-white min-h-screen${isNewLayout ? " pb-20 md:pb-0" : ""}`}>
      {isPreview && (
        <div className="bg-amber-400 text-[#303236] text-center text-xs md:text-sm font-bold py-2 px-4 sticky top-0 z-[60]">
          미리보기 모드 — 이 상품은 &quot;{product.status ?? "진열대기"}&quot; 상태라 고객에게는 보이지 않습니다.
        </div>
      )}
      <JsonLd data={productLd} />

      {/* 모바일 네비 */}
      <MobileProductNav />

      {/* 데스크탑 브레드크럼 — 카테고리가 여러 개면 펼쳐서 전부 볼 수 있음 (제품명은 표시하지 않음) */}
      <div className="hidden md:block border-b border-gray-100">
        <ProductBreadcrumb cats={productCats} />
      </div>

      {/* 갤러리(+데스크탑 상세 탭) 좌측 스크롤 / 정보·배너 우측 고정 */}
      <div className="md:flex md:items-start max-w-screen-2xl mx-auto">
        {/* 좌측: 갤러리 + 상세 탭(데스크탑) — 함께 스크롤 */}
        <div className="w-full md:w-[58%] lg:w-[62%]">
          <ProductImageGallery product={product} />
          {!isNewLayout && (
            <div className="hidden md:block mt-[210px]">
              <ProductTabs product={product} />
            </div>
          )}
        </div>
        {/* 우측: 정보 + 배너 — 끝(마지막 배너)까지 스크롤 후 고정 */}
        <StickyAside className="w-full md:w-[42%] lg:w-[38%]">
          <ProductDetailClient product={product} relatedProducts={relatedProducts} isNewLayout={isNewLayout} />
        </StickyAside>
      </div>

      {/* 모바일: 상세 탭을 정보 패널 아래에 (구 레이아웃) */}
      {!isNewLayout && (
        <div className="md:hidden">
          <ProductTabs product={product} />
        </div>
      )}

      {/* === 신규 레이아웃 10섹션 === */}
      {isNewLayout && (
        <>
          {/* 인스타 피드 — 신규 레이아웃은 탭이 없으므로 상세 섹션 시작 전에 노출 */}
          <InstagramFeed posts={product.instagramPosts} contained />

          {/* S2: 이런 분께 추천합니다 */}
          {product.recommendedFor && product.recommendedFor.length > 0 && (
            <section className="border-t border-gray-100 py-16 md:py-20 bg-[#fafafa]">
              <div className="max-w-screen-xl mx-auto px-6 md:px-12">
                <p className="text-[11px] tracking-[0.2em] text-[#E5541B] uppercase mb-3">RECOMMENDED FOR</p>
                <h2 className="text-xl md:text-2xl font-bold text-[#303236] mb-8">이런 분께 추천합니다</h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                  {product.recommendedFor.map((item) => (
                    <li key={item} className="flex items-start gap-3 bg-white border border-gray-100 px-5 py-4">
                      <span className="text-[#E5541B] font-bold text-base flex-shrink-0 mt-0.5">✓</span>
                      <span className="text-sm text-[#303236] leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* S3: 핵심 기능 */}
          {product.keyFeatures && product.keyFeatures.length > 0 && (
            <section className="border-t border-gray-100 py-16 md:py-20">
              <div className="max-w-screen-xl mx-auto px-6 md:px-12">
                <p className="text-[11px] tracking-[0.2em] text-[#E5541B] uppercase mb-3">KEY FEATURES</p>
                <h2 className="text-xl md:text-2xl font-bold text-[#303236] mb-8">핵심 기능</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl">
                  {product.keyFeatures.map((feat, i) => (
                    <div key={feat.title} className="flex gap-5 items-start">
                      <div className="w-8 h-8 bg-[#303236] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#303236] mb-1">{feat.title}</p>
                        <p className="text-xs text-gray-500 leading-relaxed">{feat.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* S4: 디테일 포인트 */}
          {product.detailPoints && product.detailPoints.length > 0 && (
            <section className="border-t border-gray-100 py-16 md:py-20 bg-gray-50">
              <div className="max-w-screen-xl mx-auto px-6 md:px-12">
                <p className="text-[11px] tracking-[0.2em] text-[#E5541B] uppercase mb-3">DETAIL</p>
                <h2 className="text-xl md:text-2xl font-bold text-[#303236] mb-8">디테일 포인트</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {product.detailPoints.map((label) => (
                    <div key={label} className="aspect-square bg-[#303236] flex items-end p-4">
                      <span className="text-xs text-white/80 font-medium">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* S5: 라이프스타일 착용 씬 */}
          {product.lifestyleScenes && product.lifestyleScenes.length > 0 && (
            <section className="border-t border-gray-100 py-16 md:py-20">
              <div className="max-w-screen-xl mx-auto px-6 md:px-12">
                <p className="text-[11px] tracking-[0.2em] text-[#E5541B] uppercase mb-3">LIFESTYLE</p>
                <h2 className="text-xl md:text-2xl font-bold text-[#303236] mb-8">이렇게 활용하세요</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {product.lifestyleScenes.map((scene, i) => (
                    <div key={scene.tag} className={`${i % 2 === 0 ? "bg-[#303236]" : "bg-gray-100"} p-8 md:p-12 flex flex-col justify-end min-h-[240px]`}>
                      <p className="text-[10px] tracking-[0.3em] text-[#E5541B] uppercase mb-2">{scene.tag}</p>
                      <p className={`text-lg font-bold mb-1 ${i % 2 === 0 ? "text-white" : "text-[#303236]"}`}>{scene.title}</p>
                      <p className={`text-sm leading-relaxed ${i % 2 === 0 ? "text-gray-300" : "text-gray-500"}`}>{scene.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* S6: 사이즈 가이드 (신체 치수 기반) */}
          <section className="border-t border-gray-100 py-16 md:py-20 bg-[#fafafa]">
            <div className="max-w-screen-xl mx-auto px-6 md:px-12">
              <p className="text-[11px] tracking-[0.2em] text-[#E5541B] uppercase mb-3">SIZE GUIDE</p>
              <h2 className="text-xl md:text-2xl font-bold text-[#303236] mb-2">사이즈 가이드</h2>
              {product.fitNote && (
                <p className="text-xs text-gray-400 mb-6">{product.fitNote}</p>
              )}
              {product.sizePrices && product.sizePrices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[360px] max-w-xl text-sm">
                    <thead>
                      <tr className="bg-[#303236] text-white">
                        {["사이즈", "적용 체중", "판매가"].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {product.sizePrices.map((row, i) => (
                        <tr key={row.size} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-5 py-3 font-bold text-[#303236] text-xs">{row.size}</td>
                          <td className="px-5 py-3 text-gray-500 text-xs">{row.weight ?? "-"}</td>
                          <td className="px-5 py-3 text-[#E5541B] font-semibold text-xs">{row.price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : product.sizeRecs && product.sizeRecs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[360px] max-w-xl text-sm">
                    <thead>
                      <tr className="bg-[#303236] text-white">
                        {["사이즈", "키 (cm)", "몸무게 (kg)"].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {product.sizeRecs.map((row, i) => (
                        <tr key={row.size} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-5 py-3 font-bold text-[#303236] text-xs">{row.size}</td>
                          <td className="px-5 py-3 text-gray-500 text-xs">{row.height}</td>
                          <td className="px-5 py-3 text-gray-500 text-xs">{row.weight}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[320px] max-w-lg text-sm">
                    <thead>
                      <tr className="bg-[#303236] text-white">
                        {["사이즈", "가슴둘레", "허리둘레", "엉덩이둘레"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {SIZE_GUIDE.map((row, i) => (
                        <tr key={row.size} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-4 py-3 font-bold text-[#303236] text-xs">{row.size}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{row.chest}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{row.waist}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{row.hip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-4">* 사이즈가 고민된다면 매장에서 직접 입어보세요.</p>
            </div>
          </section>

          {/* S7: 소재 & 스펙 */}
          {product.materialSpecs && product.materialSpecs.length > 0 && (
            <section className="border-t border-gray-100 py-16 md:py-20">
              <div className="max-w-screen-xl mx-auto px-6 md:px-12">
                <p className="text-[11px] tracking-[0.2em] text-[#E5541B] uppercase mb-3">MATERIAL & SPECS</p>
                <h2 className="text-xl md:text-2xl font-bold text-[#303236] mb-8">소재 및 스펙</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 max-w-2xl">
                  {product.materialSpecs.map((spec, i) => (
                    <div key={spec.label} className={`flex gap-6 py-4 border-b border-gray-100 ${i % 2 === 0 ? "sm:pr-12" : ""}`}>
                      <span className="text-[12px] text-gray-400 w-16 flex-shrink-0">{spec.label}</span>
                      <span className="text-[13px] text-[#303236] font-medium">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* S8: 세탁 방법 */}
          {product.washCare && product.washCare.length > 0 && (
            <section className="border-t border-gray-100 py-16 md:py-20 bg-[#fafafa]">
              <div className="max-w-screen-xl mx-auto px-6 md:px-12">
                <p className="text-[11px] tracking-[0.2em] text-[#E5541B] uppercase mb-3">CARE</p>
                <h2 className="text-xl md:text-2xl font-bold text-[#303236] mb-8">세탁 및 관리</h2>
                <div className="flex flex-wrap gap-6 max-w-2xl">
                  {product.washCare.map((care) => (
                    <div key={care.icon} className="flex flex-col items-center gap-2 w-20 text-center">
                      <div className="w-14 h-14 border-2 border-[#303236] flex items-center justify-center text-2xl">
                        {WASH_ICON_MAP[care.icon] ?? "○"}
                      </div>
                      <p className="text-[10px] text-gray-500 leading-tight">{care.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* S9: 실제 리뷰 */}
          {product.productReviews && product.productReviews.length > 0 && (
            <section className="border-t border-gray-100 py-16 md:py-20">
              <div className="max-w-screen-xl mx-auto px-6 md:px-12">
                <p className="text-[11px] tracking-[0.2em] text-[#E5541B] uppercase mb-3">REVIEWS</p>
                <h2 className="text-xl md:text-2xl font-bold text-[#303236] mb-8">실제 사용 후기</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {product.productReviews.map((review, i) => (
                    <div key={i} className="border border-gray-100 p-6 bg-white">
                      <div className="flex gap-0.5 mb-3">
                        {Array.from({ length: 5 }).map((_, si) => (
                          <span key={si} className={`text-sm ${si < review.stars ? "text-[#E5541B]" : "text-gray-200"}`}>★</span>
                        ))}
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed mb-4">&ldquo;{review.text}&rdquo;</p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-[#303236]">{review.job}</p>
                        {review.period && <p className="text-[10px] text-gray-400">{review.period}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* S10: 최종 CTA — 매장 방문 유도 */}
          <section className="bg-[#303236] py-16 md:py-24">
            <div className="max-w-screen-xl mx-auto px-6 md:px-12 text-center">
              <p className="text-[11px] tracking-[0.3em] text-[#E5541B] uppercase mb-5">VISIT US</p>
              <h2 className="text-2xl md:text-4xl font-bold text-white mb-4 leading-snug">
                직접 입어봐야<br className="sm:hidden" /> 알 수 있습니다
              </h2>
              <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-10">
                사진으로는 느낄 수 없는 착용감, 소재감, 핏을<br />
                가까운 매장에서 직접 확인하세요.
              </p>
              <Link href="/store"
                className="inline-block bg-[#E5541B] text-white font-bold px-12 py-4 text-sm tracking-widest hover:bg-[#e04a0a] transition-colors">
                가까운 매장 찾기
              </Link>
            </div>
          </section>
        </>
      )}

      {/* 모바일 하단 고정 CTA바 — 신규 레이아웃 / 매장 찾기만 */}
      {isNewLayout && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#303236]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <Link href="/store"
            className="w-full bg-[#303236] text-white text-sm font-bold py-4 flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            매장 찾기
          </Link>
        </div>
      )}

    </main>
  );
}
