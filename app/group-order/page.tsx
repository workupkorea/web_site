import type { Metadata } from "next";
import GroupOrderPage from "./GroupOrderPage";

export const metadata: Metadata = {
  title: "단체복·대량구매 견적 문의",
  description: "단체복·대량구매 견적을 안내해 드립니다.",
  // 정식 공개 전 검토 단계. 공개 시 검색 노출과 사이트맵 등록을 함께 결정한다.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function Page() {
  // 실제 접수(운영 DB·담당자 알림)는 Vercel 운영(production) 배포에서만 켠다.
  // 로컬·Preview(보고용 링크)에서는 접수 함수가 모의 응답을 쓰므로 테스트 문의가 운영 접수처로 가지 않는다.
  // 로컬에서 관리자 화면 연동을 확인할 때만 .env.local 에 GROUP_ORDER_LIVE=1 을 넣어 실제 접수를 켠다(커밋하지 않음).
  const submitMode = process.env.VERCEL_ENV === "production" || process.env.GROUP_ORDER_LIVE === "1" ? "live" : "mock";
  return <GroupOrderPage submitMode={submitMode} />;
}
