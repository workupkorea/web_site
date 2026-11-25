export const PROMOTION_SETTINGS_PREFIX = "promotion:event:";
export const entriesPath = "/admin/promotions/entries";
export const eventStatuses = { planned: "예정", active: "진행 중", ended: "종료", archived: "보관" } as const;

export type PromotionEvent = {
  id: string;
  name: string;
  status: keyof typeof eventStatuses;
  start: string;
  end: string;
  publicUrl: string;
};

export const goldenbellEvent: PromotionEvent = {
  id: "goldenbell",
  name: "연말연시 골든벨",
  status: "planned",
  start: "2026-12-01",
  end: "2026-12-31",
  publicUrl: "/goldenbell/promo",
};
