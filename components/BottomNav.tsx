"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DEFAULT_HEADER_NAV, type NavMenuItem } from "@/lib/header-nav";
import { useCart } from "@/contexts/CartContext";
import { BRANDS } from "@/lib/brands-data";
import { trackNavClick } from "@/lib/track";

type MemberSession = { name: string; grade: string } | null;

export default function BottomNav({
  navItems = DEFAULT_HEADER_NAV.items,
  studioEnabled = true,
}: {
  navItems?: NavMenuItem[];
  studioEnabled?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [brandsExpanded, setBrandsExpanded] = useState(false);
  const pathname = usePathname();
  // 상단 헤더의 회원 아이콘을 모바일에서는 이 하단 '마이' 탭으로 대체한다.
  const [memberSession, setMemberSession] = useState<MemberSession>(undefined as unknown as MemberSession);
  // 찜(장바구니)에 담긴 상품이 있을 때만 '마이' 탭에 주황 점을 표시한다.
  const { count } = useCart();

  useEffect(() => {
    fetch("/api/member/me")
      .then(r => r.json())
      .then(data => setMemberSession(data ?? null))
      .catch(() => setMemberSession(null));
  }, [pathname]);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setBrandsExpanded(false);
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <>
      {/* 백드롭 */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[58] bg-black/50 transition-opacity duration-300 md:hidden ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMenuOpen(false)}
      />

      {/* 바텀시트 */}
      <div
        className="fixed left-0 right-0 z-[59] bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)] transition-transform duration-300 ease-out md:hidden"
        style={{
          bottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
          transform: menuOpen ? "translateY(0)" : "translateY(110%)",
        }}
        aria-modal="true"
        role="dialog"
      >
        <div className="flex justify-center pt-3.5 pb-2">
          <div className="w-9 h-1 bg-gray-300 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
          <span className="text-[11px] font-bold text-[#303236] tracking-[0.2em]">MENU</span>
          <button
            onClick={() => setMenuOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            aria-label="닫기"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="px-6 pb-4 pt-1">
          {studioEnabled && (
            <div
              className="border-b border-gray-100 transition-[opacity,transform] duration-300 ease-out"
              style={{
                transitionDelay: menuOpen ? "90ms" : "0ms",
                opacity: menuOpen ? 1 : 0,
                transform: menuOpen ? "translateY(0)" : "translateY(10px)",
              }}
            >
              <Link
                href="/studio"
                className="flex items-center justify-between py-4 text-[13px] font-bold text-[#E5541B] tracking-[0.15em] transition-transform active:scale-[0.97]"
                onClick={() => setMenuOpen(false)}
              >
                <span className="flex items-center gap-2">
                  STUDIO
                  <span className="text-[9px] tracking-[0.15em] text-[#E5541B]">NEW</span>
                  <span className="text-[11px] font-medium text-gray-400 tracking-normal">티셔츠 꾸미기</span>
                </span>
                <svg className="w-3.5 h-3.5 text-[#E5541B]/60" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            </div>
          )}
          {navItems.map((item, i) => {
            const isBrands = item.label.toUpperCase() === "BRANDS";
            return (
              <div
                key={item.id}
                className="border-b border-gray-100 last:border-0 transition-[opacity,transform] duration-300 ease-out"
                style={{
                  transitionDelay: menuOpen ? `${i * 45 + 120}ms` : "0ms",
                  opacity: menuOpen ? 1 : 0,
                  transform: menuOpen ? "translateY(0)" : "translateY(10px)",
                }}
              >
                {isBrands ? (
                  /* BRANDS — 아코디언 */
                  <div>
                    <button
                      onClick={() => setBrandsExpanded((v) => !v)}
                      className="flex items-center justify-between w-full py-4 text-[#303236] active:text-[#E5541B] transition-colors"
                    >
                      <span className="flex items-baseline gap-3">
                        <span className="text-[13px] font-semibold tracking-[0.15em]">BRANDS</span>
                        {item.labelKo && (
                          <span className="text-[11px] font-normal tracking-normal text-gray-400">
                            <span className="text-gray-300 mr-1">/</span>{item.labelKo}
                          </span>
                        )}
                      </span>
                      <svg
                        className={`w-3.5 h-3.5 text-gray-300 transition-transform duration-200 ${brandsExpanded ? "rotate-90" : ""}`}
                        fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                    {brandsExpanded && (
                      <div className="pb-3">
                        <Link
                          href="/catalog"
                          onClick={() => { setBrandsExpanded(false); setMenuOpen(false); }}
                          className="block text-[11px] text-[#E5541B] font-medium tracking-wide py-2 border-t border-gray-50"
                        >
                          브랜드 전체 보기 →
                        </Link>
                        {BRANDS.map((brand) => (
                          <Link
                            key={brand.id}
                            href={brand.href}
                            onClick={() => { setBrandsExpanded(false); setMenuOpen(false); }}
                            className="flex items-center gap-3 py-3 border-t border-gray-50 active:bg-gray-50 transition-colors"
                          >
                            <span className="text-[9px] font-semibold text-[#E5541B] flex-shrink-0 w-4">
                              {brand.index}
                            </span>
                            <div>
                              <div className="text-[12px] font-semibold tracking-[0.10em] text-[#303236]">
                                {brand.name}
                              </div>
                              <div className="text-[9px] text-gray-400 tracking-[0.12em] uppercase mt-0.5">
                                {brand.positioning}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* 일반 링크 */
                  <Link
                    href={item.href}
                    target={item.newTab ? "_blank" : undefined}
                    rel={item.newTab ? "noopener noreferrer" : undefined}
                    className="flex items-center justify-between py-4 text-[#303236] hover:text-[#E5541B] active:text-[#E5541B] transition-[color,transform] active:scale-[0.97]"
                    onClick={() => {
                      trackNavClick(item.labelKo ?? item.label, item.href, !!item.newTab);
                      setMenuOpen(false);
                    }}
                  >
                    <span className="flex items-baseline gap-3">
                      <span className="text-[13px] font-semibold tracking-[0.15em]">{item.label}</span>
                      {item.labelKo && (
                        <span className="text-[11px] font-normal tracking-normal text-gray-400">
                          <span className="text-gray-300 mr-1">/</span>{item.labelKo}
                        </span>
                      )}
                    </span>
                    <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                    </svg>
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* 하단 네비게이션 바 */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[60] bg-white border-t border-gray-200 md:hidden"
        style={{
          height: "calc(64px + env(safe-area-inset-bottom, 0px))",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex h-full">

          {/* 메뉴 */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 touch-manipulation transition-[color,background-color,transform] active:scale-95 active:bg-gray-100 ${
              menuOpen ? "text-[#E5541B]" : "text-[#666666]"
            }`}
            aria-label="메뉴"
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
            <span className="text-[10px] font-semibold leading-none tracking-tight">메뉴</span>
          </button>

          {/* 홈 */}
          <Link
            href="/"
            className="flex-1 flex flex-col items-center justify-center gap-1 text-[#666666] touch-manipulation transition-[background-color,transform] active:scale-95 active:bg-gray-100"
            aria-label="홈"
            onClick={() => setMenuOpen(false)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
            </svg>
            <span className="text-[10px] font-semibold leading-none tracking-tight">홈</span>
          </Link>

          {/* 매장 */}
          <Link
            href="/store"
            className="flex-1 flex flex-col items-center justify-center gap-1 text-[#666666] touch-manipulation transition-[background-color,transform] active:scale-95 active:bg-gray-100"
            aria-label="매장"
            onClick={() => setMenuOpen(false)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
            </svg>
            <span className="text-[10px] font-semibold leading-none tracking-tight">매장</span>
          </Link>

          {/* 스토어 — 네이버 브랜드스토어 (새 창) */}
          <a
            href="https://brand.naver.com/workup_offcial"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex flex-col items-center justify-center gap-1 text-[#666666] touch-manipulation transition-[background-color,transform] active:scale-95 active:bg-gray-100"
            aria-label="스토어 (새 창)"
            onClick={() => setMenuOpen(false)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 10a4 4 0 01-8 0" />
            </svg>
            <span className="text-[10px] font-semibold leading-none tracking-tight">스토어</span>
          </a>

          {/* 마이 — PC 헤더의 회원 아이콘을 모바일에서는 이 탭으로 대체 */}
          <Link
            href={memberSession ? "/mypage" : "/member/login"}
            className="flex-1 flex flex-col items-center justify-center gap-1 text-[#666666] touch-manipulation transition-[background-color,transform] active:scale-95 active:bg-gray-100"
            aria-label={memberSession ? "마이페이지" : "로그인"}
            onClick={() => setMenuOpen(false)}
          >
            <span className="relative">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
              </svg>
              {count > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-[#E5541B] rounded-full" />
              )}
            </span>
            <span className="text-[10px] font-semibold leading-none tracking-tight">마이</span>
          </Link>

        </div>
      </nav>
    </>
  );
}
