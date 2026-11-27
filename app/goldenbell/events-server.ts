import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase-server";
import { baseEventId, goldenbellEvent, isTestId, mergeEvents, pickEntryEvent, PROMOTION_SETTINGS_PREFIX, testEventOf, type PromotionEvent } from "@/app/admin/promotions/entries/events";

async function loadEvents() {
  const { data, error } = await createAdminClient().from("site_settings")
    .select("section, config").like("section", PROMOTION_SETTINGS_PREFIX + "%");
  if (error) throw error;
  return mergeEvents(data ?? []);
}

/** 고객 화면의 현재 이벤트. 설정을 못 읽으면 기본 이벤트의 날짜 규칙을 따른다. */
export async function currentEntryEvent() {
  try {
    return pickEntryEvent(await loadEvents());
  } catch (error) {
    console.error("[goldenbell] failed to load events", error);
    return goldenbellEvent;
  }
}

/** 당첨기의 추첨 인원을 저장한다. 테스트 영역의 값은 실제 설정에 영향을 주지 않는다. */
export async function saveQuota(eventId: string, prize: "coffee" | "gold", quota: number) {
  const event = (await loadEvents()).find((item) => item.id === baseEventId(eventId));
  if (!event) throw new Error("Unknown promotion event");
  const field = isTestId(eventId) ? "testQuotas" : "quotas";
  const { id, ...config } = { ...event, [field]: { ...event[field], [prize]: quota } };
  const { error } = await createAdminClient().from("site_settings")
    .upsert({ section: PROMOTION_SETTINGS_PREFIX + id, config, updated_at: new Date().toISOString() }, { onConflict: "section" });
  if (error) throw error;
}

/** 직원용 테스트 링크의 키. 서버 비밀값으로 만들어 저장하지 않으며, 테스트 모드를 끄면 무효가 된다. */
export function testKey({ id, testSince }: PromotionEvent) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return testSince && secret ? createHmac("sha256", secret).update(`goldenbell-test:${id}:${testSince}`).digest("hex").slice(0, 24) : "";
}

/** 테스트 키가 맞는 이벤트의 테스트 영역. 틀리거나 꺼졌으면 null */
export async function testEventFor(key: string) {
  const event = (await loadEvents()).find((item) => item.entry && testKey(item) === key);
  return key && event ? testEventOf(event) : null;
}

/** 관리자 API 의 ?event= 값. 없으면 현재 이벤트, 모르는 값이면 null */
export async function adminEvent(id: string | null) {
  if (!id) return currentEntryEvent();
  const event = (await loadEvents()).find((item) => item.id === baseEventId(id) && item.entry);
  if (!event) return null;
  return isTestId(id) ? testEventOf(event) : event;
}
