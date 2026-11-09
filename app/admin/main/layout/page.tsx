"use client";

import AdminTabs from "@/components/admin/AdminTabs";
import LogoTab from "../_tabs/LogoTab";
import MenuTab from "../_tabs/MenuTab";
import TopbarTab from "../_tabs/TopbarTab";
import FooterTab from "../_tabs/FooterTab";

// 사이트 관리 › 레이아웃 — 탭으로 묶은 통합 페이지
const TABS = [
  { key: "logo", label: "로고관리", Component: LogoTab },
  { key: "menu", label: "헤더메뉴", Component: MenuTab },
  { key: "topbar", label: "탑바", Component: TopbarTab },
  { key: "footer", label: "푸터·약관", Component: FooterTab },
] as const;

export default function AdminLayoutPage() {
  return <AdminTabs basePath="/admin/main/layout" tabs={TABS} />;
}
