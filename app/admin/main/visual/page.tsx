import { redirect } from "next/navigation";

// 슬라이딩 유형(?type=)을 유지한 채 통합 페이지의 탭으로 이동
export default async function Page({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  redirect(`/admin/main/home?tab=visual${type ? `&type=${encodeURIComponent(type)}` : ""}`);
}
