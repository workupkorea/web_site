import type { Metadata } from "next";

// 당첨자 전용 배송 정보 입력 페이지 — 검색에 노출되지 않게 한다.
export const metadata: Metadata = {
  title: "당첨자 배송 정보 입력",
  robots: { index: false, follow: false },
};

export default function ClaimLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
