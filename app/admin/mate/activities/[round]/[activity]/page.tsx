import type { Metadata } from "next";
import ActivityManagement from "../../activity-management";

export const metadata: Metadata = { title: "메이트 활동 회차 관리", robots: { index: false, follow: false } };

export default async function ActivityPage({ params, searchParams }: {
  params: Promise<{ round: string; activity: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [path, search] = await Promise.all([params, searchParams]);
  return <ActivityManagement search={{ ...path, page: search.page }} direct />;
}