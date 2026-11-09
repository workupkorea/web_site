import { NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/admin-auth";
import { fetchInstagramComments, listInstagramMedia } from "@/lib/giveaway";

// 댓글이 많으면 페이지 단위 호출이 길어질 수 있어 여유를 둔다.
export const maxDuration = 60;

/**
 * 추첨기 전용 서버 토큰.
 *  - IG_GIVEAWAY_TOKEN       : 인스타그램 액세스 토큰 (필수)
 *  - IG_GIVEAWAY_ACCOUNT_ID  : 인스타그램 계정 ID (Facebook 로그인 방식 토큰일 때만)
 * 토큰은 서버 안에서만 쓰이며 응답/로그에 포함하지 않는다.
 */
const serverToken = () => (process.env.IG_GIVEAWAY_TOKEN || "").trim();
const serverAccountId = () => (process.env.IG_GIVEAWAY_ACCOUNT_ID || "").trim();

/** 서버에 토큰이 설정돼 있는지만 알려준다 (값은 반환하지 않음) */
export async function GET() {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ configured: serverToken().length > 0 });
}

export async function POST(req: Request) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = serverToken();
  if (!token) {
    return NextResponse.json({ error: "서버에 IG_GIVEAWAY_TOKEN이 설정되지 않았습니다." }, { status: 400 });
  }
  try {
    const body = (await req.json()) as { action?: string; url?: string; includeReplies?: boolean };
    // 추첨할 게시물을 고르기 위한 최근 게시물 목록
    if (body.action === "media") {
      const media = await listInstagramMedia({ token, igId: serverAccountId(), limit: 30 });
      return NextResponse.json({ media });
    }
    const comments = await fetchInstagramComments({
      url: String(body.url || ""),
      token,
      igId: serverAccountId(),
      includeReplies: !!body.includeReplies,
      onProgress: () => {},
    });
    return NextResponse.json({ comments });
  } catch (e: unknown) {
    // Graph API 오류 메시지에는 토큰이 포함되지 않지만, 방어적으로 한 번 더 제거한다.
    const m = e instanceof Error ? e.message : "댓글을 불러오지 못했습니다.";
    return NextResponse.json({ error: m.split(token).join("***") }, { status: 502 });
  }
}
