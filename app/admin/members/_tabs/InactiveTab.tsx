"use client";

import { useSearchParams } from "next/navigation";
import DormantTab from "./DormantTab";
import WithdrawnTab from "./WithdrawnTab";

// 휴면·탈퇴 — 각 표 상단 버튼으로 전환 (?tab=inactive&sub=dormant|withdrawn)
export default function InactiveTab() {
  const sub = useSearchParams().get("sub");
  return sub === "withdrawn" ? <WithdrawnTab /> : <DormantTab />;
}
