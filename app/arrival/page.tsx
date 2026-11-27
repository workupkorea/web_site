import type { Metadata } from "next";
import ArrivalTimeline from "./_components/ArrivalTimeline";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "26FW 입고 스케쥴",
  description: "26FW 시즌 상품 입고 스케쥴.",
  path: "/arrival",
  // 발주 사이트에 삽입하는 단독 화면 — 상품 비공개 정책에 따라 검색 노출 제외
  noindex: true,
});

export default function ArrivalPage() {
  return <ArrivalTimeline />;
}
