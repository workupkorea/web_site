// 관리자 인증 — 통합 회원(members) 기반.
// 별도 관리자 로그인 없이, 로그인한 회원(wu-member) 중 grade="관리자" 인 사람만 관리자로 본다.
// 관리자 승급/강등은 /admin/members 에서 등급을 변경해 처리한다.
// (cookies/service-role 키를 쓰므로 서버 컴포넌트·route handler 에서만 import 할 것.)
import { cookies } from "next/headers";
import { createAdminClient } from "./supabase-server";

export const ADMIN_GRADE = "관리자";
export const SUPER_ADMIN_GRADE = "S관리자";

export type AdminMember = {
  id: string | number;
  name: string;
  email: string;
  grade: string;
  status: string;
};

// 현재 요청의 로그인 회원이 관리자면 회원 정보를, 아니면 null 을 반환한다.
export async function getAdminMember(): Promise<AdminMember | null> {
  try {
    const store = await cookies();
    const memberId = store.get("wu-member")?.value;
    if (!memberId) return null;

    const sb = createAdminClient();
    const { data } = await sb
      .from("members")
      .select("id, name, email, grade, status")
      .eq("id", memberId)
      .maybeSingle();

    if (!data || data.status !== "active") return null;
    if (data.grade !== ADMIN_GRADE && data.grade !== SUPER_ADMIN_GRADE) return null;
    return data as AdminMember;
  } catch {
    return null;
  }
}

// 관리자 페이지/ API 보호용 불리언 체크.
export async function isAdmin(): Promise<boolean> {
  return (await getAdminMember()) !== null;
}

// S관리자 전용 체크 (S관리자만 true).
export async function isSuperAdmin(): Promise<boolean> {
  const m = await getAdminMember();
  return m?.grade === SUPER_ADMIN_GRADE;
}
