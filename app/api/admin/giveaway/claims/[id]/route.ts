import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { isSuperAdmin } from "@/lib/admin-auth";
import { deleteClaimDoc, deleteSubmissions, getClaimDoc, getClaimDocWithSubmissions, saveClaimDoc, setSubmissionsLocked } from "@/lib/giveaway-claims-server";
import { shortTokenHead, validEventId, type ClaimDoc, type ClaimEntry, type ClaimWinner } from "@/lib/giveaway-claims";

// 관리자 전용: 당첨자 배송 정보 수집 링크 생성·조회·삭제
type Ctx = { params: Promise<{ id: string }> };

const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

// 짧은 링크용 무작위 10자 (헷갈리는 글자 i·l·o·0·1 제외, 약 49비트) — 토큰 자체가 인증이라 추측하기 어려운 값이어야 한다.
const SHORT_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
function shortToken(eventId: string): string {
  const head = shortTokenHead(eventId);
  if (!head) return `${eventId}-${randomBytes(16).toString("hex")}`; // 숫자 ID가 아니면 예전 형식
  const bytes = randomBytes(10);
  let tail = "";
  for (let i = 0; i < 10; i++) tail += SHORT_ALPHABET[bytes[i] % SHORT_ALPHABET.length];
  return `${head}-${tail}`;
}

export async function GET(_req: Request, { params }: Ctx) {
  if (!(await isSuperAdmin())) return bad("Unauthorized", 401);
  const { id } = await params;
  if (!validEventId(id)) return bad("잘못된 ID");
  try {
    return NextResponse.json({ doc: await getClaimDocWithSubmissions(id) });
  } catch (e) {
    return bad((e as Error).message, 500);
  }
}

/** 링크 생성/갱신. 이미 있는 당첨자는 토큰·제출 내용을 유지하고, 새 당첨자는 새 토큰을 받고, 빠진 당첨자는 제거된다. */
export async function PUT(req: Request, { params }: Ctx) {
  if (!(await isSuperAdmin())) return bad("Unauthorized", 401);
  const { id } = await params;
  if (!validEventId(id)) return bad("잘못된 ID");
  const body = (await req.json().catch(() => null)) as {
    eventName?: string;
    deadline?: string;
    sizes?: unknown;
    winners?: unknown;
    /** true 면 아직 제출하지 않은 당첨자의 링크를 짧은 형식으로 다시 발급한다(이미 제출한 사람은 기존 링크 유지) */
    reissueShort?: boolean;
  } | null;
  if (!body || !Array.isArray(body.winners) || !body.winners.length) return bad("당첨자가 없습니다.");
  const deadline = Date.parse(String(body.deadline || ""));
  if (Number.isNaN(deadline)) return bad("마감 일시를 확인해 주세요.");
  const sizes = Array.isArray(body.sizes)
    ? [...new Set((body.sizes as unknown[]).map((s) => String(s).trim()).filter(Boolean))].slice(0, 30)
    : [];
  const winners = (body.winners as ClaimWinner[])
    .filter((w) => w && typeof w.user === "string" && /^[A-Za-z0-9._]{1,30}$/.test(w.user))
    .slice(0, 300);
  if (!winners.length) return bad("당첨자 아이디를 확인해 주세요.");

  try {
    const prev = await getClaimDoc(id);
    const keep = new Map((prev?.entries ?? []).map((e) => [e.user.toLowerCase(), e] as const));
    // 재발급 대상: 짧은 형식이 아니고 아직 제출하지 않은 당첨자만
    const submittedTokens = new Set<string>();
    if (body.reissueShort && prev) {
      const withSubs = await getClaimDocWithSubmissions(id);
      for (const e of withSubs?.entries ?? []) if (e.submitted) submittedTokens.add(e.token);
    }
    const entries: ClaimEntry[] = winners.map((w) => {
      const old = keep.get(w.user.toLowerCase());
      const reissue = !!body.reissueShort && !!old && !old.token.startsWith("k") && !submittedTokens.has(old.token) && !!shortTokenHead(id);
      return {
        token: old && !reissue ? old.token : shortToken(id),
        user: w.user,
        prize: String(w.prize || "").slice(0, 80),
        label: String(w.label || "").slice(0, 80),
      };
    });
    const doc: ClaimDoc = {
      eventId: id,
      eventName: String(body.eventName || "").slice(0, 100),
      deadline: new Date(deadline).toISOString(),
      sizes,
      createdAt: prev?.createdAt ?? new Date().toISOString(),
      entries,
    };
    await saveClaimDoc(doc);
    // 더 이상 당첨자가 아닌 사람의 제출 내용은 삭제
    const still = new Set(entries.map((e) => e.token));
    await deleteSubmissions((prev?.entries ?? []).filter((e) => !still.has(e.token)).map((e) => e.token));
    return NextResponse.json({ doc: await getClaimDocWithSubmissions(id) });
  } catch (e) {
    return bad((e as Error).message, 500);
  }
}

/**
 * 당첨자 한 명(또는 여러 명) 처리:
 *  - 기본(action 없음): 제출 내용 초기화 — 같은 링크로 다시 입력할 수 있게 된다.
 *  - action "lock": 송장 처리 — 잠가서 당첨자가 링크에서 더 수정하지 못하게 한다. (tokens 여러 명 가능)
 *  - action "unlock": 잠금 해제 — 다시 마감 전까지 수정할 수 있게 한다.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isSuperAdmin())) return bad("Unauthorized", 401);
  const { id } = await params;
  if (!validEventId(id)) return bad("잘못된 ID");
  const body = (await req.json().catch(() => null)) as { token?: string; tokens?: string[]; action?: string } | null;
  try {
    const doc = await getClaimDoc(id);
    if (body?.action === "lock" || body?.action === "unlock") {
      const own = new Set((doc?.entries ?? []).map((e) => e.token));
      const tokens = (body.tokens ?? (body.token ? [body.token] : [])).filter((t) => own.has(t));
      if (!tokens.length) return bad("대상을 찾을 수 없습니다.", 404);
      await setSubmissionsLocked(tokens, body.action === "lock");
      return NextResponse.json({ doc: await getClaimDocWithSubmissions(id) });
    }
    // 이 이벤트의 당첨자 토큰만 허용 (임의 토큰 삭제 방지)
    if (!body?.token || !doc?.entries.some((e) => e.token === body.token)) return bad("대상을 찾을 수 없습니다.", 404);
    await deleteSubmissions([body.token]);
    return NextResponse.json({ doc: await getClaimDocWithSubmissions(id) });
  } catch (e) {
    return bad((e as Error).message, 500);
  }
}

/** 개인정보 파기: 문서 전체(링크 + 제출 내용) 삭제 */
export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isSuperAdmin())) return bad("Unauthorized", 401);
  const { id } = await params;
  if (!validEventId(id)) return bad("잘못된 ID");
  try {
    await deleteClaimDoc(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return bad((e as Error).message, 500);
  }
}
