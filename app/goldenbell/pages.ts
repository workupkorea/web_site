// 골든벨 화면 HTML — 서버 함수 번들에 그대로 포함되도록 TS 문자열로 보관한다.
// (파일 읽기 방식은 Vercel 번들 설정이 필요해 쓰지 않는다. 스타일·스크립트는 public/goldenbell/ 에 있다.)

export const INDEX_HTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#14120e">
<title>워크업 연말연시 골든벨</title>
<link rel="stylesheet" href="/goldenbell/style.css">
<script src="/goldenbell/apply.js" defer></script>
</head>
<body>
<main class="page">
  <header class="brand"><img class="brand-logo" src="/images/logo_black.png" alt="WORKUP" width="148" height="20"></header>

  <section class="hero" aria-labelledby="title">
    <p class="hook">워크업에서 구매하고 금 1돈에 도전!</p>
    <div class="hero-title">
      <h1 id="title">연말연시 <em>골든벨</em></h1>
      <p class="period">응모기간 2026.12.01 – 12.31</p>
    </div>
    <div class="activity">
      <span class="activity-label">테스트 예시</span>
      <span id="activity-text">매장에서 구매하고 골든벨에 응모하세요</span>
      <button id="activity-toggle" type="button" hidden aria-label="응모 현황 롤링 일시정지">Ⅱ</button>
    </div>
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
      <small>지역별 1명 · 총 5명</small><strong>금 1돈</strong>
    </div>
    <div class="prize">
      <svg class="prize-art" viewBox="0 0 72 52" aria-hidden="true" focusable="false">
        <rect x="46" y="3" width="3.5" height="20" rx="1.7" fill="#e0a93b" transform="rotate(14 47 13)"/>
        <rect x="19" y="11" width="34" height="6" rx="3" fill="#6b3f1d"/>
        <path d="M21 17 H51 L47.5 47 Q47.3 49 45.3 49 H26.7 Q24.7 49 24.5 47 Z" fill="#fff" fill-opacity=".55" stroke="#6b3f1d" stroke-width="2" stroke-linejoin="round"/>
        <path d="M22.4 27 H49.6 L47.5 47 Q47.3 49 45.3 49 H26.7 Q24.7 49 24.5 47 Z" fill="#4a2a12"/>
        <rect x="27" y="29" width="9" height="9" rx="2" fill="#fff" opacity=".4" transform="rotate(-10 31 33)"/>
        <rect x="37" y="34" width="8" height="8" rx="2" fill="#fff" opacity=".3" transform="rotate(12 41 38)"/>
        <path d="M27 20 V27" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>
      </svg>
      <small>매주 200명 · 총 800명</small><strong>메가커피 아메리카노</strong>
    </div>
  </section>

  <section class="form-section" aria-labelledby="form-title">
    <div class="form-head">
      <h2 id="form-title">구매인증 응모</h2>
      <button type="button" class="check-btn" id="lookup-open">응모 확인</button>
    </div>
    <p class="intro">매장에서 받은 영수증 사진을 올려주세요.</p>
    <form id="apply" novalidate>
      <div class="field">
        <label for="name">이름</label>
        <input id="name" name="name" autocomplete="name" placeholder="이름을 입력해 주세요" maxlength="40" required aria-describedby="name-error">
        <p class="field-error" id="name-error" role="alert" hidden></p>
      </div>
      <div class="field">
        <label for="phone">휴대폰 번호</label>
        <input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="010-0000-0000" maxlength="24" required aria-describedby="phone-error">
        <p class="field-error" id="phone-error" role="alert" hidden></p>
      </div>

      <div class="field">
        <label for="region">방문 매장</label>
        <input id="region" type="search" autocomplete="off" enterkeyhint="search" placeholder="지역명을 입력하세요 (예: 성수, 송파, 인천)" maxlength="30" aria-controls="store-list" aria-describedby="store-status store-error">
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
        <p class="hint" id="file-help">매장명·구매일·결제금액이 보이게 찍어주세요.</p>
        <p class="field-error" id="receipt-error" role="alert" hidden></p>
      </div>

      <div class="consent">
        <div class="consent-row">
          <label class="consent-check"><input id="consent" name="consent" type="checkbox" value="1" aria-describedby="consent-error"><span>(필수) 개인정보 수집·이용에 동의합니다.</span></label>
          <button type="button" class="consent-open" id="consent-open">내용 보기</button>
        </div>
        <p class="field-error" id="consent-error" role="alert" hidden></p>
      </div>

      <p class="message" id="message" role="status" hidden></p>
      <button id="submit" class="primary" type="submit">응모하기</button>
    </form>

    <div id="success" class="success" hidden tabindex="-1">
      <h3>응모가 완료됐어요!</h3>
      <p id="result"></p>
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
      <button id="again" class="primary" type="button">다른 영수증 응모하기</button>
    </div>
  </section>


  <section class="result-box" aria-labelledby="result-title">
    <p class="result-label" id="result-title">금 1돈 당첨자 발표</p>
    <strong class="result-date">2027.01.04 예정</strong>
    <dl>
      <dd class="draw"><span class="draw-text">지역별 1명 추첨</span><span class="chips"><span>서울·경기</span><span>충청</span><span>경상</span><span>전라</span><span>강원·제주</span></span></dd>
    </dl>
    <p class="result-note">* 커피 경품 당첨자도 금 1돈 추첨에 참여할 수 있습니다.</p>
  </section>

  <section class="extra" aria-label="안내">
    <details class="card-details">
      <summary>이벤트 유의사항</summary>
      <ul>
        <li>응모 기간: 2026.12.01 – 12.31</li>
        <li>워크업 매장에서 기간 내 구매한 영수증으로 응모할 수 있어요. 영수증 1장당 1회 응모입니다.</li>
        <li>매장명·구매일·결제금액이 확인되지 않는 사진은 반려될 수 있어요.</li>
        <li>같은 영수증을 다른 번호로 중복 응모하거나 허위 영수증을 올리면 당첨이 취소될 수 있어요.</li>
        <li>금 1돈 당첨자는 2027.01.04 발표 예정이며, 입력한 휴대폰 번호로 안내해 드려요.</li>
      </ul>
    </details>
  </section>

  <footer><a href="/goldenbell/admin">관리자 테스트 화면</a></footer>
