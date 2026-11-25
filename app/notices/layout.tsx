import { redirect } from "next/navigation";
import { getAdminMember } from "@/lib/admin-auth";
import NoticesChrome from "./_components/NoticesChrome";
import "@/public/admin-ui.css";

// 지점 출고 패스 관리 화면 — 관리자 대시보드(AdminShell) 안에 넣지 않고
// 단독 페이지로 구성한다. 인증은 관리자 대시보드와 동일한 조건(members.grade="관리자")을 그대로 재사용.
export default async function NoticesLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminMember();
  if (!admin) redirect("/member/login?from=notices");

  return <NoticesChrome adminName={admin.name}>{children}</NoticesChrome>;
}
