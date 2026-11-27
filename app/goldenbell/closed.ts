import type { EventPhase, PromotionEvent } from "@/app/admin/promotions/entries/events";

const dayLabel = (day: string) => day.replaceAll("-", ".");

/** 응모 기간이 아닐 때의 응모 화면: 입력 폼을 숨기고 안내와 매장 찾기를 보여준다. 응모 확인은 남긴다. */
export function renderClosedPage(html: string, event: PromotionEvent | null, phase: EventPhase) {
  const start = event?.start;
  const [title, text] = !event
    ? ["테스트 링크가 만료됐어요", "관리자에게 새 링크를 받아 주세요."]
    : phase === "planned"
    ? ["이벤트 시작 전이에요", start ? `${dayLabel(start)}부터 응모할 수 있어요.` : "곧 응모를 시작해요."]
    : ["이벤트가 종료되었어요", "참여해 주셔서 감사합니다."];
  const notice = `<div class="closed-notice" role="status"><strong>${title}</strong><p>${text}</p><a href="/store">가까운 매장 찾기</a></div>`;
  return html
    .replace('<body class="luckup">', '<body class="luckup event-closed">')
    .replace('<div id="entry-intro">', `${notice}\n    <div id="entry-intro">`);
}

/** 직원 테스트 링크로 들어온 응모 화면 */
export function renderTestPage(html: string) {
  return html
    .replace('<body class="luckup">', '<body class="luckup event-test">')
    .replace('<main class="page">', '<main class="page">\n  <p class="test-banner" role="status">테스트 모드 · 이 화면의 응모는 실제 추첨에 포함되지 않아요.</p>');
}
