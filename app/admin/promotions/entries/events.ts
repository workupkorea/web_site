export const PROMOTION_SETTINGS_PREFIX = "promotion:event:";
export const entriesPath = "/admin/promotions/entries";
export const eventStatuses = { planned: "예정", active: "진행 중", ended: "종료", archived: "보관" } as const;

export type EventPhase = keyof typeof eventStatuses;
/** 시작·종료 버튼으로 정한 값. "" 이면 날짜에 따라 자동 */
export type EventOverride = "" | "open" | "closed";

export type DrawQuotas = { coffee?: number; gold?: number };

export type PromotionEvent = {
  id: string;
  name: string;
  /** 'archived' 만 의미가 있다. 진행 여부는 eventPhase 로 계산한다. */
  status: EventPhase;
  start: string;
  end: string;
  publicUrl: string;
  /** 영수증 응모(고객 /goldenbell)를 받는 이벤트 */
  entry?: boolean;
  override?: EventOverride;
  /** 테스트 모드를 켠 시각. 있으면 직원용 테스트 링크가 열린다. */
  testSince?: string;
  /** 당첨기별 추첨 인원. 없으면 기본값. 테스트 영역에서 바꾼 값은 testQuotas 에 따로 둔다. */
  quotas?: DrawQuotas;
  testQuotas?: DrawQuotas;
  /** 테스트 응모 영역(저장하지 않는 값) */
  test?: boolean;
};

const TEST_SUFFIX = ":test";
/** 테스트 응모·당첨은 별도 이벤트 id 로 저장해 실제 통계·추첨과 섞이지 않는다. */
export const testEventOf = (event: PromotionEvent): PromotionEvent =>
  ({ ...event, id: event.id + TEST_SUFFIX, test: true, quotas: { ...event.quotas, ...event.testQuotas } });
export const isTestId = (id: string) => id.endsWith(TEST_SUFFIX);
export const baseEventId = (id: string) => isTestId(id) ? id.slice(0, -TEST_SUFFIX.length) : id;

export const goldenbellEvent: PromotionEvent = {
  id: "goldenbell",
  name: "워크업 연말 이벤트",
  status: "planned",
  start: "2026-12-01",
  end: "2026-12-31",
  publicUrl: "/workup_luckup/promo",
  entry: true,
};

const KOREA_DAY = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" });
export const koreaDay = (now = new Date()) => KOREA_DAY.format(now);

/**
 * 보관 > 수동 종료 > 종료일 경과 > 수동 시작 > 날짜 자동.
 * 수동 시작은 시작일을 앞당길 뿐, 종료일이 지나면 자동으로 닫힌다.
 */
export function eventPhase({ status, start, end, override }: PromotionEvent, today = koreaDay()): EventPhase {
  if (status === "archived") return "archived";
  if (override === "closed" || (end && today > end)) return "ended";
  if (override === "open") return "active";
  return start && today >= start ? "active" : "planned";
}

/** 저장된 설정(site_settings 행)을 기본 이벤트와 합친다. */
export function mergeEvents(rows: readonly { section: string; config: unknown }[]) {
  const byId = new Map<string, PromotionEvent>([[goldenbellEvent.id, goldenbellEvent]]);
  for (const row of rows) {
    const id = row.section.slice(PROMOTION_SETTINGS_PREFIX.length);
    const saved = row.config as Omit<PromotionEvent, "id">;
    byId.set(id, { ...saved, entry: saved.entry ?? id === goldenbellEvent.id, id });
  }
  return [...byId.values()];
}

/** 고객 화면이 보여줄 응모 이벤트: 진행 중 > 가장 가까운 예정 > 가장 최근 종료 */
export function pickEntryEvent(events: readonly PromotionEvent[], today = koreaDay()): PromotionEvent {
  const entries = events.filter((event) => event.entry && event.status !== "archived");
  const inPhase = (phase: EventPhase) => entries.filter((event) => eventPhase(event, today) === phase)
    .sort((a, b) => a.start.localeCompare(b.start));
  // 모두 보관했으면 보관 상태 그대로 돌려줘서 응모가 열리지 않게 한다.
  return inPhase("active").at(-1) ?? inPhase("planned")[0] ?? inPhase("ended").at(-1)
    ?? events.find((event) => event.entry) ?? goldenbellEvent;
}
