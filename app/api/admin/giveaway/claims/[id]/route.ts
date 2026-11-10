import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { isSuperAdmin } from "@/lib/admin-auth";
import { deleteClaimDoc, deleteSubmissions, getClaimDoc, getClaimDocWithSubmissions, saveClaimDoc } from "@/lib/giveaway-claims-server";
import { validEventId, type ClaimDoc, type ClaimEntry, type ClaimWinner } from "@/lib/giveaway-claims";

// 관리자 전용: 당첨자 배송 정보 수집 링크 생성·조회·삭제
type Ctx = { params: Promise<{ id: string }> };

const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

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
    const entries: ClaimEntry[] = winners.map((w) => {
      const old = keep.get(w.user.toLowerCase());
      return {
        token: old?.token ?? `${id}-${randomBytes(16).toString("hex")}`,
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

/** 특정 당첨자의 제출 내용만 초기화 — 같은 링크로 다시 입력할 수 있게 된다. */
export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isSuperAdmin())) return bad("Unauthorized", 401);
  const { id } = await params;
  if (!validEventId(id)) return bad("잘못된 ID");
  const body = (await req.json().catch(() => null)) as { token?: string } | null;
  try {
    const doc = await getClaimDoc(id);
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
