import type { Metadata } from "next";
import GroupOrderGuide from "./GroupOrderGuide";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "단체복·대량구매 가이드",
  description: "옷 고르기부터 견적 상담까지 단체복 준비 순서.",
  path: "/group-order-guide",
  noindex: true,
});

export default function Page() {
  return <GroupOrderGuide />;
}
