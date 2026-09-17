"use client";
import { useState, useEffect, useRef, Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import { Oxanium } from "next/font/google";
import { useRouter, usePathname } from "next/navigation";
import { DEFAULT_HEADER_NAV, type NavMenuItem } from "@/lib/header-nav";
import { DEFAULT_LOGO, type LogoConfig } from "@/lib/logo";
import { DEFAULT_TOPBAR, safeHref, type TopbarItem } from "@/lib/topbar";
import BrandsMegaMenu from "@/components/BrandsMegaMenu";
import type { MegaBrandsConfig } from "@/lib/mega-brands-types";



const oxanium = Oxanium({ subsets: ["latin"], weight: ["600"] });

type MemberSession = { name: string; grade: string } | null;

export default function Header({
  navItems = DEFAULT_HEADER_NAV.items,
  logo = DEFAULT_LOGO,
  topbarItems = DEFAULT_TOPBAR.items,
  studioEnabled = true,
  megaBrandsConfig,
}: {
  navItems?: NavMenuItem[];
  logo?: LogoConfig;
  topbarItems?: TopbarItem[];
  studioEnabled?: boolean;
  megaBrandsConfig?: MegaBrandsConfig | null;
}) {
  const [memberSession, setMemberSession] = useState<MemberSession>(undefined as unknown as MemberSession);
  const headerRef = useRef<HTMLElement>(null);

  // ── BRANDS 메가메뉴 상태 ──────────────────────────────────────────────────
  const [brandsOpen, setBrandsOpen] = useState(false);
  const brandsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openBrands = () => {
    if (brandsTimerRef.current) clearTimeout(brandsTimerRef.current);
    setBrandsOpen(true);
  };
  const closeBrandsDelayed = () => {
    brandsTimerRef.current = setTimeout(() => setBrandsOpen(false), 120);
  };
  const closeBrandsNow = () => {
    if (brandsTimerRef.current) clearTimeout(brandsTimerRef.current);
    setBrandsOpen(false);
  };
  const router = useRouter();
  const pathname = usePathname();
  // 모바일 상품 상세 페이지에서는 MobileProductNav가 대신 담당
  const hideOnMobile = /^\/products\/[^/]+$/.test(pathname ?? "");
  useEffect(() => {
    fetch("/api/member/me")
      .then(r => r.json())
      .then(data => setMemberSession(data ?? null))
      .catch(() => setMemberSession(null));
  }, [pathname]);

  const white = false;

  // 카탈로그 뷰어처럼 "화면 - 헤더 높이"를 계산하는 곳에서 쓸 수 있게 헤더 실측 높이를 CSS 변수로 공개한다.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const publish = () => {
      document.documentElement.style.setProperty("--wu-header-h", `${el.getBoundingClientRect().height}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ESC 키 + 외부 클릭으로 BRANDS 메가메뉴 닫기
  useEffect(() => {
    if (!brandsOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeBrandsNow(); };
    const handleClick = (e: MouseEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) closeBrandsNow();
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandsOpen]);


  // BRANDS 메가메뉴: megaBrandsConfig가 있고 settings.enabled !== false이면 활성.
  // 헤더 nav에 label="BRANDS" 항목이 있으면 그것을 버튼으로 교체하고, 없으면 nav 끝에 추가한다.
  // BRANDS 메가메뉴: megaBrandsConfig가 있고 settings.enabled !== false이면 활성.
  // 헤더 nav에 BRANDS 항목이 있으면 버튼으로 교체하고, 없으면 nav 끝에 자동 추가된다.
  const hasBrandsMega = !!megaBrandsConfig && megaBrandsConfig.settings?.enabled !== false;

  // ── 로고 / 내비게이션 / 가맹·제휴문의 / 로그인 행 ──
  const topRow = (
    <div className="px-[15px] md:px-[70px]">
      <div className="flex items-center gap-3 h-14 md:h-16">

        {/* 로고 */}
        <Link href="/" className="flex-shrink-0 py-2 active:opacity-50 active:scale-95 transition-[opacity,transform] duration-150">
          <Image src={logo.src} alt={logo.alt} width={130} height={18} className={`h-[14px] w-[100px] md:h-[18px] md:w-[130px] transition-[filter] ${white ? "brightness-0 invert" : ""}`} priority />
        </Link>

        {/* 데스크탑 내비게이션 — navItems 순서 그대로 렌더링, BRANDS 위치에서 메가메뉴 트리거로 교체 */}
        <nav className="hidden md:flex items-center gap-7 flex-1 justify-start ml-[60px]">
          {navItems.map((item) => {
            const isBrands = item.label.toUpperCase() === "BRANDS";
            if (isBrands && hasBrandsMega) {
              return (
                <Link
                  key={item.id}
                  href="/brands"
                  onMouseEnter={openBrands}
                  onMouseLeave={closeBrandsDelayed}
                  className={`group grid place-items-center whitespace-nowrap transition-colors ${
                    brandsOpen ? "text-[#E5541B]" : white ? "text-white" : "text-[#303236]"
                  }`}
                  style={{ fontWeight: 650 }}
                  aria-expanded={brandsOpen}
                  aria-haspopup="true"
                >
                  <span
                    style={{ gridArea: "1 / 1" }}
                    className={`${oxanium.className} text-[17px] leading-none tracking-wide transition-opacity duration-200 group-hover:opacity-0 ${brandsOpen ? "opacity-0" : ""}`}
                  >
                    BRANDS
                  </span>
                  <span
                    style={{ gridArea: "1 / 1", fontWeight: 700 }}
                    className={`text-[14px] leading-none tracking-tighter transition-opacity duration-200 group-hover:opacity-100 ${
                      brandsOpen
                        ? "opacity-100 text-[#E5541B]"
                        : `opacity-0 ${white ? "text-white/80" : "text-gray-500"}`
                    }`}
                  >
                    브랜드
                  </span>
                </Link>
              );
            }
            return (
              <Link
                key={item.id}
                href={item.href}
                target={item.newTab ? "_blank" : undefined}
                rel={item.newTab ? "noopener noreferrer" : undefined}
                onMouseEnter={hasBrandsMega ? closeBrandsNow : undefined}
                className={`group grid place-items-center whitespace-nowrap transition-colors ${white ? "text-white" : "text-[#303236]"}`}
                style={{ fontWeight: 650 }}
              >
                <span
                  style={{ gridArea: "1 / 1" }}
                  className={`${oxanium.className} text-[17px] leading-none tracking-wide transition-opacity duration-200 ${item.labelKo ? "group-hover:opacity-0" : ""}`}
                >
                  {item.label}
                </span>
                {item.labelKo && (
                  <span
                    style={{ gridArea: "1 / 1", fontWeight: 700 }}
                    className={`text-[14px] leading-none tracking-tighter opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${white ? "text-white/80" : "text-gray-500"}`}
                  >
                    {item.labelKo}
                  </span>
                )}
              </Link>
            );
          })}

          {/* BRANDS가 navItems에 없을 때만 메가메뉴 트리거를 끝에 추가 */}
          {hasBrandsMega && !navItems.some(it => it.label.toUpperCase() === "BRANDS") && (
            <Link
              href="/brands"
              onMouseEnter={openBrands}
              onMouseLeave={closeBrandsDelayed}
              className={`group grid place-items-center whitespace-nowrap transition-colors ${
                brandsOpen ? "text-[#E5541B]" : white ? "text-white" : "text-[#303236]"
              }`}
              style={{ fontWeight: 650 }}
              aria-expanded={brandsOpen}
              aria-haspopup="true"
            >
              <span
                style={{ gridArea: "1 / 1" }}
                className={`${oxanium.className} text-[17px] leading-none tracking-wide transition-opacity duration-200 group-hover:opacity-0 ${brandsOpen ? "opacity-0" : ""}`}
              >
                BRANDS
              </span>
              <span
                style={{ gridArea: "1 / 1", fontWeight: 700 }}
                className={`text-[14px] leading-none tracking-tighter transition-opacity duration-200 group-hover:opacity-100 ${
                  brandsOpen ? "opacity-100 text-[#E5541B]" : `opacity-0 ${white ? "text-white/80" : "text-gray-500"}`
                }`}
              >
                브랜드
              </span>
            </Link>
          )}

          {/* 티셔츠 꾸미기 스튜디오 — 관리자에서 활성화 시 노출 */}
          {studioEnabled && (
            <Link
              href="/studio"
              className={`${oxanium.className} flex items-center gap-1.5 text-[15px] text-white bg-[#E5541B] hover:brightness-95 px-3.5 py-1.5 rounded-full transition tracking-wide whitespace-nowrap shadow-sm`}
              style={{ fontWeight: 650 }}
            >
              STUDIO
              <span className="text-[9px] font-bold leading-none bg-white text-[#E5541B] rounded-full px-1 py-[3px]">NEW</span>
            </Link>
          )}
        </nav>

        {/* 가맹/제휴문의 — 기존 상단 탑배너를 없애고 로고 행에 통합 (모바일도 노출, nav가 없을 때는 ml-auto로 우측 정렬) */}
        {topbarItems.length > 0 && (
          <div className={`flex items-center gap-1.5 flex-shrink-0 ml-auto md:ml-0 text-[10px] md:text-[12px] font-semibold whitespace-nowrap ${white ? "text-white/90" : "text-gray-500"}`}>
            {topbarItems.map((it, idx) => {
              const href = safeHref(it.href) || "/";
              const external = !href.startsWith("/") && !href.startsWith("#");
              return (
                <Fragment key={it.id}>
                  {idx > 0 && <span className="opacity-40 select-none">|</span>}
                  {external ? (
                    <a
                      href={href}
                      target={it.newTab ? "_blank" : undefined}
                      rel={it.newTab ? "noopener noreferrer" : undefined}
                      className="hover:text-[#E5541B] transition-colors"
                    >
                      {it.label}
                    </a>
                  ) : (
                    <Link href={href} className="hover:text-[#E5541B] transition-colors">
                      {it.label}
                    </Link>
                  )}
                </Fragment>
              );
            })}
          </div>
        )}

        {/* 회원 버튼 — 데스크탑 전용(모바일은 하단 '마이' 탭으로 이동) */}
        {memberSession ? (
          <Link
            href="/mypage"
            className="hidden md:inline-flex items-center justify-center flex-shrink-0 px-3 py-1.5 rounded-md bg-[#303236] text-white text-[11px] font-semibold tracking-wide whitespace-nowrap hover:bg-[#243d5e] transition-colors"
          >
            마이페이지
          </Link>
        ) : (
          <button
            onClick={() => router.push("/member/login")}
            className="hidden md:inline-flex items-center justify-center flex-shrink-0 px-3 py-1.5 rounded-md bg-[#303236] text-white text-[11px] font-semibold tracking-wide whitespace-nowrap hover:bg-[#243d5e] transition-colors"
          >
            로그인 / 회원가입
          </button>
        )}

      </div>
    </div>
  );

  // BRANDS 메가메뉴 — 두 header 반환부에서 공통으로 쓰이는 패널
  const brandsMegaPanel = hasBrandsMega ? (
    <div
      className={`absolute top-full left-0 right-0 z-40 transition-[opacity,transform] duration-200 ease-out ${
        brandsOpen
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 -translate-y-[6px] pointer-events-none"
      }`}
    >
      <BrandsMegaMenu
          onMouseEnter={openBrands}
          onMouseLeave={closeBrandsDelayed}
          onLinkClick={closeBrandsNow}
          brands={megaBrandsConfig?.brands}
          settings={megaBrandsConfig?.settings}
        />
    </div>
  ) : null;

  return (
    <header
      ref={headerRef}
      className={`relative md:sticky md:top-[var(--wu-topbar-h,36px)] z-50 bg-white border-b border-gray-200${hideOnMobile ? " hidden md:block" : ""}`}
    >
      {topRow}
      {brandsMegaPanel}
    </header>
  );
}
