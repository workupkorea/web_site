// 푸터 / 고객센터 / 약관·개인정보 설정 — 타입 · 기본값 · 정규화.
// ⚠️ 클라이언트(관리자)와 서버(푸터·페이지) 양쪽에서 import 되므로 서버 전용 코드 금지.
//    서버 캐시 조회는 lib/footer-server.ts.

// ── 푸터 ───────────────────────────────────────────────────────────────────
export type FooterNavLink = {
  id: string;
  label: string;
  href: string;
};

export type FooterSocialLink = {
  id: string;
  platform: string;   // FOOTER_SOCIAL_PLATFORMS 의 value, 또는 "custom"
  label: string;      // 화면에 노출되진 않고 aria-label/접근성용
  href: string;
  iconUrl: string;    // 내장 아이콘이 없는 플랫폼(custom)에서 직접 등록한 아이콘 이미지
};

// 소셜 플랫폼 목록. builtin=true 는 Footer 에 내장 SVG 아이콘이 자동 표시되고,
// builtin=false(=직접 등록)는 관리자가 아이콘 이미지를 업로드해야 한다.
export const FOOTER_SOCIAL_PLATFORMS: { value: string; label: string; builtin: boolean }[] = [
  { value: "instagram", label: "인스타그램",   builtin: true },
  { value: "youtube",   label: "유튜브",       builtin: true },
  { value: "kakao",     label: "카카오채널",   builtin: true },
  { value: "naver",     label: "네이버 블로그", builtin: true },
  { value: "facebook",  label: "페이스북",     builtin: true },
  { value: "x",         label: "X (트위터)",   builtin: true },
  { value: "threads",   label: "스레드",       builtin: true },
  { value: "tiktok",    label: "틱톡",         builtin: true },
  { value: "custom",    label: "직접 등록",    builtin: false },
];

export type FooterConfig = {
  company_name: string;
  ceo: string;
  address: string;
  biz_no: string;            // 사업자등록번호
  mail_order_no: string;     // 통신판매업 신고번호
  cs_phone: string;
  cs_hours_weekday: string;
  cs_hours_weekend: string;
  instagram_url: string;     // ⚠️ 레거시 — socialLinks 로 대체됨(마이그레이션용 유지)
  youtube_url: string;       // ⚠️ 레거시
  kakao_url: string;         // ⚠️ 레거시
  socialLinks: FooterSocialLink[];
  copyright: string;
  navLinks: FooterNavLink[];
};

export const DEFAULT_FOOTER: FooterConfig = {
  company_name: "(주)트레이딩포스트",
  ceo: "방교환",
  address: "경기도 포천시 호국로 56",
  biz_no: "206-86-40318",
  mail_order_no: "제 2021-경기포천-0336",
  cs_phone: "070-4680-0064",
  cs_hours_weekday: "평일 09:00 ~ 20:00",
  cs_hours_weekend: "주말 10:00 ~ 20:00",
  instagram_url: "",
  youtube_url: "",
  kakao_url: "",
  socialLinks: [],
  copyright: "© 2026 (주)트레이딩포스트. All rights reserved.",
  navLinks: [
    { id: "nav-cs",          label: "고객센터",      href: "/support" },
    { id: "nav-inquiry",     label: "1:1문의",       href: "/support" },
    { id: "nav-franchise",   label: "가맹·창업문의", href: "/partnership/franchise" },
    { id: "nav-wholesale",   label: "입점·제휴문의", href: "/partnership/wholesale" },
    { id: "nav-pr",          label: "공지사항",      href: "/pr" },
  ],
};

// 공지사항(구 PR룸)은 사이트 상시 메뉴이므로, 저장된 푸터에 누락돼 있으면 자동으로 보강한다.
// (관리자가 푸터 관리에서 이름·순서를 바꿔 저장하면 그 값이 유지된다.)
export const PR_ROOM_NAV_LINK: FooterNavLink = { id: "nav-pr", label: "공지사항", href: "/pr" };

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

// 외부 링크/이미지 URL은 http(s)만 허용 (javascript:/data: 등 XSS 스킴 차단). 빈 값은 그대로 허용.
const HTTP_URL_RE = /^https?:\/\//i;
export function safeUrl(v: unknown): string {
  if (typeof v !== "string") return "";
  const u = v.trim();
  if (!u) return "";
  return HTTP_URL_RE.test(u) ? u : "";
}

