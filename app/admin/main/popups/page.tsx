"use client";

import AdminTabs from "@/components/admin/AdminTabs";
import PopupBannerTab from "../_tabs/PopupBannerTab";
import PopupPagesTab from "../_tabs/PopupPagesTab";

// 사이트 관리 › 팝업 관리 — 탭으로 묶은 통합 페이지
const TABS = [
  { key: "banner", label: "팝업 배너", Component: PopupBannerTab },
  { key: "pages", label: "랜딩 페이지", Component: PopupPagesTab },
] as const;

export default function AdminPopupsPage() {
  return <AdminTabs basePath="/admin/main/popups" tabs={TABS} />;
}
