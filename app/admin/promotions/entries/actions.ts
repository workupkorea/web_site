"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { entriesPath, eventStatuses, goldenbellEvent, PROMOTION_SETTINGS_PREFIX } from "./events";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const base = "https://workup.example";

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

export async function savePromotionEvent(_previous: string, form: FormData): Promise<string> {
  if (!(await isAdmin())) return "관리자 로그인이 필요합니다.";

  const field = (name: string) => String(form.get(name) ?? "").trim();
  const id = field("id");
  const name = field("name");
  const status = field("status");
  const start = field("start");
  const end = field("end");
  const publicUrl = normalizePublicUrl(field("publicUrl"));

  if (id && id !== goldenbellEvent.id && !uuid.test(id)) return "이벤트를 다시 선택해 주세요.";
  if (!name || name.length > 80) return "이벤트명을 1~80자로 입력해 주세요.";
  if (!Object.hasOwn(eventStatuses, status)) return "이벤트 상태를 선택해 주세요.";
  if (!validDay(start) || !validDay(end) || (start && end && end < start)) return "이벤트 기간을 확인해 주세요.";
  if (publicUrl === null) return "안내·응모 링크를 확인해 주세요.";

  const target = id || randomUUID();
  const section = PROMOTION_SETTINGS_PREFIX + target;
  const settings = createAdminClient().from("site_settings");
  const values = { config: { name, status, start, end, publicUrl }, updated_at: new Date().toISOString() };
  const { data, error } = await (id && id !== goldenbellEvent.id
    ? settings.update(values).eq("section", section)
    : settings.upsert({ section, ...values }, { onConflict: "section" }))
    .select("section")
    .maybeSingle();

  if (error || !data) return "이벤트를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  revalidatePath(entriesPath);
  redirect(entriesPath + "?event=" + target);
}
