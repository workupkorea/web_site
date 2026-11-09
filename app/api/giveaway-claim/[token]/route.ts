import { NextResponse } from "next/server";
import { getClaimDoc, getSubmission, saveSubmission } from "@/lib/giveaway-claims-server";
import { eventIdOfToken, validToken, type ClaimSubmission } from "@/lib/giveaway-claims";

// 공개 엔드포인트: 당첨자가 자기 고유 링크로 배송 정보를 제출한다.
// 토큰(16바이트 무작위)이 곧 인증이므로, 응답에는 해당 당첨자 본인 정보만 담고 다른 사람의 정보나 제출 내용은 돌려주지 않는다.
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };
const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

async function load(token: string) {
  if (!validToken(token)) return null;
  const doc = await getClaimDoc(eventIdOfToken(token));
  const entry = doc?.entries.find((e) => e.token === token);
  return doc && entry ? { doc, entry } : null;
}

export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params;
  try {
    const hit = await load(token);
    if (!hit) return bad("유효하지 않거나 만료된 링크입니다.", 404);
    const { doc, entry } = hit;
    return NextResponse.json({
      eventName: doc.eventName,
      user: entry.user,
      prize: entry.prize,
      deadline: doc.deadline,
      sizes: doc.sizes,
      submitted: !!(await getSubmission(token)),
      closed: Date.now() > Date.parse(doc.deadline),
    });
  } catch {
    return bad("잠시 후 다시 시도해 주세요.", 500);
  }
}

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return bad("잘못된 요청입니다.");
  try {
    const hit = await load(token);
    if (!hit) return bad("유효하지 않거나 만료된 링크입니다.", 404);
    const { doc } = hit; // 토큰이 유효한 당첨자만 여기까지 온다
    if (Date.now() > Date.parse(doc.deadline)) return bad("신청 기간이 끝났습니다.", 403);
    // 한 번 제출하면 수정할 수 없다(수정이 필요하면 관리자에게 문의).
    if (await getSubmission(token)) return bad("이미 제출하셨습니다. 수정이 필요하면 안내를 보내드린 계정으로 문의해 주세요.", 409);
    if (body.consent !== true) return bad("개인정보 수집·이용에 동의해 주세요.");

    const name = clip(body.name, 40);
    const phone = clip(body.phone, 20).replace(/[^0-9+\-\s]/g, "");
    const addr1 = clip(body.addr1, 200);
    const size = clip(body.size, 30);
    if (!name) return bad("이름을 입력해 주세요.");
    if (phone.replace(/\D/g, "").length < 9) return bad("연락처를 확인해 주세요.");
    if (!addr1) return bad("주소를 입력해 주세요.");
    if (doc.sizes.length > 0 && !doc.sizes.includes(size)) return bad("사이즈를 선택해 주세요.");

    const submitted: ClaimSubmission = {
      name,
      phone,
      addr1,
      addr2: clip(body.addr2, 100),
      size,
      at: new Date().toISOString(),
    };
    await saveSubmission(token, submitted); // 최초 1회만 저장된다
    return NextResponse.json({ ok: true });
  } catch {
    return bad("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
  }
}
