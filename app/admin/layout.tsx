import { redirect } from "next/navigation";
import Link from "next/link";
import AdminShellGate from "@/components/AdminShellGate";
import AdminLogoutButton from "@/components/AdminLogoutButton";
import VercelStatusBadge from "@/components/VercelStatusBadge";
import { getAdminMember, SUPER_ADMIN_GRADE } from "@/lib/admin-auth";
import "@/public/admin-ui.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 통합 회원 인증: 로그인한 회원 중 grade="관리자" 인 경우만 접근 허용.
  const admin = await getAdminMember();
  if (!admin) {
    redirect("/member/login?from=admin");
  }
  const superAdmin = admin.grade === SUPER_ADMIN_GRADE;
  return (
    <div className="admin-ui min-h-screen flex flex-col">
      {/* 상단 헤더 */}
      <header className="bg-[var(--admin-ink)] h-12 flex items-center justify-between px-3 sm:px-6 flex-shrink-0 z-20 border-b border-white/5">
        <div className="flex items-center gap-3 sm:gap-5">
          <Link href="/admin" className="flex items-center gap-3 group" title="대시보드로 이동">
            <div className="w-8 h-8 bg-[var(--admin-accent)] flex items-center justify-center">
              <span className="text-white text-[13px] font-black tracking-tight">WU</span>
            </div>
            <p className="text-white font-bold text-base tracking-wide leading-none group-hover:text-blue-300 transition-colors">WORKUP</p>
          </Link>
          <Link href="/admin/promotions/entries" className="inline-flex min-h-11 items-center whitespace-nowrap px-1 text-sm font-semibold text-slate-200 hover:text-white">
            프로모션
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {superAdmin && <VercelStatusBadge />}
          <span className="text-slate-400 text-sm hidden sm:inline">
            {admin.name} <span className="text-slate-600">·</span>{" "}
            {superAdmin
              ? <span className="text-amber-400 font-bold">S관리자</span>
              : "관리자"}
          </span>
          <a
            href="/"
            target="_blank"
            aria-label="사이트 미리보기"
            className="flex items-center gap-2 text-slate-400 text-sm hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span className="hidden sm:inline">사이트 미리보기</span>
          </a>
          <AdminLogoutButton />
        </div>
      </header>

      {/* 본문 */}
      <div className="flex flex-1 overflow-hidden">
        <AdminShellGate superAdmin={superAdmin}>{children}</AdminShellGate>
      </div>
    </div>
  );
}
