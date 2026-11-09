"use client";

import AdminTabs from "@/components/admin/AdminTabs";
import ListTab from "./_tabs/ListTab";
import PageSettingsTab from "./_tabs/PageSettingsTab";
import AnalyticsTab from "./_tabs/AnalyticsTab";

// 스토어 관리 — 매장 목록 / 방문 분석 / 상단 편집을 탭으로 묶은 통합 페이지
const TABS = [
  { key: "list", label: "매장 목록", Component: ListTab },
  { key: "analytics", label: "방문 분석", Component: AnalyticsTab },
  { key: "page-settings", label: "상단 편집", Component: PageSettingsTab },
] as const;

export default function AdminStoresPage() {
  return <AdminTabs basePath="/admin/stores" tabs={TABS} />;
}
