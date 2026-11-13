import type { Metadata } from "next";
import TeamOrderPage from "./TeamOrderPage";

export const metadata: Metadata = {
  title: "단체복·대량구매",
  description: "단체복 제작과 대량구매 상담.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <TeamOrderPage />;
}
