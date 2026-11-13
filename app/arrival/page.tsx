import type { Metadata } from "next";
import ArrivalTimeline from "./_components/ArrivalTimeline";

export const metadata: Metadata = {
  title: "26FW 입고 스케쥴",
  description: "26FW 시즌 상품 입고 스케쥴.",
};

export default function ArrivalPage() {
  return <ArrivalTimeline />;
}
