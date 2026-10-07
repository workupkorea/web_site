import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase-server";
import { getAdminMember } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-server";
import { applySync, buildPreview, getLastSync, recordCheck, STATUS_SECTION } from "@/lib/wjumun-sync";

// wjumun 동기화 — 두 단계.
//  1) { action: "preview" }            : 가져와서 이전 데이터와 비교만 한다(저장 없음).
//  2) { action: "apply", hash }        : 관리자가 변경 내역을 확인·승인했을 때만 반영한다.
//  3) { action: "record", hash }       : 변경이 없을 때, 확인한 사람·일시만 기록한다(데이터 변경 없음).
export const maxDuration = 60;

// 마지막 동기화(누가, 언제) — 지점 링크 관리 화면의 버튼 옆 표시용.
export async function GET() {
  if (!(await getAdminMember())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await getLastSync(createAdminClient()));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "조회에 실패했습니다." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await getAdminMember();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; hash?: string };
  const sb = createAdminClient();

  try {
    if (body.action === "preview") {
      return NextResponse.json(await buildPreview(sb));
    }
    if (body.action === "apply" && body.hash) {
      const result = await applySync(sb, body.hash, admin.name);
      if (result.stale) {
        return NextResponse.json(
          { error: "확인 이후 wjumun 데이터가 바뀌었습니다. 변경사항을 다시 확인해 주세요." },
          { status: 409 },
        );
      }
      revalidateTag(STATUS_SECTION, "max");
      await logAudit({
        action: "update",
        resource: "wjumun-sync",
        resourceLabel: "wjumun 동기화",
        summary: `wjumun 동기화 승인 — ${result.applied}개 지점 반영, 일괄출고금지점 ${result.bulk}곳`,
      });
      return NextResponse.json({ ok: true, applied: result.applied, bulk: result.bulk, syncedAt: result.syncedAt, syncedBy: result.syncedBy });
    }
    if (body.action === "record" && body.hash) {
      const result = await recordCheck(sb, body.hash, admin.name);
      if (result.stale) {
        return NextResponse.json(
          { error: "확인 이후 wjumun 데이터가 바뀌었습니다. 변경사항을 다시 확인해 주세요." },
          { status: 409 },
        );
      }
      await logAudit({
        action: "update",
        resource: "wjumun-sync",
        resourceLabel: "wjumun 동기화",
        summary: "wjumun 동기화 확인 — 변경 없음",
      });
      return NextResponse.json({ ok: true, syncedAt: result.syncedAt, syncedBy: result.syncedBy });
    }
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "동기화 중 오류가 발생했습니다." }, { status: 500 });
  }
}
