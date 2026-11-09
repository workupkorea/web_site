"use client";

import AdminTabs from "@/components/admin/AdminTabs";
import OverviewTab from "./_tabs/OverviewTab";
import ListTab from "./_tabs/ListTab";
import InactiveTab from "./_tabs/InactiveTab";
import LogsTab from "./_tabs/LogsTab";

// 회원 관리 — 현황/조회(직접등록·접속 포함)/휴면·탈퇴/활동 로그(S관리자)를 탭으로 묶은 통합 페이지
const TABS = [
  { key: "overview", label: "회원 현황", Component: OverviewTab },
  { key: "list", label: "회원 조회", Component: ListTab },
  { key: "inactive", label: "휴면·탈퇴", Component: InactiveTab },
  { key: "logs", label: "활동 로그", Component: LogsTab, superOnly: true },
] as const;

export default function AdminMembersPage() {
  return <AdminTabs basePath="/admin/members" tabs={TABS} />;
}
