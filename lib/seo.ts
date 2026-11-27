// 공개 페이지 공통 SEO 생성 함수.
// Next.js 메타데이터는 얕게 병합돼 openGraph·twitter를 페이지에서 지정하면 루트 값이 통째로 교체되고,
// 지정하지 않으면 홈의 og:title이 하위 페이지에 그대로 노출된다. 그래서 한 곳에서 전부 채운다.
import type { Metadata } from "next";

export const SITE_NAME = "워크업 WORKUP";
const TITLE_SEPARATOR = "｜"; // app/layout.tsx 의 title.template 과 동일해야 한다
const DEFAULT_OG_IMAGE = "/og-image.jpg";
const DESCRIPTION_MAX = 155;

type PageMetaInput = {
  title: string;
  description: string;
  /** canonical·og:url 이 되는 사이트 내 경로 */
  path: string;
  image?: string | null;
  /** true 면 "｜워크업 WORKUP" 접미사를 붙이지 않는다 */
  absoluteTitle?: boolean;
  noindex?: boolean;
  type?: "website" | "article";
};

export function trimDescription(text: string): string {
  const flat = text.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return flat.length > DESCRIPTION_MAX ? `${flat.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…` : flat;
}

export function pageMetadata(input: PageMetaInput): Metadata {
  const { title, path, image, absoluteTitle, noindex, type = "website" } = input;
  const description = trimDescription(input.description);
  const fullTitle = absoluteTitle ? title : `${title}${TITLE_SEPARATOR}${SITE_NAME}`;
  const images = [image || DEFAULT_OG_IMAGE];

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { type, siteName: SITE_NAME, locale: "ko_KR", title: fullTitle, description, url: path, images },
    twitter: { card: "summary_large_image", title: fullTitle, description, images },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

export function breadcrumbLd(items: { name: string; url?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      ...(item.url ? { item: item.url } : {}),
    })),
  };
}

// ── 매장 ─────────────────────────────────────────────────────────────────────

/** "경기도 포천시 호국로 90" + 지역 "경기" → "경기 포천시". 시·군·구를 못 찾으면 지역명만. */
export function storeArea(region: string | null | undefined, address: string | null | undefined): string {
  const district = (address ?? "").trim().split(/\s+/).slice(1, 3).find((t) => /^[가-힣]+(시|군|구)$/.test(t));
  return [region?.trim(), district].filter(Boolean).join(" ");
}

const DAY_GROUPS: Record<string, string[]> = {
  매일: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  평일: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  주말: ["Saturday", "Sunday"],
};

/**
 * "10:30 - 20:30 (평일) / 10:00 - 21:00 (주말)" → OpeningHoursSpecification[].
 * 한 구간이라도 해석하지 못하면 undefined — 추측한 영업시간은 내보내지 않는다.
 */
export function openingHoursSpec(hours: string | null | undefined) {
  if (!hours?.trim()) return undefined;
  const specs = hours.split("/").map((part) => {
    const m = part.trim().match(/^(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})\s*\((매일|평일|주말)\)$/);
    if (!m) return null;
    const [, opens, closes, group] = m;
    return {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: DAY_GROUPS[group],
      opens: opens.padStart(5, "0"),
      closes: closes.padStart(5, "0"),
    };
  });
  return specs.every(Boolean) ? specs : undefined;
}