// 소셜 링크 정규화. socialLinks 배열이 있으면 그대로 정리하고,
// 없으면(레거시 데이터) instagram_url/youtube_url/kakao_url 에서 자동 변환한다.
function normalizeSocialLinks(
  raw: unknown,
  legacy: { instagram_url: string; youtube_url: string; kakao_url: string },
): FooterSocialLink[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((it): it is Record<string, unknown> => !!it && typeof it === "object")
      .map((it, i) => ({
        id: typeof it.id === "string" && it.id ? it.id : `soc-${i}`,
        platform: typeof it.platform === "string" && it.platform ? it.platform : "custom",
        label: typeof it.label === "string" ? it.label : "",
        href: safeUrl(it.href),
        iconUrl: safeUrl(it.iconUrl),
      }));
  }
  const migrated: FooterSocialLink[] = [];
  if (legacy.instagram_url) migrated.push({ id: "soc-instagram", platform: "instagram", label: "Instagram", href: legacy.instagram_url, iconUrl: "" });
  if (legacy.youtube_url)   migrated.push({ id: "soc-youtube",   platform: "youtube",   label: "YouTube",   href: legacy.youtube_url,   iconUrl: "" });
  if (legacy.kakao_url)     migrated.push({ id: "soc-kakao",     platform: "kakao",     label: "카카오채널", href: legacy.kakao_url,     iconUrl: "" });
  return migrated;
}

export function normalizeFooter(raw: Partial<FooterConfig> | null | undefined): FooterConfig {
  const c = raw ?? {};
  const navLinks: FooterNavLink[] = Array.isArray(c.navLinks)
    ? c.navLinks
        .filter((it): it is FooterNavLink => !!it && typeof it === "object" && typeof it.label === "string")
        .map((it, i) => ({
          id: typeof it.id === "string" && it.id ? it.id : `nav-${i}`,
          label: it.label,
          href: typeof it.href === "string" ? it.href : "/",
        }))
    : DEFAULT_FOOTER.navLinks;
  // PR룸 링크가 빠져 있으면 자동 추가(상시 메뉴 보장).
  if (!navLinks.some((l) => l.href === PR_ROOM_NAV_LINK.href)) {
    navLinks.push({ ...PR_ROOM_NAV_LINK });
  }
  const instagram_url = safeUrl(c.instagram_url);
  const youtube_url = safeUrl(c.youtube_url);
  const kakao_url = safeUrl(c.kakao_url);
  return {
    company_name: str(c.company_name, DEFAULT_FOOTER.company_name),
    ceo: str(c.ceo, DEFAULT_FOOTER.ceo),
    address: str(c.address, DEFAULT_FOOTER.address),
    biz_no: str(c.biz_no, DEFAULT_FOOTER.biz_no),
    mail_order_no: str(c.mail_order_no, DEFAULT_FOOTER.mail_order_no),
    cs_phone: str(c.cs_phone, DEFAULT_FOOTER.cs_phone),
    cs_hours_weekday: str(c.cs_hours_weekday, DEFAULT_FOOTER.cs_hours_weekday),
    cs_hours_weekend: str(c.cs_hours_weekend, DEFAULT_FOOTER.cs_hours_weekend),
    instagram_url,
    youtube_url,
    kakao_url,
    socialLinks: normalizeSocialLinks(c.socialLinks, { instagram_url, youtube_url, kakao_url }),
    copyright: str(c.copyright, DEFAULT_FOOTER.copyright),
    navLinks,
  };
}

// ── 고객센터(1:1) ──────────────────────────────────────────────────────────
export type SupportConfig = {
  hero_eyebrow: string;      // 상단 영문 라벨 (예: CUSTOMER CENTER)
  hero_title: string;        // 상단 제목
  hero_desc: string;         // 상단 설명 (줄바꿈 가능)
  guide_image_url: string;   // 좌측 안내 이미지
  intro_title: string;
  intro_desc: string;        // 줄바꿈 가능
};

export const DEFAULT_SUPPORT: SupportConfig = {
  hero_eyebrow: "",
  hero_title: "고객센터",
  hero_desc: "제품 문의, 매장 방문, 교환/반품까지 — 궁금하신 사항을 남겨 주시면 담당자가 도와드립니다.",
  guide_image_url: "",
  intro_title: "무엇을 도와드릴까요?",
  intro_desc: "제품·사이즈, 매장 방문, 교환/반품 등 궁금하신 점을 남겨 주세요.",
};

