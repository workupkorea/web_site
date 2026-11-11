import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { getAdminMember } from "@/lib/admin-auth";
import { searchWjumunItems } from "@/lib/wjumun-sync";

// 품번으로 wjumun 상품(색상·사이즈별 재고·가격)을 조회한다. 관리자 전용 — 원가가 포함되므로 외부 노출 금지.
export const maxDuration = 60;

const CODE_RE = /^[A-Za-z0-9_-]{3,40}$/;

export async function GET(req: Request) {
  if (!(await getAdminMember())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const code = new URL(req.url).searchParams.get("code")?.trim() ?? "";
  if (!CODE_RE.test(code)) return NextResponse.json({ error: "품번 형식이 올바르지 않습니다." }, { status: 400 });
  try {
    return NextResponse.json(await searchWjumunItems(createAdminClient(), code));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "조회에 실패했습니다." }, { status: 500 });
  }
}
