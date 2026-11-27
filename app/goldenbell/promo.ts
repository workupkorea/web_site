import { renderEventNotices } from "./notices";

export const GOLDENBELL_PROMO_SECTION = "goldenbell_promo";
export const GOLDENBELL_PROMO_PATH = "/workup_luckup/promo";

export const PROMO_FIELDS = [
  { key: "prizeIntro", label: "경품 소개 문구", max: 100, defaultValue: "워크업 구매 영수증을 등록하면 경품 추첨에 참여할 수 있습니다." },
  { key: "title", label: "브라우저·공유 제목", max: 80, defaultValue: "행운이 돌아오는 워크업 연말 이벤트" },
  { key: "description", label: "공유 설명", max: 200, defaultValue: "한 해 동안 수고한 당신께 워크업이 마음을 전해요. 골드바 1돈 10명, 커피쿠폰 800명. 워크업 매장에서 구매 후 영수증을 등록해 응모하세요.", multiline: true },
] as const;

// 예전 기본 문구가 그대로 저장돼 있으면 새 기본 문구를 보여준다. 관리자가 직접 고친 문구는 유지된다.
const RETIRED_DEFAULTS: Partial<Record<(typeof PROMO_FIELDS)[number]["key"], readonly string[]>> = {
  prizeIntro: [
    "영수증을 등록하면 경품 추첨에 참여할 수 있습니다.",
    "워크업 매장에서 응모하고, 푸짐한 선물 받으세요!",
    "애쓴 당신의 한 해 끝에, 작지만 반짝이는 마음을 준비했어요.",
  ],
  title: ["행운이 돌아오는 워크업 연말 이벤트!", "워크업 연말연시 골든벨 이벤트", "워크업, 굿워크 | 연말연시 골든벨 이벤트"],
  description: ["방문 고객 100만 달성 기념. 골드바 1돈 10명, 메가커피 아메리카노 쿠폰 800명. 워크업 매장에서 구매 후 영수증을 등록해 응모하세요.", "한 해 동안 수고한 당신께 워크업이 마음을 전해요. 골드바 1돈 10명, 메가커피 아메리카노 쿠폰 800명. 워크업 매장에서 구매 후 영수증을 등록해 응모하세요."],
};

type PromoField = (typeof PROMO_FIELDS)[number]["key"];
export const PROMO_SECTIONS = [
  { key: "heroBanner", label: "상단 골드 배너" },
  { key: "prizes", label: "경품 상세" },
  { key: "how", label: "참여 방법" },
  { key: "notice", label: "이벤트 유의사항" },
  { key: "faq", label: "자주 묻는 질문" },
] as const;
export type PromoSection = (typeof PROMO_SECTIONS)[number]["key"];
export const PROMO_DEVICES = [{ key: "pc", label: "PC" }, { key: "mobile", label: "모바일" }] as const;
export type PromoDevice = (typeof PROMO_DEVICES)[number]["key"];
export type PromoVisibility = Record<PromoDevice, boolean>;
type CustomSection = { id: string; title: string; body: string; visibility: PromoVisibility };
export const MAX_CUSTOM_SECTIONS = 12;
export type PromoConfig = Record<PromoField, string> & {
  sections: Record<PromoSection, PromoVisibility>;
  customSections: CustomSection[];
};

function normalizeVisibility(value: unknown): PromoVisibility {
  if (value && typeof value === "object") {
    const { pc, mobile } = value as Record<string, unknown>;
    return { pc: pc !== false, mobile: mobile !== false };
  }
  return { pc: value !== false, mobile: value !== false };
}

export function normalizePromoConfig(value: unknown): PromoConfig {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const config = {} as PromoConfig;
  for (const field of PROMO_FIELDS) {
    const raw = source[field.key];
    const text = typeof raw === "string" ? raw.trim().slice(0, field.max) : "";
    config[field.key] = text && !RETIRED_DEFAULTS[field.key]?.includes(text) ? text : field.defaultValue;
  }
  const visibility = source.sections && typeof source.sections === "object" ? source.sections as Record<string, unknown> : {};
  config.sections = Object.fromEntries(PROMO_SECTIONS.map(({ key }) => [key, normalizeVisibility(visibility[key])])) as PromoConfig["sections"];
  const custom = Array.isArray(source.customSections) ? source.customSections : [];
  const seen = new Set<string>();
  config.customSections = custom.slice(0, MAX_CUSTOM_SECTIONS).flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const { id, title, body, visibility } = item as Record<string, unknown>;
    if (typeof id !== "string" || !/^[a-zA-Z0-9-]{1,60}$/.test(id) || seen.has(id)
      || typeof title !== "string" || !title.trim() || typeof body !== "string" || !body.trim()) return [];
    seen.add(id);
    return [{ id, title: title.trim().slice(0, 80), body: body.trim().slice(0, 1200), visibility: normalizeVisibility(visibility) }];
  });
  return config;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function renderVisible({ mobile }: PromoVisibility, render: () => string) {
  return mobile ? render() : "";
}

