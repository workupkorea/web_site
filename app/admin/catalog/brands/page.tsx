"use client";

import AdminTabs from "@/components/admin/AdminTabs";
import BrandsTab from "./_tabs/BrandsTab";
import MegaMenuTab from "./_tabs/MegaMenuTab";

// 브랜드 관리 — 브랜드 통합 관리 / 메가메뉴 설정을 탭으로 묶은 통합 페이지
const TABS = [
  { key: "brands", label: "브랜드 통합 관리", Component: BrandsTab },
  { key: "megamenu", label: "메가메뉴 설정", Component: MegaMenuTab },
] as const;

export default function AdminBrandsPage() {
  return <AdminTabs basePath="/admin/catalog/brands" tabs={TABS} />;
}
