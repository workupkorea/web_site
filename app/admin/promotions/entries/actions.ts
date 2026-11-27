"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { seedTestData } from "@/app/goldenbell/test-seed";
import { entriesPath, goldenbellEvent, mergeEvents, PROMOTION_SETTINGS_PREFIX, testEventOf, type EventOverride, type PromotionEvent } from "./events";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const base = "https://workup.example";

async function findEvent(id: string) {
  const { data, error } = await createAdminClient().from("site_settings")
    .select("section, config").eq("section", PROMOTION_SETTINGS_PREFIX + id);
  if (error) throw error;
  return mergeEvents(data ?? []).find((event) => event.id === id);
}

function saveConfig({ id, ...config }: PromotionEvent) {
  return createAdminClient().from("site_settings")
    .upsert({ section: PROMOTION_SETTINGS_PREFIX + id, config, updated_at: new Date().toISOString() }, { onConflict: "section" });
}

export async function setPromotionOverride(id: string, override: EventOverride): Promise<string> {
  if (!(await isAdmin())) return "관리자 로그인이 필요합니다.";
  if ((id !== goldenbellEvent.id && !uuid.test(id)) || !["", "open", "closed"].includes(override)) return "이벤트를 다시 선택해 주세요.";
  const event = await findEvent(id);
  if (!event) return "이벤트를 다시 선택해 주세요.";
  const { error } = await saveConfig({ ...event, override });
  if (error) return "이벤트 상태를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.";
  revalidatePath(entriesPath);
  return "";
}

function validDay(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(value);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value;
}

function normalizePublicUrl(value: string) {
  if (!value) return "";
  if (value.length > 500 || /\s|\\/.test(value)) return null;
  try {
    const parsed = new URL(value, base);
    if (value.startsWith("/") && !value.startsWith("//") && parsed.origin === base && !parsed.pathname.startsWith("//")) {
      return parsed.pathname + parsed.search + parsed.hash;
    }
    if (/^https?:\/\//i.test(value) && !parsed.username && !parsed.password) return parsed.href;
  } catch {
    return null;
  }
  return null;
}

export async function setPromotionTestMode(id: string, on: boolean): Promise<string> {
  if (!(await isAdmin())) return "관리자 로그인이 필요합니다.";
  const event = await findEvent(id);
  if (!event?.entry) return "이벤트를 다시 선택해 주세요.";
  if (on) {
    // 켜면 바로 확인할 수 있도록, 테스트 영역이 비어 있을 때만 가짜 데이터를 넣는다.
    try {
      await seedTestData(testEventOf(event).id);
    } catch (seedError) {
      console.error("[goldenbell] failed to seed test data", seedError);
      return "테스트 데이터를 넣지 못했습니다. 잠시 후 다시 켜 주세요.";
    }
  }
  const { error } = await saveConfig({ ...event, testSince: on ? new Date().toISOString() : "" });
  if (error) return "테스트 모드를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.";
  revalidatePath(entriesPath);
  return "";
}

/** 테스트 영역의 응모·영수증·당첨·제외번호만 지운다. 실제 응모는 이벤트 id 가 달라 영향이 없다. */
export async function clearPromotionTestData(id: string): Promise<string> {
  if (!(await isAdmin())) return "관리자 로그인이 필요합니다.";
  const event = await findEvent(id);
  if (!event?.entry) return "이벤트를 다시 선택해 주세요.";
  const testId = testEventOf(event).id;
  const sb = createAdminClient();
  const failed = "테스트 데이터를 지우지 못했습니다. 잠시 후 다시 시도해 주세요.";
  for (;;) {
    const { data, error } = await sb.from("goldenbell_entries").select("id, photo_path").eq("event_id", testId).limit(100);
    if (error) return failed;
    if (!data.length) break;
    const removed = await sb.storage.from("goldenbell-receipts").remove(data.map((row) => row.photo_path));
    if (removed.error) return failed;
    const deleted = await sb.from("goldenbell_entries").delete().eq("event_id", testId).in("id", data.map((row) => row.id));
    if (deleted.error) return failed;
  }
  for (const table of ["goldenbell_winners", "goldenbell_excluded_phones"]) {
    const { error } = await sb.from(table).delete().eq("event_id", testId);
    if (error) return failed;
  }
  revalidatePath(entriesPath);
  return "";
}

export async function savePromotionEvent(_previous: string, form: FormData): Promise<string> {
  if (!(await isAdmin())) return "관리자 로그인이 필요합니다.";

  const field = (name: string) => String(form.get(name) ?? "").trim();
  const id = field("id");
  const name = field("name");
  const start = field("start");
  const end = field("end");
  const entry = form.get("entry") === "on";
  const archived = form.get("archived") === "on";
  const publicUrl = normalizePublicUrl(field("publicUrl"));

  if (id && id !== goldenbellEvent.id && !uuid.test(id)) return "이벤트를 다시 선택해 주세요.";
  if (!name || name.length > 80) return "이벤트명을 1~80자로 입력해 주세요.";
  if (!validDay(start) || !validDay(end) || (start && end && end < start)) return "이벤트 기간을 확인해 주세요.";
  if (entry && (!start || !end)) return "영수증 응모 이벤트는 시작일과 종료일이 필요합니다.";
  if (publicUrl === null) return "안내·응모 링크를 확인해 주세요.";

  const previous = id ? await findEvent(id) : undefined;
  if (id && !previous) return "이벤트를 다시 선택해 주세요.";
  const target = id || randomUUID();
  const { error } = await saveConfig({
    id: target, name, start, end, publicUrl, entry,
    status: archived ? "archived" : "planned", override: previous?.override ?? "", testSince: previous?.testSince ?? "",
    quotas: previous?.quotas, testQuotas: previous?.testQuotas,
  });

  if (error) return "이벤트를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  revalidatePath(entriesPath);
  redirect(entriesPath + "?event=" + target);
}
