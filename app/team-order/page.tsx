import type { Metadata } from "next";
import TeamOrderPage from "./TeamOrderPage";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "단체복·대량구매",
  description: "단체복 제작과 대량구매 상담.",
  path: "/team-order",
  noindex: true,
});

export default function Page() {
  return <TeamOrderPage />;
}
