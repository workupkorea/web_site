import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-server";

// 공개 GET이 막혀선 안 되는 섹션(팝업·기획전·카테고리 등은 클라이언트에서 조회)과 달리,
// 민감 정보가 담긴 섹션은 관리자만 읽을 수 있게 한다.
// admin_favorites: 관리자 UI 개인설정(즐겨찾기) — 관리자만 조회.
// store_status: 지점 현황(담당자 연락처·이메일 등 개인정보 포함) — 관리자만 조회.
// ih_mobile_viewer: 인플루언서 허브 모바일 뷰어의 "로그인 없이 접근" 토큰 — 유출되면 누구나 데이터를 볼 수 있어 관리자만 조회.
const SENSITIVE_SECTIONS = new Set(["notifications", "admin_favorites", "store_status", "ih_mobile_viewer"]);

// 감사로그를 남기지 않는 섹션(관리자 UI 개인설정 등 — 로그 노이즈 방지).
const NO_AUDIT_SECTIONS = new Set(["admin_favorites"]);

// wjumun 연동 전용 섹션 — 암호화된 계정·가맹점 스냅샷(개인정보)이 들어있어
// 이 범용 API로는 읽기/쓰기 모두 막고, /api/admin/wjumun/* 전용 라우트로만 다룬다.
const WJUMUN_PRIVATE_SECTIONS = new Set(["wjumun_credentials", "wjumun_snapshot"]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ section: string }> }
) {
  const { section } = await params;
  if (WJUMUN_PRIVATE_SECTIONS.has(section)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (SENSITIVE_SECTIONS.has(section) && !(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("config")
    .eq("section", section)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data?.config ?? null);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ section: string }> }
) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { section } = await params;
  if (WJUMUN_PRIVATE_SECTIONS.has(section)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const config = await req.json();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("site_settings")
    .upsert({ section, config, updated_at: new Date().toISOString() }, { onConflict: "section" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // 캐시된 섹션(예: 탑바)을 즉시 갱신 — getTopbarConfig 가 tags:["topbar"]로 캐싱됨.
  // Next 16: 라우트 핸들러에서는 revalidateTag(tag, "max") 형태로 호출(updateTag 는 서버액션 전용).
  revalidateTag(section, "max");
  if (!NO_AUDIT_SECTIONS.has(section)) {
    await logAudit({
      action: "update",
      resource: "site-settings",
      resourceLabel: "사이트 설정",
      target: section,
      summary: `사이트 설정 '${section}' 수정`,
    });
  }
  return NextResponse.json({ ok: true });
}
