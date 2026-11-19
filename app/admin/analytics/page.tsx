"use client";

import AdminTabs from "@/components/admin/AdminTabs";
import PixelsTab from "./_tabs/PixelsTab";
import GiveawayTab from "./_tabs/GiveawayTab";
import NavTab from "./_tabs/NavTab";

// 마케팅/분석 — 댓글추첨기 / 메뉴분석 / 픽셀/광고를 탭으로 묶은 통합 페이지
const TABS = [
  { key: "giveaway", label: "댓글추첨기", Component: GiveawayTab },
  { key: "nav", label: "메뉴분석", Component: NavTab },
  { key: "pixels", label: "픽셀/광고", Component: PixelsTab },
] as const;

export default function AdminAnalyticsPage() {
  return <AdminTabs basePath="/admin/analytics" tabs={TABS} />;
}
