import type { Metadata } from "next";
import GroupOrderGuide from "./GroupOrderGuide";

export const metadata: Metadata = {
  title: "단체복·대량구매 가이드",
  description: "우리 단체에 맞는 옷을 고르는 순서부터 견적 상담까지. WORKUP 단체복과 기성 상품 대량구매를 차근차근 준비해 보세요.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <GroupOrderGuide />;
}
