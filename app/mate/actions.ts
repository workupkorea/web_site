"use server";

import { MATE_APPLICATION_GENDERS, MATE_STYLES, normalizeMatePhone, parseRound, readMateField, type MateActionState } from "@/lib/mate";
import { storeMateApplication } from "@/lib/mate-server";

export async function submitMateApplication(_: MateActionState, form: FormData): Promise<MateActionState> {
  const round = parseRound(form.get("round"));
  const consentDate = readMateField(form, "retain_through");
  if (!round || !/^\d{4}-\d{2}-\d{2}$/.test(consentDate) || form.get("consent") !== "yes") {
    return { error: "개인정보 수집·이용 안내를 확인하고 동의해 주세요." };
  }

  // Honeypot for automated submissions. The field is hidden from applicants.
  if (readMateField(form, "website")) return { error: "지원서를 확인해 주세요." };

  const snsId = readMateField(form, "sns_id").replace(/^@/, "").toLowerCase();
  const styles = [...new Set(form.getAll("feed_styles"))];
  const name = readMateField(form, "name");
  const gender = readMateField(form, "gender");
  const phone = normalizeMatePhone(readMateField(form, "phone"));
  const baseAddress = readMateField(form, "address");
  const addressDetail = readMateField(form, "address_detail");
  const address = [baseAddress, addressDetail].filter(Boolean).join(", ");
  const height = readMateField(form, "height_cm");
  const message = readMateField(form, "message");

  if (!/^[a-z0-9._]{1,30}$/.test(snsId)) return { error: "인스타그램 아이디를 확인해 주세요." };
  if (styles.length !== 1 || styles.some((style) => typeof style !== "string" || !Object.hasOwn(MATE_STYLES, style))) {
    return { error: "피드 스타일을 하나 선택해 주세요." };
  }
  if (!name || name.length > 60 || !Object.hasOwn(MATE_APPLICATION_GENDERS, gender)) {
    return { error: "이름과 성별을 확인해 주세요." };
  }
  if (!/^\d{8,15}$/.test(phone)) return { error: "연락처를 확인해 주세요." };
  if (!baseAddress || address.length > 240) return { error: "주소를 검색해 선택해 주세요." };
  if (!/^\d{2,3}(\.\d)?$/.test(height) || Number(height) < 50 || Number(height) > 260) {
    return { error: "키는 50~260cm 범위에서 입력해 주세요." };
  }
  if (Array.from(message).length < 10) return { error: "지원 내용을 10자 이상 입력해 주세요." };
  if (message.length > 1500) return { error: "지원 내용은 1,500자까지 입력할 수 있습니다." };

  const data = await storeMateApplication({
    round,
    retain_through: consentDate,
    sns_id: snsId,
    feed_styles: styles as (keyof typeof MATE_STYLES)[],
    name,
    gender: gender as keyof typeof MATE_APPLICATION_GENDERS,
    phone,
    address,
    height_cm: Number(height),
    message,
  });
  if (data === "closed") return { error: "현재 이 회차는 지원서를 접수하지 않습니다." };
  if (data === "changed") return { error: "개인정보 보유 기간이 변경되었습니다. 페이지를 새로고침해 확인해 주세요." };
  if (data === "accepted" || data === "duplicate") {
    // Use the same response so the public form does not reveal who has already applied.
    return { success: "지원서 접수가 완료되었습니다." };
  }
  return { error: "접수 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
}
