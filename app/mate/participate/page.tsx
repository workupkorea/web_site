import type { Metadata } from "next";
import MateParticipantPortal from "@/components/MateParticipantPortal";

export const metadata: Metadata = {
  title: "워크업 메이트 개인 활동",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function MateParticipantPage() {
  return <MateParticipantPortal />;
}