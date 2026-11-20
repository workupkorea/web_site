import type { MateApplication } from "./mate";

export type MateActivityProduct = {
  id: string;
  name: string;
  size_options: string[];
  color_options: string[];
  product_url: string | null;
};

export type MateAdminActivityProduct = MateActivityProduct & {
  source_code: string | null;
  unit_cost: number | null;
};

export type MateProductSelection = {
  product_id: string;
  product_name: string;
  size: string;
  color: string | null;
};

export type MateProductSelectionInput = Omit<MateProductSelection, "product_name">;

export type MateInventoryProduct = {
  id: number;
  product_name: string;
  product_code: string;
  brand: string;
  cost_price: number | null;
  size: string;
  color: string;
  detail_url: string | null;
};
export type MateActivity = {
  round: number;
  activity_no: number;
  product_name: string;
  product_info: string;
  product_url: string | null;
  product_image_version?: string | null;
  size_options?: string[];
  color_options?: string[];
  additional_products?: MateAdminActivityProduct[];
  source_code?: string | null;
  unit_cost?: number | null;
  published: boolean;
};

export type MateActivityProgress = {
  activity_no: number;
  eligible: number;
  joined: number;
  declined: number;
  submitted: number;
};

export const MATE_SHIPPING_COST = 2600;

export function mateActivityCosts(activity: MateActivity, participants: number) {
  const unitCosts = [activity.unit_cost, ...(activity.additional_products ?? []).map((product) => product.unit_cost)];
  const shipping = participants * MATE_SHIPPING_COST;
  const products = participants === 0 ? 0 : unitCosts.every((cost) => typeof cost === "number")
    ? unitCosts.reduce<number>((sum, cost) => sum + (cost ?? 0), 0) * participants
    : null;
  return { products, shipping, total: products === null ? null : products + shipping };
}

export function formatMateWon(value: number | null) {
  return value === null ? "미확정" : value.toLocaleString("ko-KR") + "원";
}

export type MateResponse = {
  round: number;
  activity_no: number;
  application_id: string;
  choice: "yes" | "no";
  size: string | null;
  color?: string | null;
  result_instagram_url?: string | null;
  result_submitted_at?: string | null;
  result_metrics?: MateResultMetrics | null;
  result_metrics_updated_at?: string | null;
  additional_selections?: MateProductSelection[];
  updated_at: string;
};

export const MATE_RESULT_METRICS = { views: "조회수", likes: "좋아요", comments: "댓글" } as const;
export const MATE_RESULT_METRIC_KEYS = Object.keys(MATE_RESULT_METRICS) as (keyof typeof MATE_RESULT_METRICS)[];
export type MateResultMetrics = Record<keyof typeof MATE_RESULT_METRICS, number | null>;
export type MateResultMetricsSummary = { [Key in keyof MateResultMetrics as `${Key}_sum`]: number | null }
  & { [Key in keyof MateResultMetrics as `${Key}_count`]: number };

export type MateProfile = Pick<MateApplication, "name" | "sns_id" | "phone" | "address" | "gender" | "height_cm" | "feed_styles">;

export type MatePortalResponse = Pick<MateResponse, "choice" | "size" | "color" | "result_instagram_url" | "result_submitted_at" | "additional_selections">
  & { updated_at?: string | null };

export type MatePortalHistory = Pick<MateActivity, "activity_no" | "product_name"> & { response: MatePortalResponse };

export type MatePortal = {
  round: number;
  mate_no: string;
  profile: MateProfile;
  history: MatePortalHistory[];
  activities: (Omit<MateActivity, "round" | "published" | "additional_products" | "source_code" | "unit_cost"> & { additional_products?: MateActivityProduct[]; response: MatePortalResponse | null })[];
};

export function validMateProductUrl(value: string) {
  try {
    const url = new URL(value);
    return value.length <= 500 && (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function mateActivityImageHref(round: number, activity: number, version: string) {
  return `/api/mate/activity-image?round=${round}&activity=${activity}&v=${encodeURIComponent(version)}`;
}
export function mateInstagramResultUrl(value: string) {
  try {
    const url = new URL(value);
    if (value.length > 500 || url.protocol !== "https:" || url.username || url.password || url.port
      || !["instagram.com", "www.instagram.com", "m.instagram.com"].includes(url.hostname)
      || !/^\/(p|reel|reels|tv|stories|share|s)\/.+/.test(url.pathname)) return null;
    return url.href;
  } catch {
    return null;
  }
}
const apparelSizes = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL", "7XL", "8XL"];

export function formatMateSize(value: string) {
  const size = value.trim().toUpperCase().replace(/^0+(?=X{0,4}[SL]$|M$|\d+XL$)/, "");
  if (/^\d+(?:\.\d+)?\s*N$/.test(size)) return size.replace(/\s*N$/, "");
  if (/^X{2,4}L$/.test(size)) return size.length - 1 + "XL";
  if (/^0*\d+XL$/.test(size)) return Number.parseInt(size, 10) + "XL";
  return apparelSizes.includes(size) ? size : value.trim();
}

function expandMateSize(value: string) {
  const parts = value.split(/[~～–—-]/);
  if (parts.length !== 2) return [formatMateSize(value)];
  const [first, last] = parts.map(formatMateSize);
  const start = apparelSizes.indexOf(first);
  const end = apparelSizes.indexOf(last);
  if (start >= 0 && end >= start) return apparelSizes.slice(start, end + 1);
  if (/^\d{2}$/.test(first) && /^\d{2}$/.test(last)) {
    const lower = Number(first);
    const upper = Number(last);
    if (lower >= 20 && upper <= 60 && upper >= lower) {
      const step = (upper - lower) % 2 === 0 ? 2 : 1;
      return Array.from({ length: (upper - lower) / step + 1 }, (_, index) => String(lower + index * step));
    }
  }
  return [value.trim()];
}

export function mateSizeLabels(value: string) {
  return [...new Set(value.replace(/\s*([~～–—-])\s*/g, "$1")
    .split(/[\n,/|]+|\s+(?=\d+(?:\.\d+)?N?\b)/i).flatMap(expandMateSize).filter(Boolean))];
}