export function normalizeSupport(raw: Partial<SupportConfig> | null | undefined): SupportConfig {
  const c = raw ?? {};
  return {
    hero_eyebrow: str(c.hero_eyebrow, DEFAULT_SUPPORT.hero_eyebrow),
    hero_title: str(c.hero_title, DEFAULT_SUPPORT.hero_title),
    hero_desc: str(c.hero_desc, DEFAULT_SUPPORT.hero_desc),
    guide_image_url: safeUrl(c.guide_image_url),
    intro_title: str(c.intro_title, DEFAULT_SUPPORT.intro_title),
    intro_desc: str(c.intro_desc, DEFAULT_SUPPORT.intro_desc),
  };
}

// 1:1 문의 구분 (사용자 선택 고정값)
export const SUPPORT_CATEGORIES = ["제품·사이즈", "매장·방문", "교환·반품·AS", "기타"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

// ── 문의 알림 (담당자 이메일) ───────────────────────────────────────────────
// 문의 유형(게시판 형태)별 담당자를 따로 둘 수 있고, 각 유형에 여러 명 지정 가능.
export const NOTIFY_TYPES = [
  { key: "franchise", label: "가맹·창업" },
  { key: "wholesale", label: "입점·제휴" },
  { key: "product", label: "상품 문의" },
  { key: "support", label: "1:1 문의" },
  { key: "group_order", label: "단체복 문의" },
] as const;
export type NotifyType = (typeof NOTIFY_TYPES)[number]["key"];

export type NotificationConfig = {
  email_enabled: boolean;                        // 접수 시 담당자 이메일 발송 여부
  manager_email: string;                         // 공통 담당자 (형태별 미설정 시 사용)
  emails_by_type: Record<NotifyType, string[]>;  // 형태별 담당자(여러 명)
};

export const DEFAULT_NOTIFICATIONS: NotificationConfig = {
  email_enabled: false,
  manager_email: "",
  emails_by_type: { franchise: [], wholesale: [], product: [], support: [], group_order: [] },
};

export function normalizeNotifications(raw: Partial<NotificationConfig> | null | undefined): NotificationConfig {
  const c = raw ?? {};
  const bt = (c.emails_by_type ?? {}) as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
  return {
    email_enabled: typeof c.email_enabled === "boolean" ? c.email_enabled : false,
    manager_email: str(c.manager_email, ""),
    emails_by_type: {
      franchise: arr(bt.franchise),
      wholesale: arr(bt.wholesale),
      product: arr(bt.product),
      support: arr(bt.support),
      group_order: arr(bt.group_order),
    },
  };
}

// 특정 유형의 알림 수신자 목록 — 형태별이 있으면 그것을, 없으면 공통을 사용.
export function notifyRecipients(notif: NotificationConfig, type: string): string[] {
  const key = (["franchise", "wholesale", "product", "support", "group_order"] as const).find((k) => k === type);
  const perType = key ? notif.emails_by_type[key] : [];
  if (perType.length) return perType;
  const common = notif.manager_email.trim();
  return common ? [common] : [];
}

// ── 약관 / 개인정보처리방침 ─────────────────────────────────────────────────
export type LegalConfig = { content: string };

export const DEFAULT_TERMS = `제1조 (목적)
이 약관은 (주)트레이딩포스트(이하 "회사")가 운영하는 워크업(WORKUP) 웹사이트(이하 "사이트")에서 제공하는 서비스의 이용 조건 및 절차, 이용자와 회사의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (서비스의 성격)
1. 본 사이트는 제품 정보를 안내하고 오프라인 매장 방문 및 상담을 유도하기 위한 디지털 카탈로그 서비스입니다.
2. 본 사이트는 온라인 결제·주문·배송 기능을 제공하지 않으며, 게시된 가격·재고 등 정보는 실제 매장과 다를 수 있습니다. 정확한 정보는 매장 또는 고객센터로 문의하시기 바랍니다.

제3조 (약관의 효력 및 변경)
1. 이 약관은 사이트에 게시함으로써 효력이 발생합니다.
2. 회사는 관련 법령을 위배하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 적용일자와 변경사유를 명시하여 사이트에 공지합니다.

제4조 (서비스의 제공 및 변경)
1. 회사는 제품 정보 제공, 매장 안내, 문의 접수 등의 서비스를 제공합니다.
2. 회사는 운영상·기술상의 필요에 따라 제공하는 서비스의 내용을 변경하거나 중단할 수 있습니다.

제5조 (이용자의 의무)
이용자는 다음 행위를 하여서는 안 됩니다.
1. 타인의 정보를 도용하거나 허위 정보를 등록하는 행위
2. 회사가 게시한 정보를 무단으로 복제·배포·상업적으로 이용하는 행위
3. 사이트의 운영을 방해하거나 안정성을 해치는 행위

제6조 (게시물의 저작권)
사이트에 게시된 제품 이미지·문구·디자인 등 콘텐츠에 대한 저작권은 회사 또는 정당한 권리자에게 있으며, 사전 동의 없이 이용할 수 없습니다.

제7조 (면책)
1. 회사는 천재지변 또는 이에 준하는 불가항력으로 서비스를 제공할 수 없는 경우 책임을 지지 않습니다.
2. 본 사이트의 정보는 참고용이며, 실제 거래·상담은 매장 또는 고객센터를 통해 이루어집니다.

제8조 (분쟁의 해결 및 관할)
이 약관과 관련한 분쟁에 대하여는 대한민국 법을 준거법으로 하며, 회사의 본점 소재지를 관할하는 법원을 합의관할로 합니다.

부칙
이 약관은 게시일로부터 적용됩니다.`;

export const DEFAULT_PRIVACY = `(주)트레이딩포스트(이하 "회사")는 「개인정보 보호법」 등 관련 법령을 준수하며, 이용자의 개인정보를 소중히 보호합니다. 본 방침은 워크업(WORKUP) 웹사이트에서 처리되는 개인정보에 대해 안내합니다.

제1조 (수집하는 개인정보 항목 및 방법)
1. 회사는 다음의 개인정보를 문의 접수 과정에서 수집합니다.
   - 가맹·창업 문의: 이름, 연락처, 창업 희망 지역, 문의 내용
   - 입점·제휴 문의: 브랜드명, 담당자명, 연락처, 취급 품목, 문의 내용
   - 1:1(고객) 문의: 이름, 연락처, 문의 구분, 문의 내용
2. 서비스 이용 과정에서 접속 기록, 쿠키, 기기·브라우저 정보가 자동으로 생성·수집될 수 있습니다.

제2조 (개인정보의 수집·이용 목적)
1. 문의에 대한 응대 및 상담, 매장 안내
2. 가맹·입점·제휴 상담 진행
3. 서비스 개선 및 통계 분석

제3조 (개인정보의 보유 및 이용 기간)
1. 수집된 개인정보는 문의 응대 완료 후 또는 동의 철회 시까지 보유하며, 목적 달성 후 지체 없이 파기합니다.
2. 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.

제4조 (개인정보의 제3자 제공)
회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 법령에 근거가 있거나 이용자가 동의한 경우는 예외로 합니다.

제5조 (개인정보 처리의 위탁)
회사는 안정적인 서비스 제공을 위해 다음 업무를 위탁할 수 있습니다.
   - 클라우드 인프라 및 데이터 저장
   - 문의 데이터 처리·기록
위탁 시 관련 법령에 따라 개인정보가 안전하게 관리되도록 합니다.

제6조 (이용자의 권리)
이용자는 언제든지 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요청할 수 있으며, 회사는 관련 법령에 따라 지체 없이 조치합니다.

제7조 (개인정보의 파기)
보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 재생할 수 없는 방법으로 안전하게 파기합니다.

제8조 (개인정보의 안전성 확보 조치)
회사는 개인정보의 분실·도난·유출·변조를 방지하기 위해 접근 권한 관리, 접근 통제, 암호화 등 필요한 기술적·관리적 조치를 취합니다.

제9조 (개인정보 보호책임자)
   - 개인정보 보호책임자: (담당자명 기재)
   - 연락처: 070-4680-0064
이용자는 개인정보 관련 문의·불만을 위 연락처로 신고할 수 있습니다.

제10조 (방침의 변경)
본 방침은 법령·정책 변경에 따라 개정될 수 있으며, 변경 시 사이트를 통해 공지합니다.`;

export function normalizeLegal(raw: Partial<LegalConfig> | null | undefined, fallback: string): LegalConfig {
  const c = raw ?? {};
  return { content: typeof c.content === "string" && c.content.trim() ? c.content : fallback };
}
