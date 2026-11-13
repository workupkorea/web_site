import type { Metadata } from "next";
import GroupOrderGuide from "./GroupOrderGuide";

export const metadata: Metadata = {
  title: "단체복·대량구매 가이드",
  description: "옷 고르기부터 견적 상담까지 단체복 준비 순서.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <GroupOrderGuide />;
}
