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
    return <div className="min-h-screen bg-[#f7f7f5] px-3 py-4 lg:px-6 lg:py-6">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <header className="bg-white border-b border-gray-200">
        <div className="px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between gap-2">
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
              className={`flex items-center justify-center px-2 min-h-[44px] rounded-lg text-[13px] font-medium whitespace-nowrap ${
                pathname.startsWith(t.href) && t.href !== "/notices" ? "bg-[#303236] text-white" : "text-gray-600 bg-white border border-gray-200"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}
      <main className="px-3 py-4 lg:px-6 lg:py-8">{children}</main>
    </div>
  );
}
