"use client";

import AdminTabs from "@/components/admin/AdminTabs";
import VercelTab from "./_tabs/VercelTab";
import DbStatusTab from "./_tabs/DbStatusTab";
import FixLogTab from "./_tabs/FixLogTab";

// 시스템 관리 — Vercel 상태 / DB 상태 / 오류 수정 내역을 탭으로 묶은 통합 페이지
const TABS = [
  { key: "vercel", label: "Vercel 상태", Component: VercelTab },
  { key: "db-status", label: "DB 상태", Component: DbStatusTab },
  { key: "fix-log", label: "오류 수정 내역", Component: FixLogTab },
] as const;

export default function AdminSystemPage() {
  return <AdminTabs basePath="/admin/system" tabs={TABS} />;
}
