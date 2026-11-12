import InquiriesBoard from "@/components/admin/InquiriesBoard";

// B2B 탭 — 단체복·대량구매 견적 문의(group_order)만 모아서 관리한다.
export default function AdminB2bPage() {
  return <InquiriesBoard mode="b2b" />;
}
