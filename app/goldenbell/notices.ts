// 이벤트 유의사항 — 응모 페이지(/goldenbell)와 안내 페이지(/goldenbell/promo)가 함께 쓴다.
// items 가 여러 개면 번호 목록, 하나면 문장으로 보여준다. note 는 목록 아래 * 표시로 강조해 덧붙임.
const EVENT_NOTICES: readonly { title: string; items: readonly string[]; note?: string }[] = [
  {
    title: "응모 기간·횟수",
    items: [
      "응모 기간은 2026.12.01 – 12.31이에요.",
      "워크업 매장에서 받은 영수증은 구매 당일에만 응모할 수 있어요.",
      "영수증이 여러 장이어도 한 사람이 하루에 한 번만 응모할 수 있어요.",
    ],
  },
  {
    title: "영수증 등록",
    items: [
      "매장명·구매일·결제금액이 확인되지 않는 사진은 반려될 수 있어요.",
      "응모 횟수를 늘리려고 한 건의 구매를 나눠 결제하거나 영수증을 나눠 발급받을 수 없어요.",
    ],
  },
  {
    title: "부정 응모",
    items: [
      "이미 등록한 영수증을 다시 제출하는 경우",
      "다른 휴대폰 번호로 하루에 여러 번 응모하는 경우",
      "타인의 영수증이나 위조·변조된 영수증을 사용하는 경우",
      "결제를 취소하거나 전액 환불받은 구매 건으로 응모하는 경우",
    ],
    note: "부정 응모가 확인되면 응모에서 제외되거나 당첨이 취소될 수 있어요.",
  },
  {
    title: "당첨·경품 수령",
    items: [
      "커피쿠폰은 이벤트 기간 중 1인(휴대폰 번호 기준) 1회만 당첨돼요.",
      "금 1돈 당첨자는 2027년 1월 5일 발표 예정이며, 응모 시 입력한 휴대폰 번호로 안내해 드려요. 당첨 경품은 방문 수령만 가능하며, 수령 시 수령증을 작성해야 해요.",
    ],
  },
  {
    title: "개인정보 파기",
    items: ["수집한 개인정보와 영수증 사진은 이벤트 종료일로부터 180일간 보관한 뒤 지체 없이 파기해요."],
  },
];

/** 항목별 [제목, 본문 HTML]. 문구는 위의 고정 문자열만 쓰므로 이스케이프하지 않는다. */
export const renderEventNotices = (wrap: (title: string, body: string) => string) =>
  EVENT_NOTICES.map(({ title, items, note }) => wrap(title, [
    items.length > 1 ? `<ol class="notice-steps">${items.map((item) => `<li>${item}</li>`).join("")}</ol>` : `<p>${items[0]}</p>`,
    note ? `<p class="notice-warn">* ${note}</p>` : "",
  ].join(""))).join("");
