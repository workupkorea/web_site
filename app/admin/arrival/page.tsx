"use client";

import AdminTabs from "@/components/admin/AdminTabs";
import ArrivalTab from "./_tabs/ArrivalTab";
import PassTab, { PassNewWindowButton } from "./_tabs/PassTab";

// 지점 및 상품관리 — 입고 스케쥴 / 지점 출고 패스를 탭으로 묶은 통합 페이지
const TABS = [
  { key: "arrival", label: "입고 스케쥴", Component: ArrivalTab },
  { key: "pass", label: "지점 출고 패스", Component: PassTab, Actions: PassNewWindowButton },
] as const;

export default function AdminArrivalPage() {
  return <AdminTabs basePath="/admin/arrival" tabs={TABS} />;
}
