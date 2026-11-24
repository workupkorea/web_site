import { MATE_APPLICATION_GENDERS, MATE_STYLES, normalizeMatePhone, parseRound } from "@/lib/mate";
import { mateInstagramResultUrl, type MateProductSelectionInput, type MateProfile } from "@/lib/mate-activities";
import { loadMatePortal, MateActivityClosedError, mateParticipantForRequest, saveMateResponse, submitMateActivityResult, updateMateProfile } from "@/lib/mate-activity-server";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", Vary: "Authorization" } });
}

const invalidLink = () => json({ error: "사용할 수 없는 개인 링크입니다. 워크업 담당자에게 문의해 주세요." }, 403);
const unavailable = () => json({ error: "정보를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500);

export async function GET(request: Request) {
  try {
    const participant = await mateParticipantForRequest(request);
    if (!participant) return invalidLink();
    return json(await loadMatePortal(participant));
  } catch {
    return unavailable();
  }
}

function profilePatch(value: unknown): Partial<MateProfile> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const patch: Partial<MateProfile> = {};
  for (const [key, raw] of Object.entries(value)) {
    const text = typeof raw === "string" ? raw.trim() : "";
    switch (key) {
      case "name":
        if (!text || text.length > 60) return null;
        patch.name = text;
        break;
      case "sns_id": {
        const id = text.replace(/^@/, "").toLowerCase();
        if (!/^[a-z0-9._]{1,30}$/.test(id)) return null;
        patch.sns_id = id;
        break;
      }
      case "phone": {
        const phone = normalizeMatePhone(text);
        if (!/^\d{8,15}$/.test(phone)) return null;
        patch.phone = phone;
        break;
      }
      case "address":
        if (!text || text.length > 240) return null;
        patch.address = text;
        break;
      case "gender":
        if (!Object.hasOwn(MATE_APPLICATION_GENDERS, text)) return null;
        patch.gender = text as keyof typeof MATE_APPLICATION_GENDERS;
        break;
      case "height_cm":
        if (!/^\d{2,3}(\.\d)?$/.test(text) || Number(text) < 50 || Number(text) > 260) return null;
        patch.height_cm = Number(text);
        break;
      case "feed_styles":
        if (!Object.hasOwn(MATE_STYLES, text)) return null;
        patch.feed_styles = [text as keyof typeof MATE_STYLES];
        break;
      default:
        return null;
    }
  }
  return patch;
}

function productSelections(input: unknown): MateProductSelectionInput[] | null {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 19) return null;
  const selections: MateProductSelectionInput[] = [];
  const ids = new Set<string>();
  for (const element of input) {
    if (!element || typeof element !== "object") return null;
    const id = typeof element.product_id === "string" ? element.product_id : "";
    const size = typeof element.size === "string" ? element.size.trim() : "";
    const color = typeof element.color === "string" ? element.color.trim() || null : null;
    if (!/^[0-9a-f-]{36}$/.test(id) || !size || size.length > 60 || (color && color.length > 60) || ids.has(id)) return null;
    ids.add(id);
    selections.push({ product_id: id, size, color });
  }
  return selections;
}

export async function PATCH(request: Request) {
  try {
    const participant = await mateParticipantForRequest(request);
    if (!participant) return invalidLink();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "입력 내용을 확인해 주세요." }, 400);

    if (body.type === "profile") {
      const patch = profilePatch(body.profile);
      if (!patch) return json({ error: "수정한 개인정보를 확인해 주세요." }, 400);
      const result = await updateMateProfile(participant, patch);
      if (result === "duplicate") return json({ error: "같은 기수에서 사용 중인 인스타그램 아이디입니다." }, 409);
      return result === "saved" ? json({ ok: true, profile: patch }) : invalidLink();
    }

    const activity = parseRound(String(body.activity_no ?? ""));
    if (body.type === "result") {
      const url = typeof body.instagram_url === "string" ? mateInstagramResultUrl(body.instagram_url.trim()) : null;
      if (!activity || !url) return json({ error: "인스타그램 게시물 또는 릴스 링크를 확인해 주세요." }, 400);
      const result_submitted_at = await submitMateActivityResult(participant, activity, url);
      if (!result_submitted_at) return json({ error: "참여 응답을 저장한 공개 회차에 결과물을 제출할 수 있습니다." }, 409);
      return json({ ok: true, activity_no: activity, response: { result_instagram_url: url, result_submitted_at } });
    }

    if (body.type !== "response" || !activity || (body.choice !== "yes" && body.choice !== "no")) {
      return json({ error: "참여 여부를 선택해 주세요." }, 400);
    }
    const size = body.choice === "yes" && typeof body.size === "string" ? body.size.trim() : null;
    if (body.choice === "yes" && (!size || size.length > 60)) return json({ error: "사이즈를 입력해 주세요." }, 400);
    const color = body.choice === "yes" && typeof body.color === "string" ? body.color.trim() || null : null;
    if (color && color.length > 60) return json({ error: "컬러를 확인해 주세요." }, 400);
    const additional = body.choice === "yes" ? productSelections(body.additional_selections) : [];
    if (!additional) return json({ error: "추가 제품의 사이즈와 컬러를 확인해 주세요." }, 400);
    const response = await saveMateResponse(participant, activity, body.choice, size, color, additional);
    return response ? json({ ok: true, activity_no: activity, response })
      : json({ error: "공개 여부나 제품 옵션이 변경되었습니다. 화면을 새로고침해 주세요." }, 409);
  } catch (error) {
    if (error instanceof MateActivityClosedError) return json({ error: "종료된 회차입니다. 응답과 결과물은 참여 이력에서 확인할 수 있습니다." }, 409);
    return unavailable();
  }
}
