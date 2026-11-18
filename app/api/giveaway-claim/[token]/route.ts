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
    const sub = await getSubmission(token);
    return NextResponse.json({
      eventName: doc.eventName,
      user: entry.user,
      prize: entry.prize,
      deadline: doc.deadline,
      sizes: doc.sizes,
      submitted: !!sub,
      closed: Date.now() > Date.parse(doc.deadline),
      // 마감 전·송장 처리 전까지는 본인이 직접 수정할 수 있다 (본인 링크이므로 본인 제출 내용만 돌려준다)
      locked: !!sub?.lockedAt,
      editCount: sub?.editCount ?? 0,
      submission: sub ? { name: sub.name, phone: sub.phone, addr1: sub.addr1, addr2: sub.addr2, size: sub.size } : null,
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
    // 마감 전까지는 다시 제출해 수정할 수 있다. 단, 송장 처리(잠금) 후에는 수정할 수 없다.
    const before = await getSubmission(token);
    if (before?.lockedAt) return bad("배송 준비(송장 처리)가 시작되어 수정할 수 없습니다. 수정이 필요하면 안내를 보내드린 계정으로 문의해 주세요.", 409);
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
    if (before) {
      // 수정: 이전 내용을 이력에 남기고(최근 5건) 횟수를 올린다
      submitted.editCount = (before.editCount ?? 0) + 1;
      submitted.history = [{ name: before.name, phone: before.phone, addr1: before.addr1, addr2: before.addr2, size: before.size, at: before.at }, ...(before.history ?? [])].slice(0, 5);
    }
    await saveSubmission(token, submitted);
    return NextResponse.json({ ok: true });
  } catch {
    return bad("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
  }
}
