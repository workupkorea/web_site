// 골든벨 화면 HTML — 서버 함수 번들에 그대로 포함되도록 TS 문자열로 보관한다.
// (파일 읽기 방식은 Vercel 번들 설정이 필요해 쓰지 않는다. 스타일·스크립트는 public/goldenbell/ 에 있다.)

export const INDEX_HTML = renderEntryPage();
export const PREVIEW_HTML = renderEntryPage(true);
export const INTERNAL_PREVIEW_HTML = renderEntryPage(true, true);

function renderEntryPage(preview = false, internal = false) {
return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="${preview ? "#14120e" : "#ff550c"}">
<title>${preview ? "워크업 골든벨 | 아메리카노 즉석 추첨" : "워크업 연말연시 골든벨"}</title>
<link rel="stylesheet" href="/goldenbell/style.css">
<script src="/goldenbell/apply.js" defer></script>
</head>
<body class="${preview ? "instant-preview" : "luckup"}">
<main class="page">
  ${preview ? '<header class="brand"><img class="brand-logo" src="/images/logo_black.png" alt="WORKUP" width="148" height="20"></header>' : ""}

  <section class="hero" aria-labelledby="title">
    ${preview ? `<p class="hook">구매 인증하고 아메리카노에 도전!</p>
    <div class="hero-title">
      <h1 id="title">연말연시 <em>골든벨</em></h1>
      <p class="instant-draw-title">아메리카노 즉석 추첨</p>
      <p class="period">응모기간 2026.12.01 – 12.31</p>
    </div>` : `<h1 id="title" class="sr-only">워크업 연말연시 골든벨 응모</h1>
    <picture class="hero-visual">
      <source media="(prefers-reduced-motion: reduce)" srcset="/goldenbell/promo-hero-still.webp">
      <img src="/goldenbell/promo-hero.gif" alt="100만 번의 방문, 고마운 마음을 담아. WORKUP, LUCKUP! 구매하고 인증하면 행운이 UP 되는 특별한 이벤트" width="941" height="1672" fetchpriority="high">
    </picture>
    <p class="period">응모기간 2026.12.01 – 12.31</p>`}
    ${preview ? '<p class="preview-notice">테스트용 화면입니다. 실제 경품은 지급되지 않아요.</p>' : `<div class="activity">
      <span class="activity-label">테스트 예시</span>
      <span id="activity-text">매장에서 구매하고 골든벨에 응모하세요</span>
      <button id="activity-toggle" type="button" hidden aria-label="응모 현황 롤링 일시정지">Ⅱ</button>
    </div>`}
  </section>

  <section class="prizes" aria-label="추첨 경품">
    <div class="prize prize-main">
      <svg class="prize-art" viewBox="0 0 72 52" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="gold-front" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset=".45" stop-color="#f6c340"/><stop offset="1" stop-color="#b9780c"/></linearGradient>
          <linearGradient id="gold-top" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fffbe6"/><stop offset="1" stop-color="#ffe07a"/></linearGradient>
        </defs>
        <polygon points="14,22 58,22 66,40 6,40" fill="url(#gold-front)" stroke="#8a5806" stroke-width="1.5" stroke-linejoin="round"/>
        <polygon points="20,10 52,10 58,22 14,22" fill="url(#gold-top)" stroke="#8a5806" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M18 27 L30 27 L28 36 L14 36 Z" fill="#fff" opacity=".35"/>
        <path class="sparkle s1" d="M8 8 L10 13 L15 15 L10 17 L8 22 L6 17 L1 15 L6 13 Z" fill="#fff"/>
        <path class="sparkle s2" d="M62 2 L63.6 6 L67.6 7.6 L63.6 9.2 L62 13.2 L60.4 9.2 L56.4 7.6 L60.4 6 Z" fill="#fff"/>
        <path class="sparkle s3" d="M66 26 L67 28.6 L69.6 29.6 L67 30.6 L66 33.2 L65 30.6 L62.4 29.6 L65 28.6 Z" fill="#fff"/>
      </svg>
      <strong>금 1돈</strong>
    </div>
    <div class="prize">
      <svg ${preview ? 'class="coffee-fill-source" width="0" height="0"' : 'class="prize-art" viewBox="0 0 72 52"'} aria-hidden="true" focusable="false">
        <g id="goldenbell-coffee-cup">
        <rect x="46" y="3" width="3.5" height="20" rx="1.7" fill="#e0a93b" transform="rotate(14 47 13)"/>
        <rect x="19" y="11" width="34" height="6" rx="3" fill="#6b3f1d"/>
        <path d="M21 17 H51 L47.5 47 Q47.3 49 45.3 49 H26.7 Q24.7 49 24.5 47 Z" fill="#fff" fill-opacity=".55" stroke="#6b3f1d" stroke-width="2" stroke-linejoin="round"/>
        <path d="M22.4 27 H49.6 L47.5 47 Q47.3 49 45.3 49 H26.7 Q24.7 49 24.5 47 Z" fill="#4a2a12"/>
        <rect x="27" y="29" width="9" height="9" rx="2" fill="#fff" opacity=".4" transform="rotate(-10 31 33)"/>
        <rect x="37" y="34" width="8" height="8" rx="2" fill="#fff" opacity=".3" transform="rotate(12 41 38)"/>
        <path d="M27 20 V27" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>
        </g>
      </svg>
      ${preview ? "" : "<small>매주 200명 · 총 800명</small>"}<strong>메가커피 아메리카노</strong>
      ${preview ? `<div class="coffee-fill">
        <div class="coffee-fill-cups" aria-hidden="true"><div class="coffee-fill-track">${Array.from({ length: 200 }, () => '<svg class="coffee-fill-cup" viewBox="16 0 40 52" focusable="false"><use href="#goldenbell-coffee-cup"/></svg>').join("")}</div></div>
        <p class="coffee-fill-total">주간 제공량 <b>200</b>잔 <span> / 총 800잔</span></p>
      </div>` : ""}
    </div>
  </section>

  <section class="form-section" aria-labelledby="form-title">
    <div id="entry-intro">
      <div class="form-head">
        <h2 id="form-title">구매인증 응모</h2>
        ${preview ? "" : '<button type="button" class="check-btn" id="lookup-open" data-lookup-open>응모 확인</button>'}
      </div>
      <p class="intro">매장에서 받은 영수증 사진을 올려주세요.</p>
    </div>
    <form id="apply" novalidate>
      <div class="field">
        <label for="name">이름</label>
        <input id="name" name="name" autocomplete="name" placeholder="이름을 입력해 주세요" maxlength="40" required aria-describedby="name-error">
        <p class="field-error" id="name-error" role="alert" hidden></p>
      </div>
      <div class="field">
        <label for="phone">휴대폰 번호</label>
        <input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="00000000000" maxlength="24" required aria-describedby="phone-error phone-limit">
        <p class="hint" id="phone-limit">${preview ? "동일한 휴대폰 번호로는 하루에 한 번만 응모할 수 있습니다." : "같은 번호로 하루에 한 번만 응모할 수 있어요. 밤 12시부터 다시 응모할 수 있어요."}</p>
        <p class="field-error" id="phone-error" role="alert" hidden></p>
      </div>

      <div class="field">
        <label for="region">방문 매장</label>
        <input id="region" type="search" autocomplete="off" enterkeyhint="search" placeholder="지역명을 입력하세요 (예: 성수, 포천, 청량리)" maxlength="30" aria-controls="store-list" aria-describedby="store-status store-error">
        <input id="store" name="store" type="hidden">
        <p class="store-status" id="store-status" role="status" aria-live="polite">지역명을 입력하면 근처 지점을 고를 수 있어요.</p>
        <div class="store-list" id="store-list" role="radiogroup" aria-label="방문 매장 선택" hidden></div>
        <p class="field-error" id="store-error" role="alert" hidden></p>
      </div>

      <div class="field">
        <label for="receipt">영수증 사진</label>
        <div class="file-panel">
          <input id="receipt" name="receipt" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="file-help receipt-error" required>
          <img id="preview" alt="첨부한 영수증 미리보기" hidden>
        </div>
        <p class="hint" id="file-help">매장명·구매일·결제금액이 보이게 찍어주세요.${preview ? '<br>영수증 사진이 흐리거나 구매 내역을 확인할 수 없는 경우, <strong>응모가 취소됩니다.</strong>' : ""}</p>
        <p class="field-error" id="receipt-error" role="alert" hidden></p>
      </div>

      <div class="consent">
        <div class="consent-row">
          <label class="consent-check"><input id="consent" name="consent" type="checkbox" value="1" aria-describedby="consent-error"><span>${preview ? "(필수) 테스트 응모 안내를 확인했습니다." : "(필수) 개인정보 수집·이용에 동의합니다."}</span></label>
          <button type="button" class="consent-open" id="consent-open">내용 보기</button>
        </div>
        <p class="field-error" id="consent-error" role="alert" hidden></p>
      </div>

      <p class="message" id="message" role="status" hidden></p>
      ${preview ? '<p class="preview-draw-hint">응모를 완료하고 복권을 긁어 메가커피 아메리카노 쿠폰에 도전하세요.</p>' : ""}
      <button id="submit" class="primary" type="submit">${preview ? "응모하고 복권 받기" : "응모하기"}</button>
    </form>

    ${preview ? '<p id="preview-sold-out" class="preview-sold-out" role="status" tabindex="-1" hidden>커피쿠폰이 소진되었습니다. 다음주에 응모해주세요.</p>' : ""}

    ${preview ? `<section id="scratch-ticket" class="scratch-ticket" aria-labelledby="scratch-title" tabindex="-1" hidden>
      <h3 id="scratch-title">아메리카노 복권</h3>
      <p id="scratch-instructions">손가락이나 마우스로 복권을 긁어주세요.</p>
      <div id="scratch-surface" class="scratch-window" tabindex="0" role="button" aria-label="복권 긁기" aria-describedby="scratch-instructions scratch-keyboard-hint">
        <strong id="scratch-outcome" aria-hidden="true"></strong>
        <canvas id="scratch-cover" width="480" height="176" aria-hidden="true"></canvas>
      </div>
      <span id="scratch-keyboard-hint" class="scratch-visually-hidden">키보드에서는 스페이스 키나 엔터 키를 여러 번 눌러 긁을 수 있어요.</span>
      <div id="scratch-progress-row" class="scratch-progress-row">
        <progress id="scratch-progress" max="100" value="0" aria-label="복권을 긁은 비율"></progress>
        <span id="scratch-percent" aria-hidden="true">0%</span>
      </div>
      <p id="scratch-announcement" class="scratch-result-line" role="status" aria-atomic="true"></p>
    </section>` : ""}

    ${preview ? `<div id="success" class="success" hidden tabindex="-1">
      <h3 id="success-title">응모가 완료됐어요!</h3>
      <p id="result"></p>
      <div id="preview-delivery" class="preview-verification" hidden>
        <strong>커피쿠폰 발송 안내</strong>
        <p>영수증으로 구매 내역이 확인된 당첨자께 커피쿠폰을 <strong>00일에 일괄 발송해 드려요.</strong></p>
      </div>
      <div class="visit" id="visit" hidden>
        <p class="visit-title">매장에서 직접 만나보세요</p>
        <strong id="visit-name"></strong>
        <small id="visit-address"></small>
        <small id="visit-hours"></small>
        <div class="visit-actions">
          <a id="visit-route" class="visit-btn" target="_blank" rel="noopener noreferrer">길찾기</a>
          <a id="visit-call" class="visit-btn">전화하기</a>
        </div>
      </div>
      <button id="again" class="primary" type="button">다시 테스트하기</button>
    </div>` : `<section id="success" class="success success-complete" aria-labelledby="success-title" hidden tabindex="-1">
      <h3 id="success-title">응모가 완료되었습니다!</h3>
      <p class="success-thanks">골든벨 이벤트에 참여해 주셔서 감사합니다.</p>
      <dl class="success-receipt">
        <dt>접수번호</dt>
        <dd id="result"></dd>
      </dl>
      <p class="success-tomorrow"><strong>내일도 골든벨에 도전하세요!</strong></p>
      <p class="success-rule">골든벨 이벤트는 하루 한 번 참여 가능하며,<br>매일 자정 이후 다시 응모하실 수 있습니다.</p>
      <hr>
      <div class="success-actions">
        <button id="again" class="primary success-back" type="button">응모화면으로 돌아가기</button>
        <button id="success-lookup-open" class="primary" type="button" data-lookup-open>내 응모현황 보기</button>
      </div>
    </section>`}
  </section>


  <section class="result-box" aria-labelledby="result-title">
    <p class="result-label" id="result-title">금 1돈 당첨자 발표</p>
    <strong class="result-date">2027.01.04 예정</strong>
    <p class="result-note">커피 경품에 당첨된 응모 건도 금 1돈 추첨 대상에 포함돼요.</p>
  </section>

  <section class="extra" aria-label="안내">
    <details class="card-details">
      <summary>이벤트 유의사항</summary>
      <ul>
        <li>응모 기간: 2026.12.01 – 12.31</li>
        ${preview ? "<li>아메리카노는 매주 200명에게 배정되며, 응모 후 복권을 긁어 당첨 여부를 확인할 수 있어요. 다음 주 응모는 월요일 0시(한국시간)부터 가능해요.</li>" : ""}
        <li>워크업 매장에서 기간 내 구매한 영수증으로 응모할 수 있어요. 영수증 1장당 1회 응모입니다.</li>
        ${preview ? "" : "<li>같은 번호로 하루에 한 번만 응모할 수 있어요.</li>"}
        <li>매장명·구매일·결제금액이 확인되지 않는 사진은 반려될 수 있어요.</li>
        <li>같은 영수증을 다른 번호로 중복 응모하거나 허위 영수증을 올리면 당첨이 취소될 수 있어요.</li>
        <li>금 1돈 당첨자는 2027.01.04 발표 예정이며, 입력한 휴대폰 번호로 안내해 드려요.</li>
        ${preview ? "" : "<li>금 1돈은 방문 수령만 가능하며, 수령 시 수령증을 작성해야 해요.</li>"}
      </ul>
    </details>
  </section>

  <footer>${preview ? '<a href="/goldenbell/v2/admin">2차 버전 관리자 테스트 화면</a>' : '<a href="/goldenbell/admin">관리자 테스트 화면</a>'}</footer>
</main>
${preview ? "" : `<dialog id="lookup-dialog" class="popup" aria-labelledby="lookup-title">
  <h2 id="lookup-title">내 응모 확인</h2>
  <form id="lookup" novalidate>
    <label for="lookup-phone">응모할 때 입력한 휴대폰 번호</label>
    <div class="lookup-row">
      <input id="lookup-phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="00000000000" maxlength="24">
      <button type="submit" class="lookup-btn">조회</button>
    </div>
    <p class="field-error" id="lookup-error" role="alert" hidden></p>
  </form>
  <ul class="lookup-list" id="lookup-list" aria-live="polite"></ul>
  <div class="popup-actions"><button type="button" class="popup-close" id="lookup-close">닫기</button></div>
</dialog>`}
<dialog id="consent-dialog" class="popup" aria-labelledby="consent-dialog-title">
  <h2 id="consent-dialog-title">${preview ? "테스트 응모 안내" : "개인정보 수집·이용 동의"}</h2>
  ${preview ? `<p>예시 이름과 휴대폰 번호, 테스트용 영수증 사진으로 응모해 주세요. 입력 정보와 사진은 ${internal ? "내부 확인용 환경" : "이 PC의 로컬 테스트 환경"}에 저장되며, 2차 버전 관리자 화면에서 볼 수 있습니다.</p>` : `<ul>
    <li><strong>수집 항목</strong> 이름, 휴대폰 번호, 방문 매장, 영수증 사진</li>
    <li><strong>이용 목적</strong> 응모 확인, 당첨자 선정·안내, 경품 제공</li>
    <li><strong>보유 기간</strong> 경품 제공 및 이벤트 종료 후 처리가 끝날 때까지</li>
    <li><strong>동의 거부</strong> 동의를 거부할 수 있으나, 거부 시 이벤트 응모가 제한됩니다.</li>
  </ul>`}
  <div class="popup-actions">
    <button type="button" class="popup-close" id="consent-close">닫기</button>
    <button type="button" class="popup-agree" id="consent-agree">${preview ? "확인했어요" : "동의하고 닫기"}</button>
  </div>
</dialog>

</body>
</html>
`;
}

export const ADMIN_HTML = renderAdminPage();
export const PREVIEW_ADMIN_HTML = renderAdminPage(true);

function renderAdminPage(preview = false) {
const title = preview ? "골든벨 2차 응모 검수" : "골든벨 응모 검수";
return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><link rel="stylesheet" href="/admin-ui.css"><link rel="stylesheet" href="/goldenbell/admin.css"><script src="/goldenbell/admin.js" defer></script>
</head>
<body class="admin-ui goldenbell-admin-body">
<goldenbell-review class="goldenbell-review" data-admin-api="${preview ? "/goldenbell/api/v2/admin" : "/goldenbell/api/admin"}">
<main>
<header class="review-brand"><img src="/images/logo_black.png" alt="WORKUP" width="148" height="20"></header>
<div class="admin-title"><h1>${title}</h1><a href="${preview ? "/goldenbell/v2" : "/goldenbell/"}">고객 응모 화면 열기</a></div>
${renderReviewPanels(preview)}
</main>
</goldenbell-review>
</body></html>
`;
}

