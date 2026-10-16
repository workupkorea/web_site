import type { Metadata } from "next";
import Link from "next/link";
import styles from "./review.module.css";

export const metadata: Metadata = {
  title: "단체복·대량구매 내부 검토",
  description: "WORKUP 단체복·대량구매 페이지 세 가지 방향을 직접 비교해 보세요.",
  robots: { index: false, follow: false },
};

const concepts = [
  { number: "01", name: "현장 중심형", route: "/group-order", question: "어떤 업종의 팀인가요?", audience: "건설·제조·물류·매장팀", focus: "업종별 참고 상품과 로고 위치" },
  { number: "02", name: "단체 확장형", route: "/team-order", question: "어떤 단체인가요?", audience: "러닝크루·동호회·행사·기업·현장팀", focus: "다양한 단체와 두 가지 구매 방식" },
  { number: "03", name: "구매 가이드형", route: "/group-order-guide", question: "왜 함께 입으려 하나요?", audience: "단체 구매를 처음 준비하는 고객", focus: "목적, 구매 방식, 견적 준비 순서" },
];

export default function InternalReview() {
  return <main className={styles.page}>
    <section className={styles.hero}><div className={styles.container}><p>WORKUP / INTERNAL REVIEW</p><h1>단체 구매 페이지,<br />어떤 방향이 좋을까요?</h1><span>세 페이지를 직접 열어 버튼과 선택 흐름을 비교해 보세요.</span></div></section>
    <section className={styles.content}><div className={styles.container}>
      <div className={styles.intro}><h2>세 가지 접근</h2><p>같은 단체복·대량구매 서비스를 다른 출발점에서 설명합니다. 각 페이지의 문의 버튼은 검토용이며 실제로 접수되지 않습니다.</p></div>
      <div className={styles.cards}>{concepts.map((concept) => <article key={concept.number} className={styles.card}><span>{concept.number} / CONCEPT</span><h3>{concept.name}</h3><p className={styles.question}>“{concept.question}”</p><dl><div><dt>주요 대상</dt><dd>{concept.audience}</dd></div><div><dt>핵심 구성</dt><dd>{concept.focus}</dd></div></dl><Link href={concept.route}>페이지 직접 확인하기 <span aria-hidden>↗</span></Link></article>)}</div>
      <div className={styles.decision}><div><span>검토할 기준</span><h2>회의에서 결정할 세 가지</h2></div><ol><li>대표 페이지의 주된 고객을 모든 단체로 둘지, 워크웨어 팀을 중심으로 둘지</li><li>맞춤 단체복과 기성 상품 대량구매를 동등하게 보여줄지</li><li>상담 전에 고객에게 요구할 정보의 수준을 어디까지로 할지</li></ol></div>
      <p className={styles.note}>이 주소는 내부 검토를 위한 미리보기입니다. 운영 사이트의 대표 페이지와 메뉴는 변경하지 않았습니다.</p>
    </div></section>
  </main>;
}
