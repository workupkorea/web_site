import type { Metadata } from "next";
import TeamOrderPage from "./TeamOrderPage";

export const metadata: Metadata = {
  title: "단체복·대량구매 | WORKUP",
  description: "러닝크루, 동호회, 행사팀, 기업까지. 단체복 제작과 기성 상품 대량구매를 WORKUP에 상담해 보세요.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <TeamOrderPage />;
}