export function renderReviewPanels(preview = false, { compact = false } = {}) {
const filterFields = `
      <input id="search" type="search" aria-label="이름 또는 휴대폰 번호 검색" placeholder="이름 · 휴대폰 번호 검색">
      <select id="filter" aria-label="검수 상태"><option value="">전체 상태</option><option value="pending">검수 대기</option><option value="approved">승인</option><option value="rejected">반려</option></select>
      <select id="store-filter" aria-label="지점"><option value="">전체 지점</option></select>
      <div class="date-range"><input id="from" type="date" aria-label="시작일"><span aria-hidden="true">~</span><input id="to" type="date" aria-label="종료일"></div>`;
const exportButton = '<button type="button" id="export">엑셀 다운로드</button>';
const stats = '<div class="stat-row" id="stats" aria-label="검수 현황"></div>';
const groupColumns = '<div><span>응모자</span><span>응모 지점</span><span>검수 현황</span></div>';
return `
  ${compact ? `<section class="panel filter-bar" aria-labelledby="p-filter">
    <h2 id="p-filter">검색·필터</h2>
    <div class="filters">${filterFields}</div>
    ${exportButton}
  </section>` : ""}

  <section class="panel" aria-labelledby="p-status">
    ${compact ? `<div class="status-bar">
      <h2 id="p-status">현황</h2>
      ${stats}
      <button type="button" class="review-toggle" aria-expanded="false" aria-controls="store-stats">지점별 현황</button>
    </div>
    <div class="store-stats-grid" id="store-stats" hidden></div>` : `
    <h2 id="p-status">현황</h2>
    ${stats}
    <details class="link-tool" open><summary>지점별 현황</summary><div id="store-stats"></div></details>`}
  </section>

  ${compact ? "" : `<section class="panel" aria-labelledby="p-filter">
    <div class="panel-head"><h2 id="p-filter">검색·필터</h2>${exportButton}</div>
    <div class="filters">${filterFields}</div>
  </section>`}

  ${preview ? `<section class="panel" aria-labelledby="p-coupon">
    <div class="panel-head"><h2 id="p-coupon">아메리카노 쿠폰 발송</h2><button type="button" id="coupon-export">쿠폰 발송용 엑셀</button></div>
    <p class="hint">현재 검색·필터 조건에 맞는 당첨자 중 구매 인증이 승인된 건을 발송용 엑셀에 담습니다.</p>
    <div class="coupon-winners" aria-labelledby="coupon-winners-title">
      <h3 id="coupon-winners-title">아메리카노 당첨자 목록</h3>
      <p id="coupon-winners-message" class="hint" role="status">당첨자 목록을 불러오는 중이에요.</p>
      <div id="coupon-winners-table" class="coupon-winners-scroll" role="region" aria-label="아메리카노 당첨자 표" tabindex="0" hidden>
        <table class="summary-table coupon-winners-table">
          <thead><tr><th scope="col">이름</th><th scope="col">휴대폰 번호</th><th scope="col">방문 매장</th><th scope="col">응모 일시</th><th scope="col">검수 상태</th><th scope="col">쿠폰 발송 대상</th></tr></thead>
          <tbody id="coupon-winners-rows"></tbody>
        </table>
      </div>
      <div id="coupon-winners-pager" class="pager" role="group" aria-label="당첨자 목록 페이지" hidden>
        <button type="button" id="coupon-winners-prev">이전</button><span id="coupon-winners-page"></span><button type="button" id="coupon-winners-next">다음</button>
      </div>
    </div>
  </section>` : ""}

  <section class="panel" aria-labelledby="p-list">
    <div class="panel-head"><h2 id="p-list">응모 목록</h2><div class="list-actions">
      ${compact ? '<button type="button" id="toggle-groups" aria-controls="groups" disabled>모두 펼치기</button>' : ""}
      <label class="select-all"><input type="checkbox" id="select-all"> 이 페이지 전체 선택</label>
    </div></div>
    <div class="bulk-bar" id="bulk-bar" hidden>
      <strong id="bulk-count">0건 선택</strong>
      <button type="button" id="bulk-approve">승인</button>
      <select id="bulk-reason" aria-label="일괄 반려 사유"><option value="">반려 사유 선택</option></select>
      <button type="button" id="bulk-reject">반려</button>
      <button type="button" id="bulk-clear">선택 해제</button>
    </div>
    <p id="admin-message" role="status"></p>
    ${compact ? `<div id="group-list-head" class="group-list-head" aria-hidden="true" hidden>${groupColumns}${groupColumns}</div>` : ""}
    <div id="groups"></div>
    <div class="pager"><button type="button" id="prev">이전</button><span id="page-label"></span><button type="button" id="next">다음</button></div>
  </section>
<dialog id="lightbox" aria-label="영수증 크게 보기"><button type="button" id="lightbox-close">닫기</button><img id="lightbox-img" alt="영수증 사진"></dialog>
`;
}
