export const MATE_STYLES = {
  outdoor: "아웃도어 & 액티비티",
  work: "워크 & 유틸리티",
  lifestyle: "데일리 & 라이프스타일",
} as const;

export const MATE_APPLICATION_REQUIREMENTS = "SNS를 활발하게 운영하며 자신만의 스타일로 정기적으로 콘텐츠를 제작할 수 있는 분";

export const MATE_GENDERS = {
  female: "여성",
  male: "남성",
  other: "기타",
  undisclosed: "응답하지 않음",
} as const;

export const MATE_STATUSES = {
  received: "접수",
  reviewing: "검토 중",
  selected: "선정",
  not_selected: "미선정",
} as const;

export type MateRound = {
  round: number;
  activity_period: string;
  starts_on: string | null;
  ends_on: string | null;
  announces_on: string | null;
  retain_through: string | null;
  outdoor_quota: number | null;
  work_quota: number | null;
  lifestyle_quota: number | null;
  published: boolean;
};

export type MateApplication = {
  id: string;
  round: number;
  sns_id: string;
  feed_styles: (keyof typeof MATE_STYLES)[];
  name: string;
  gender: keyof typeof MATE_GENDERS;
  phone: string;
  address: string;
  height_cm: number;
  message: string;
  status: keyof typeof MATE_STATUSES;
  submitted_at: string;
  retain_through: string;
  result_consent_at?: string | null;
  link_version?: number;
  link_first_issued_at?: string | null;
  link_issued_at?: string | null;
};

export type MateActionState = { error?: string; success?: string };

export function seoulDate() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
}

export function formatMateDate(date: string | null) {
  if (!date) return "미정";
  const [year, month, day] = date.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

const mateDateTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short",
});

export function formatMateDateTime(value: string) {
  return mateDateTime.format(new Date(value));
}

const mateShortDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul", month: "numeric", day: "numeric",
});

export function formatMateShortDate(value: string) {
  return mateShortDate.format(new Date(value));
}

export function mateRoundStatus(round: MateRound, today = seoulDate()) {
  if (!round.published) return "비공개";
  if (round.starts_on && today < round.starts_on) return "모집 예정";
  if (round.ends_on && today > round.ends_on) return "모집 마감";
  return "모집 중";
}

export const MATE_COHORT_STAGES = { recruitment: "모집 중", operations: "운영 중", ended: "종료" } as const;
export type MateCohortStage = keyof typeof MATE_COHORT_STAGES;

export function mateCohortStage(round: MateRound, hasActivities: boolean, today = seoulDate()): MateCohortStage {
  if (round.retain_through && today > round.retain_through) return "ended";
  if (hasActivities || (round.ends_on && today > round.ends_on)) return "operations";
  return "recruitment";
}

export function parseRound(value: unknown) {
  return typeof value === "string" && /^[1-9][0-9]{0,2}$/.test(value) ? Number(value) : null;
}

export function readMateField(form: FormData, field: string) {
  const value = form.get(field);
  return typeof value === "string" ? value.trim() : "";
}
export const MATE_APPLICATION_GENDERS = { male: MATE_GENDERS.male, female: MATE_GENDERS.female } as const;

export function normalizeMatePhone(value: string) {
  return value.replace(/[\s()-]/g, "").replace(/^\+82/, "0");
}

export function formatMatePhone(value: string) {
  const phone = normalizeMatePhone(value);
  if (!/^01[016789]\d{0,8}$/.test(phone)) return value;
  const subscriber = phone.slice(3);
  const middleLength = subscriber.length === 7 && !phone.startsWith("010") ? 3 : 4;
  return [phone.slice(0, 3), subscriber.slice(0, middleLength), subscriber.slice(middleLength)].filter(Boolean).join("-");
}

export const MATE_REGION_PREFIXES = {
  서울: ["서울특별시", "서울시", "서울"], 부산: ["부산광역시", "부산시", "부산"], 대구: ["대구광역시", "대구시", "대구"],
  인천: ["인천광역시", "인천시", "인천"], 광주: ["광주광역시", "광주시", "광주"], 대전: ["대전광역시", "대전시", "대전"],
  울산: ["울산광역시", "울산시", "울산"], 세종: ["세종특별자치시", "세종시", "세종"], 경기: ["경기도", "경기"],
  강원: ["강원특별자치도", "강원도", "강원"], 충북: ["충청북도", "충북"], 충남: ["충청남도", "충남"],
  전북: ["전북특별자치도", "전라북도", "전북"], 전남: ["전라남도", "전남"],
  경북: ["경상북도", "경북"], 경남: ["경상남도", "경남"], 제주: ["제주특별자치도", "제주도", "제주시", "제주"],
} as const;

export type MateApplicationFilters = {
  feed?: keyof typeof MATE_STYLES;
  gender?: keyof typeof MATE_APPLICATION_GENDERS;
  region?: keyof typeof MATE_REGION_PREFIXES;
};

export function mateAddressRegion(address: string) {
  const normalized = address.trim().replace(/^\(?\d{5}\)?\s+/, "");
  return Object.entries(MATE_REGION_PREFIXES).find(([, prefixes]) => prefixes.some((prefix) => normalized === prefix || normalized.startsWith(prefix + " ")))?.[0] ?? "—";
}

/** 평가결과 1년 보관 안내가 포함된 지원서 동의 문구의 버전 */
export const MATE_CONSENT_VERSION = "result-1y";

/** 활동 종료일로부터 1년 뒤 날짜. 말일은 DB의 interval '1 year'와 같게 맞춘다. */
export function mateResultExpiry(endedOn: string) {
  const date = new Date(`${endedOn}T00:00:00Z`);
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}
