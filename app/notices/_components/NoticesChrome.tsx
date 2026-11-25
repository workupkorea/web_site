"use client";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import LogoutLink from "./LogoutLink";

// embed=1로 열리면(모아보기 페이지의 iframe 안) 헤더 없이 내용만 렌더링한다 — 이중 헤더 방지.
// 모바일에서는 "지점 링크 관리"·"통계"를 iframe이 아니라 페이지로 직접 열기 때문에(/notices 의 탭 참고)
// 그 페이지들 상단에 탭 이동 줄을 보여준다.
const MOBILE_TABS = [
  { href: "/notices", label: "공지 & 현황" },
  { href: "/notices/stores", label: "지점 링크 관리" },
  { href: "/notices/stats", label: "통계" },
];

export default function NoticesChrome({ children, adminName }: { children: React.ReactNode; adminName: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const showMobileTabs = pathname.startsWith("/notices/stores") || pathname.startsWith("/notices/stats");
  const embed = searchParams.get("embed") === "1";

  if (embed) {
    return <div className="admin-ui min-h-screen px-3 py-3 lg:px-5">{children}</div>;
  }

  return (
    <div className="admin-ui min-h-screen">
      <header className="border-b border-[var(--admin-line)] bg-white">
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 lg:px-5">
          <Link href="/notices" className="flex items-center gap-2">
            <span className="text-[15px] font-black tracking-tight text-[#303236]">WORKUP</span>
            <span className="text-[13px] text-gray-400">· 지점 출고 패스</span>
          </Link>
          <div className="flex items-center gap-3 lg:gap-4 whitespace-nowrap">
            <span className="text-sm text-gray-400 hidden sm:inline">{adminName}</span>
            <Link href="/admin" className="text-sm text-gray-500 hover:text-[#303236] transition-colors">
              관리자 대시보드
            </Link>
            <LogoutLink />
          </div>
        </div>
      </header>
      {showMobileTabs && (
        <nav className="lg:hidden grid grid-cols-3 gap-1.5 px-3 pt-3">
          {MOBILE_TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`flex items-center justify-center px-2 min-h-[44px] text-[13px] font-medium whitespace-nowrap ${
                pathname.startsWith(t.href) && t.href !== "/notices" ? "bg-[var(--admin-accent)] text-white" : "text-slate-600 bg-white border border-[var(--admin-line)]"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}
      <main className="px-3 py-3 lg:px-5">{children}</main>
    </div>
  );
}
