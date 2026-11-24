export type MegaBrandItem = {
  id: string;
  name: string;
  positioning: string;
  descriptionKo: string;
  description: string;
  accentColor: string;
  href: string;
  megaMenuImage: string;
  megaMenuImageX: number; // 0–100  (object-position %)
  megaMenuImageY: number; // 0–100
  megaMenuVisible: boolean;
  brandPageVisible: boolean;
  status: "active" | "inactive";
  sortOrder: number;
};

export type MegaMenuSettings = {
  heading: string;   // e.g. "OUR BRANDS"
  body: string;      // e.g. "모든 워커를 위한\n매일 입는 워크업"
  ctaLabel: string;  // e.g. "브랜드 전체 보기 →"
  ctaUrl: string;    // e.g. "/brands"
  enabled: boolean;
};

export type MegaBrandsConfig = {
  brands: MegaBrandItem[];
  settings: MegaMenuSettings;
};
