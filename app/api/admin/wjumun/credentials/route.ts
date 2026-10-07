import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-server";
import { deleteCredentials, getCredentialInfo, saveCredentials } from "@/lib/wjumun-sync";

// wjumun 관리자 계정 — 비밀번호는 응답에 절대 포함하지 않는다(저장 여부만 반환).
const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const fail = (e: unknown) =>
  NextResponse.json({ error: e instanceof Error ? e.message : "처리 중 오류가 발생했습니다." }, { status: 500 });

export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  try {
    return NextResponse.json(await getCredentialInfo(createAdminClient()));
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { userid?: string; password?: string };
  const userid = (body.userid ?? "").trim();
  if (!userid) return NextResponse.json({ error: "아이디를 입력해 주세요." }, { status: 400 });
  try {
    await saveCredentials(createAdminClient(), userid, body.password || undefined);
    await logAudit({
      action: "update",
      resource: "wjumun-credentials",
      resourceLabel: "wjumun 계정",
      summary: "wjumun 관리자 계정 정보 저장",
    });
    return NextResponse.json(await getCredentialInfo(createAdminClient()));
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE() {
  if (!(await isAdmin())) return unauthorized();
  try {
    await deleteCredentials(createAdminClient());
    await logAudit({
      action: "delete",
      resource: "wjumun-credentials",
      resourceLabel: "wjumun 계정",
      summary: "wjumun 관리자 계정 정보 삭제",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