export function renderPromoHtml(value: unknown) {
  const { title, description, prizeIntro, sections, customSections } = normalizePromoConfig(value);
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#ff550c">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <link rel="stylesheet" href="/goldenbell/promo.css">
</head>
<body>
  <main>
    <section class="hero" aria-labelledby="title">
      <div class="hero-copy frame">
        <h1 id="title" class="sr-only">${escapeHtml(title)}</h1>
        ${renderVisible(sections.heroBanner, () => `<picture class="hero-banner">
          <source media="(prefers-reduced-motion: reduce)" srcset="/goldenbell/promo-gold-banner.webp">
          <img src="/goldenbell/promo-gold-banner-v3.gif" alt="GOLDEN MONTH, 금 캐러 가자, 워크업으로!" width="780" height="260" fetchpriority="high">
        </picture>`)}
        <picture class="hero-visual">
          <source media="(prefers-reduced-motion: reduce)" srcset="/goldenbell/promo-hero-typo-still.webp">
          <img src="/goldenbell/promo-hero-typo.gif" alt="100만 번의 방문, 고마운 마음을 담아. WORKUP, LUCKUP! 구매하고 인증하면 행운이 UP 되는 특별한 이벤트" width="935" height="1416" fetchpriority="high">
        </picture>
      </div>
    </section>

    ${renderVisible(sections.prizes, () => `<section class="frame section" id="prizes" aria-labelledby="prize-title">
      <h2 id="prize-title">이벤트 경품</h2>
      <p class="prize-intro">${escapeHtml(prizeIntro)}</p>
      <div class="prizes">
        <article class="prize">
          <img src="/goldenbell/promo-prize-gold.webp" alt="" width="520" height="520" loading="lazy">
          <h3>골드바 1돈 <strong>10명</strong></h3>
          <p>응모자 중 10명을 추첨해<br>골드바 1돈씩 드립니다.</p>
        </article>
        <article class="prize">
          <img src="/goldenbell/promo-prize-coffee.webp" alt="" width="520" height="520" loading="lazy">
          <h3>커피쿠폰 <strong>800명</strong></h3>
          <p><span>매주 200명 ·</span> <span>1인 1회 당첨</span></p>
        </article>
      </div>
      <p class="section-note">커피 쿠폰에 당첨된 응모 건도 골드바 추첨 대상에 포함됩니다.</p>
    </section>`)}

    ${renderVisible(sections.how, () => `<section class="how" id="how" aria-labelledby="how-title">
      <div class="frame section">
        <div class="how-heading">
          <h2 id="how-title">이벤트 참여 방법</h2>
          <a class="how-store-link" href="/store" target="_blank" rel="noopener noreferrer" aria-label="가까운 매장 찾기 (새 탭)">가까운 매장 찾기</a>
        </div>
        <ol class="steps" role="list">
          <li>
            <h3>워크업 매장에서 구매하기</h3>
            <p>12월 중 워크업 매장에서 구매하고 영수증을 챙겨 주세요.</p>
          </li>
          <li><h3>매장 QR코드 스캔하기</h3><p>매장에 비치된 QR코드를 스캔해 응모 화면을 열어 주세요.</p></li>
          <li>
            <h3>영수증 사진 올리고 응모하기</h3>
            <p>워크업 영수증임을 확인할 수 있도록 촬영해 주세요.</p>
          </li>
        </ol>
      </div>
    </section>`)}

    ${renderVisible(sections.notice, () => `<section class="frame section notice" id="notice" aria-labelledby="notice-title">
      <h2 id="notice-title">이벤트 유의사항</h2>
      <dl class="notice-list">
        ${renderEventNotices((title, body) => `<div><dt>${title}</dt><dd>${body}</dd></div>`)}
      </dl>
    </section>`)}

    ${renderVisible(sections.faq, () => `<section class="frame section faq" aria-labelledby="faq-title">
      <h2 id="faq-title">궁금한 마음에 답해드려요</h2>
      <div class="questions">
        <details>
          <summary>몇 번 응모할 수 있나요?</summary>
          <p>이벤트 기간 중 1인(휴대폰 번호 기준) 1회만 응모할 수 있어요. 응모를 마치면 다시 응모할 수 없고, 이미 사용한 영수증은 다른 번호로도 등록할 수 없어요.</p>
        </details>
        <details>
          <summary>어떤 영수증으로 응모할 수 있나요?</summary>
          <p>2026년 12월 1일부터 31일까지 워크업 매장에서 구매한 영수증으로 12월 31일까지 응모할 수 있어요. 매장명·구매일·결제금액이 확인되지 않으면 반려될 수 있어요.</p>
        </details>
        <details>
          <summary>골드바에 당첨되면 어떻게 알 수 있나요?</summary>
          <p>당첨자에게는 응모할 때 입력한 휴대폰 번호로 안내해 드려요.</p>
        </details>
        <details>
          <summary>커피 쿠폰은 여러 번 당첨될 수 있나요?</summary>
          <p>아니요. 1인 1회 응모 이벤트라서 커피 쿠폰도 1인(휴대폰 번호 기준) 1회만 당첨됩니다.</p>
        </details>
        <details>
          <summary>제출한 개인정보는 언제 파기되나요?</summary>
          <p>수집한 개인정보와 영수증 사진은 이벤트 종료일로부터 180일간 보관한 뒤 지체 없이 파기합니다.</p>
        </details>
        <details>
          <summary>응모 내역은 어디에서 확인하나요?</summary>
          <p>매장 QR코드로 연 이벤트 응모 화면에서 <strong>응모 확인</strong>을 눌러 확인할 수 있어요.</p>
        </details>
      </div>
    </section>`)}
    ${customSections.map((section) => renderVisible(section.visibility, () => `<section class="frame section promo-custom-section" aria-labelledby="custom-${section.id}">
      <h2 id="custom-${section.id}">${escapeHtml(section.title)}</h2>
      <p>${escapeHtml(section.body)}</p>
    </section>`)).join("")}
  </main>
</body>
</html>`;
}
