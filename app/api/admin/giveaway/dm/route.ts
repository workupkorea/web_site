import { NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/admin-auth";
import { sendPrivateReply } from "@/lib/giveaway";

// 당첨자 DM 자동 발송(댓글 비공개 답장). 한 번에 여러 명을 순서대로 보내고 사람별 결과를 돌려준다.
// 토큰은 서버 안에서만 쓰이며 응답/로그에 포함하지 않는다.
export const maxDuration = 60;

const MAX_ITEMS = 100;

export async function POST(req: Request) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = (process.env.IG_GIVEAWAY_TOKEN || "").trim();
  if (!token) return NextResponse.json({ error: "서버에 IG_GIVEAWAY_TOKEN이 설정되지 않았습니다." }, { status: 400 });
  const igId = (process.env.IG_GIVEAWAY_ACCOUNT_ID || "").trim();

  const body = (await req.json().catch(() => null)) as { items?: { user?: string; commentId?: string; text?: string }[] } | null;
  const items = Array.isArray(body?.items) ? body!.items!.slice(0, MAX_ITEMS) : [];
  if (!items.length) return NextResponse.json({ error: "보낼 대상이 없습니다." }, { status: 400 });

  const results: { user: string; ok: boolean; error?: string }[] = [];
  for (const it of items) {
    const user = String(it.user || "");
    const commentId = String(it.commentId || "").trim();
    const text = String(it.text || "").trim();
    if (!commentId) {
      results.push({ user, ok: false, error: "댓글 ID가 없습니다 — 댓글을 다시 불러온 뒤 시도해 주세요." });
      continue;
    }
    if (!text || text.length > 1000) {
      results.push({ user, ok: false, error: "메시지가 비었거나 1000자를 넘습니다." });
      continue;
    }
    try {
      await sendPrivateReply({ token, igId, commentId, text });
      results.push({ user, ok: true });
    } catch (e) {
      const m = e instanceof Error ? e.message : "발송 실패";
      results.push({ user, ok: false, error: m.split(token).join("***") });
    }
    await new Promise((r) => setTimeout(r, 400)); // 과도한 연속 호출 방지
  }
  return NextResponse.json({ results });
}
