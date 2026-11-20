"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { MATE_STATUSES, parseRound, readMateField, type MateActionState } from "@/lib/mate";
import { changeMateApplication, deleteMateApplications, recordMateLinkIssuance, storeMateRound } from "@/lib/mate-server";

const denied = { error: "관리자 로그인이 필요합니다." };
const failed = { error: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };

export async function saveMateRound(_: MateActionState, form: FormData): Promise<MateActionState> {
  if (!(await isAdmin())) return denied;
  const round = parseRound(form.get("round"));
  const activity = readMateField(form, "activity_period");
  const [starts, ends, announces, retention] = ["starts_on", "ends_on", "announces_on", "retain_through"].map((field) => readMateField(form, field));
  const quotas = ["outdoor_quota", "work_quota", "lifestyle_quota"].map((field) => readMateField(form, field));
  const published = form.get("published") === "yes";
  const dates = [starts, ends, announces, retention];
  const setDates = dates.filter(Boolean);

  if (!round || !activity || activity.length > 120) return { error: "회차와 활동 기간을 확인해 주세요." };
  if (setDates.some((date, index) => !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date
    || (index > 0 && date < setDates[index - 1]))) {
    return { error: "모집 시작일, 모집 종료일, 발표일, 활동 종료일 순으로 날짜를 입력해 주세요." };
  }
  if (published && dates.some((date) => !date)) return { error: "공개하려면 모집 일정과 활동 종료일을 입력해 주세요." };
  if (quotas.some((quota) => quota && !/^\d{1,4}$/.test(quota))) return { error: "모집 인원은 0~9,999 사이의 숫자로 입력해 주세요." };

  const record = {
    round,
    activity_period: activity,
    starts_on: starts || null,
    ends_on: ends || null,
    announces_on: announces || null,
    retain_through: retention || null,
    outdoor_quota: quotas[0] ? Number(quotas[0]) : null,
    work_quota: quotas[1] ? Number(quotas[1]) : null,
    lifestyle_quota: quotas[2] ? Number(quotas[2]) : null,
    published,
  };
  const create = form.get("mode") === "create";
  const result = await storeMateRound(record, create);
  if (result === "duplicate") return { error: "이미 등록된 회차입니다." };
  if (result !== "saved") return failed;
  revalidatePath("/admin/mate");
  if (create) redirect(`/admin/mate?round=${round}`);
  return { success: "모집 설정을 저장했습니다." };
}

export async function updateMateApplication(_: MateActionState, form: FormData): Promise<MateActionState> {
  if (!(await isAdmin())) return denied;
  const round = parseRound(form.get("round"));
  const id = readMateField(form, "id");
  const status = readMateField(form, "status");
  if (!round || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return failed;

  if (!Object.hasOwn(MATE_STATUSES, status)) return failed;
  const nextStatus = status as keyof typeof MATE_STATUSES;
  if (!(await changeMateApplication(round, id, nextStatus))) return failed;
  revalidatePath("/admin/mate");
  return { success: "심사 상태를 저장했습니다." };
}
export async function removeMateApplications(round: number, ids: string[]): Promise<MateActionState> {
  if (!(await isAdmin())) return denied;
  if (!parseRound(String(round)) || !Array.isArray(ids) || !ids.length || ids.length > 25
    || ids.some((id) => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))) {
    return { error: "삭제할 지원서를 다시 선택해 주세요." };
  }

  const { count, error } = await deleteMateApplications(round, [...new Set(ids)]);
  if (error) return { error: "선택한 지원서를 삭제하지 못했습니다." };
  revalidatePath("/admin/mate");
  revalidatePath("/admin/mate/activities");
  return { success: `지원서 ${count ?? 0}건을 삭제했습니다.` };
}
export async function issueMateParticipantLink(round: number, id: string, version: number, reissue: boolean): Promise<MateActionState> {
  if (!(await isAdmin())) return denied;
  if (!parseRound(String(round)) || typeof id !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
    || !Number.isInteger(version) || version < 0 || version >= 999999999 || typeof reissue !== "boolean") {
    return { error: "선정자 정보를 다시 확인해 주세요." };
  }
  if (!(await recordMateLinkIssuance(round, id, version, reissue))) {
    return { error: "링크 상태가 변경되었거나 활동이 종료되었습니다. 목록을 새로고침해 주세요." };
  }
  revalidatePath("/admin/mate");
  revalidatePath("/admin/mate/activities/[round]/[activity]", "page");
  return { success: reissue ? "새 개인 링크를 발급했습니다." : "개인 링크를 발급했습니다." };
}