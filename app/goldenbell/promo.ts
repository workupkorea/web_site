const title = "워크업 연말연시 골든벨 이벤트";
const description = "방문 고객 100만 달성 기념. 골드바 1돈 10명, 메가커피 아메리카노 쿠폰 800명. 워크업 매장 QR코드로 응모하세요.";

export const PROMO_HTML = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#472329">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <link rel="stylesheet" href="/goldenbell/promo.css">
</head>
<body>
  <main>
    <section class="hero" aria-labelledby="title">
      <div class="hero-copy">
        <p class="hero-lead">방문 고객 100만 달성 기념</p>
        <h1 id="title">연말연시<br> 골든벨</h1>
        <p class="hero-total">경품 총 <strong>810개</strong></p>
        <dl class="hero-rewards" aria-label="골든벨 경품">
          <div>
            <dt><img src="/goldenbell/promo-prize-gold.webp" alt="" width="520" height="520">골드바 1돈</dt>
            <dd>10명</dd>
          </div>
          <div>
            <dt><img src="/goldenbell/promo-prize-coffee.webp" alt="" width="520" height="520">메가커피 쿠폰</dt>
            <dd>800명</dd>
          </div>
        </dl>
        <p class="qr-guide">워크업 매장에 비치된 <strong>QR코드</strong>로 응모하세요.</p>
      </div>
      <figure class="hero-photo">
        <img src="/goldenbell/promo-portrait.webp" srcset="/goldenbell/promo-portrait-small.webp 760w, /goldenbell/promo-portrait.webp 1440w" sizes="(min-width: 1024px) min(51vw, 75svh), (max-width: 590px) 82vw, (max-width: 720px) 490px, 51vw" alt="데님 작업복과 노란 작업 장갑을 착용하고 웃는 워크업 모델" width="1440" height="2160" fetchpriority="high">
      </figure>
      <div class="period">
        <span>응모 기간</span>
        <strong><time datetime="2026-12-01">2026.12.01</time> <span aria-hidden="true">–</span><span class="sr-only">부터 </span> <time datetime="2026-12-31">12.31</time></strong>
      </div>
    </section>

    <section class="frame section" id="prizes" aria-labelledby="prize-title">
      <h2 id="prize-title">골든벨 경품</h2>
      <p class="prize-intro">워크업 매장에서 응모하고, 푸짐한 선물 받으세요!</p>
      <div class="prizes">
        <article class="prize prize-gold">
          <div class="prize-copy">
            <h3><span>골드바 1돈</span> <strong>10명</strong></h3>
            <p>추첨을 통해 1인당 1돈 증정</p>
            <small>2027.01.04 당첨자 발표 예정</small>
          </div>
          <img class="prize-art" src="/goldenbell/promo-prize-gold.webp" alt="" width="520" height="520" loading="lazy">
        </article>
        <article class="prize prize-coffee">
          <div class="prize-copy">
            <h3><span>메가커피 아메리카노 쿠폰</span> <strong>800명</strong></h3>
            <p>매주 200명에게 쿠폰 지급</p>
          </div>
          <img class="prize-art" src="/goldenbell/promo-prize-coffee.webp" alt="" width="520" height="520" loading="lazy">
        </article>
      </div>
      <p class="section-note">커피 경품에 당첨된 응모 건도 금 1돈 추첨에 포함됩니다.</p>
    </section>

    <section class="how" id="how" aria-labelledby="how-title">
      <div class="frame section">
        <h2 id="how-title">골든벨 참여 방법</h2>
        <ol class="steps" role="list">
          <li><h3>워크업 매장 방문하기</h3><p>행사 기간에 워크업 매장에서 구매하고 영수증을 챙겨주세요.</p><a class="store-button" href="/store">가까운 매장 찾기 <span aria-hidden="true">↗</span></a></li>
          <li><h3>매장 QR코드 스캔</h3><p>매장에 비치된 QR코드를 휴대폰 카메라로 스캔하면 응모 화면이 열려요.</p></li>
          <li><h3>영수증 사진 등록</h3><p>이름과 휴대폰 번호를 입력하고 방문 매장을 선택한 뒤, 매장명·구매일·결제금액이 보이는 영수증 사진을 올려주세요.</p></li>
        </ol>
      </div>
    </section>

    <section class="frame section faq" aria-labelledby="faq-title">
      <h2 id="faq-title">자주 묻는 질문</h2>
      <div class="questions">
        <details>
          <summary>하루에 몇 번 응모할 수 있나요?</summary>
          <p>같은 휴대폰 번호로 하루에 한 번 응모할 수 있어요. 매일 밤 12시부터 다시 응모할 수 있으며, 이미 사용한 영수증은 다시 등록할 수 없어요.</p>
        </details>
        <details>
          <summary>어떤 영수증으로 응모할 수 있나요?</summary>
          <p>2026년 12월 1일부터 31일까지 워크업 매장에서 구매한 영수증으로 응모할 수 있어요. 영수증 1장당 1회 응모할 수 있고, 매장명·구매일·결제금액이 확인되지 않으면 반려될 수 있어요.</p>
        </details>
        <details>
          <summary>금 1돈 당첨자는 언제 발표하나요?</summary>
          <p>당첨자 10명은 2027년 1월 4일 발표 예정이에요. 당첨자에게는 응모할 때 입력한 휴대폰 번호로 안내해 드려요.</p>
        </details>
        <details>
          <summary>응모 내역은 어디에서 확인하나요?</summary>
          <p>매장 QR코드로 연 골든벨 응모 화면에서 <strong>응모 확인</strong>을 눌러 확인할 수 있어요.</p>
        </details>
      </div>
    </section>
  </main>
</body>
</html>`;
