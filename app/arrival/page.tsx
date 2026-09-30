import type { Metadata } from "next";
import ArrivalTimeline from "./_components/ArrivalTimeline";

export const metadata: Metadata = {
  title: "26FW ARRIVAL — 입고 스케쥴",
  description: "WORKUP 2026 Fall/Winter 시즌 상품 입고 스케쥴을 확인하세요.",
};

export default function ArrivalPage() {
  return <ArrivalTimeline />;
}
