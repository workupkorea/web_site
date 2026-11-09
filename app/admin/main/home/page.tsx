"use client";

import AdminTabs from "@/components/admin/AdminTabs";
import SectionsTab from "../_tabs/SectionsTab";
import VisualTab from "../_tabs/VisualTab";
import NewArrivalsTab from "../_tabs/NewArrivalsTab";
import EditorialTab from "../_tabs/EditorialTab";
import BrandsMarqueeTab from "../_tabs/BrandsMarqueeTab";

// 사이트 관리 › 메인 관리 — 탭으로 묶은 통합 페이지
const TABS = [
  { key: "sections", label: "메인 배치", Component: SectionsTab },
  { key: "visual", label: "슬라이딩", Component: VisualTab },
  { key: "new-arrivals", label: "신상품", Component: NewArrivalsTab },
  { key: "editorial", label: "기획전", Component: EditorialTab },
  { key: "brands", label: "로고 마퀴", Component: BrandsMarqueeTab },
] as const;

export default function AdminHomePage() {
  return <AdminTabs basePath="/admin/main/home" tabs={TABS} />;
}
