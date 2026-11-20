import type { Metadata } from "next";
import ActivityManagement, { type ActivitySearch } from "./activity-management";

export const metadata: Metadata = { title: "메이트 활동 회차 관리", robots: { index: false, follow: false } };

export default async function ActivityIndex({ searchParams }: { searchParams: Promise<ActivitySearch> }) {
  return <ActivityManagement search={await searchParams} />;
}