</main>
<dialog id="lookup-dialog" class="popup" aria-labelledby="lookup-title">
  <h2 id="lookup-title">내 응모 확인</h2>
  <form id="lookup" novalidate>
    <label for="lookup-phone">응모할 때 입력한 휴대폰 번호</label>
    <div class="lookup-row">
      <input id="lookup-phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="010-0000-0000" maxlength="24">
      <button type="submit" class="lookup-btn">조회</button>
    </div>
    <p class="field-error" id="lookup-error" role="alert" hidden></p>
  </form>
  <ul class="lookup-list" id="lookup-list" aria-live="polite"></ul>
  <div class="popup-actions"><button type="button" class="popup-close" id="lookup-close">닫기</button></div>
</dialog>
<dialog id="consent-dialog" class="popup" aria-labelledby="consent-dialog-title">
  <h2 id="consent-dialog-title">개인정보 수집·이용 동의</h2>
  <ul>
    <li><strong>수집 항목</strong> 이름, 휴대폰 번호, 방문 매장, 영수증 사진</li>
    <li><strong>이용 목적</strong> 응모 확인, 당첨자 선정·안내, 경품 제공</li>
    <li><strong>보유 기간</strong> 경품 제공 및 이벤트 종료 후 처리가 끝날 때까지</li>
    <li><strong>동의 거부</strong> 동의를 거부할 수 있으나, 거부 시 이벤트 응모가 제한됩니다.</li>
  </ul>
  <div class="popup-actions">
    <button type="button" class="popup-close" id="consent-close">닫기</button>
    <button type="button" class="popup-agree" id="consent-agree">동의하고 닫기</button>
  </div>
</dialog>

</body>
</html>
`;

export const ADMIN_HTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>골든벨 응모 검수</title><link rel="stylesheet" href="/goldenbell/style.css"><script src="/goldenbell/admin.js" defer></script>
</head>
<body>
<main class="page admin-page">
<header class="brand"><img class="brand-logo" src="/images/logo_black.png" alt="WORKUP" width="148" height="20"></header>
<section class="admin">
  <div class="admin-title"><h1>골든벨 응모 검수</h1><a href="/goldenbell/">고객 응모 화면 열기</a></div>

  <section class="panel" aria-labelledby="p-status">
    <h2 id="p-status">현황</h2>
    <div class="stat-row" id="stats" aria-label="검수 현황"></div>
    <details class="link-tool" open><summary>지역·지점별 현황</summary><div id="store-stats"></div></details>
  </section>

  <section class="panel" aria-labelledby="p-filter">
    <div class="panel-head"><h2 id="p-filter">검색·필터</h2><button type="button" id="export">엑셀 다운로드</button></div>
    <div class="filters">
      <input id="search" type="search" aria-label="이름 또는 휴대폰 번호 검색" placeholder="이름 · 휴대폰 번호 검색">
      <select id="filter" aria-label="검수 상태"><option value="">전체 상태</option><option value="pending">검수 대기</option><option value="approved">승인</option><option value="rejected">반려</option></select>
      <select id="store-filter" aria-label="지점"><option value="">전체 지점</option></select>
      <div class="date-range"><input id="from" type="date" aria-label="시작일"><span>~</span><input id="to" type="date" aria-label="종료일"></div>
    </div>
  </section>

  <section class="panel" aria-labelledby="p-list">
    <div class="panel-head"><h2 id="p-list">응모 목록</h2><label class="select-all"><input type="checkbox" id="select-all"> 이 페이지 전체 선택</label></div>
    <div class="bulk-bar" id="bulk-bar" hidden>
      <strong id="bulk-count">0건 선택</strong>
      <button type="button" id="bulk-approve">승인</button>
      <select id="bulk-reason" aria-label="일괄 반려 사유"><option value="">반려 사유 선택</option></select>
      <button type="button" id="bulk-reject">반려</button>
      <button type="button" id="bulk-clear">선택 해제</button>
    </div>
    <p id="admin-message" role="status"></p>
    <div id="groups"></div>
    <div class="pager"><button type="button" id="prev">이전</button><span id="page-label"></span><button type="button" id="next">다음</button></div>
  </section>
</section>
</main>
<dialog id="lightbox" aria-label="영수증 크게 보기"><button type="button" id="lightbox-close">닫기</button><img id="lightbox-img" alt="영수증 사진"></dialog>
</body></html>
`;
