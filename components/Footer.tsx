"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { normalizeFooter, type FooterConfig, type FooterSocialLink } from "@/lib/site-content";
import { DEFAULT_LOGO, type LogoConfig } from "@/lib/logo";
import { ikSrc } from "@/lib/imageSrc";


// 플랫폼별 내장 SVG 아이콘. 여기에 없는 플랫폼(custom 등)은 등록한 iconUrl 이미지를 사용한다.
const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  instagram: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  youtube: (
    <svg width="24" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  kakao: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3C6.477 3 2 6.582 2 11c0 2.7 1.56 5.087 3.938 6.574L5 21l4.187-2.201C9.758 18.927 10.865 19 12 19c5.523 0 10-3.582 10-8s-4.477-8-10-8z" />
    </svg>
  ),
  naver: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.273 12.845 7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845z" />
    </svg>
  ),
  facebook: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  x: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  ),
  threads: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.291 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.475 9.473c.997-1.49 2.605-2.31 4.522-2.31h.039c3.21.024 5.121 2.003 5.317 5.46.111.062.221.124.331.187 1.539.93 2.654 2.341 3.151 3.971.665 2.158.5 5.59-2.243 8.28-2.066 2.029-4.604 2.957-7.857 2.97l-.586-.001z" />
    </svg>
  ),
  tiktok: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  ),
};

// 일반 링크(아이콘 미등록 시) fallback 아이콘
const GenericLinkIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

function SocialIcon({ social }: { social: FooterSocialLink }) {
  const builtin = SOCIAL_ICONS[social.platform];
  if (builtin) return <>{builtin}</>;
  if (social.iconUrl) {
    // 직접 등록한 외부 아이콘은 next/image 도메인 설정 없이 쓰도록 일반 img 사용
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={ikSrc(social.iconUrl, 64)} alt="" width={22} height={22} className="w-[22px] h-[22px] object-contain" />;
  }
  return <>{GenericLinkIcon}</>;
}

export default function Footer({ config, logo }: { config?: FooterConfig | null; logo?: LogoConfig | null }) {
  // config 가 정규화되지 않았거나 일부 필드(socialLinks/navLinks 등)가 빠진
  // 옛 캐시 데이터로 전달돼도 안전하도록, 컴포넌트 진입 시 항상 정규화한다.
  const c = normalizeFooter(config);
  const lg = logo ?? DEFAULT_LOGO;
  const [bizOpen, setBizOpen] = useState(false);

  const socials = c.socialLinks.filter((s) => s.href && s.href.trim());

  const bizInfo = (
    <>
      <p>상호명 : {c.company_name}</p>
      <p>대표 : {c.ceo}</p>
      <p>주소 : {c.address}</p>
      <p>사업자등록번호 : {c.biz_no}</p>
      <p>통신판매업 신고번호 : {c.mail_order_no}</p>
    </>
  );

  return (
    <footer className="bg-white border-t border-gray-200">

      {/* ── 상단 링크 바 + TOP 버튼 ── */}
      <div className="border-b border-gray-100">
        <div className="px-[15px] md:px-[70px] py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#303236] transition-colors tracking-widest self-end md:order-last flex-shrink-0"
            aria-label="맨 위로"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
            TOP
          </button>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:gap-x-7">
            <Link href="/story" className="text-[11px] md:text-[12px] text-gray-600 hover:text-[#303236] transition-colors whitespace-nowrap">
              About WORKUP
            </Link>
            <Link href="/store" className="text-[11px] md:text-[12px] text-gray-600 hover:text-[#303236] transition-colors whitespace-nowrap">
              매장안내
            </Link>
            <Link href="/terms" className="text-[11px] md:text-[12px] text-gray-600 hover:text-[#303236] transition-colors whitespace-nowrap">
              이용약관
            </Link>
            <Link href="/privacy" className="text-[11px] md:text-[12px] font-bold text-gray-800 hover:text-[#303236] transition-colors whitespace-nowrap">
              개인정보처리방침
            </Link>
          </div>
        </div>
      </div>

      {/* ══ 데스크탑 푸터 (md 이상) ══ */}
      <div className="hidden md:block px-[70px] py-12">
        <div className="grid grid-cols-3 gap-16">

          {/* 열 1: 로고 + 내비 */}
          <div>
            <Link href="/" className="inline-block mb-8">
              <Image src={lg.src} alt={lg.alt} width={100} height={14} className="h-[14px] w-[100px] opacity-50" />
            </Link>
            <nav className="flex flex-col gap-[18px]">
              {c.navLinks.map((item) => (
                <Link key={item.id} href={item.href}
                  className="text-[15px] text-[#303236] hover:opacity-50 transition-opacity leading-none">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* 열 2: 회사 정보 + 임직원 인증 + 소셜 */}
          <div className="flex flex-col">
            <div className="text-[12px] text-gray-500 leading-[1.9]">{bizInfo}</div>
            <Link href="/admin"
              className="mt-3 text-[11px] text-gray-400 hover:text-[#303236] transition-colors inline-block">
              임직원 인증
            </Link>
            {socials.length > 0 && (
              <div className="flex items-center gap-5 mt-7">
                {socials.map((s) => (
                  <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label || s.platform}
                    className="text-gray-500 hover:text-[#303236] transition-colors">
                    <SocialIcon social={s} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* 열 3: 고객센터 */}
          <div>
            <p className="text-[12px] text-gray-500 mb-1">고객센터</p>
            <p className="text-[22px] font-bold text-[#303236] mb-3">{c.cs_phone}</p>
            <div className="text-[12px] text-gray-500 leading-[1.9]">
              <p>{c.cs_hours_weekday}</p>
              <p>{c.cs_hours_weekend}</p>
            </div>
            <Link href="/support" className="mt-4 inline-block text-[12px] font-semibold text-[#E5541B] hover:underline">
              1:1 문의하기 →
            </Link>
          </div>

        </div>
      </div>

      {/* ══ 모바일 푸터 (md 미만) ══ */}
      <div className="md:hidden px-[15px] py-8">
        <Link href="/" className="inline-block mb-6">
          <Image src={lg.src} alt={lg.alt} width={100} height={14} className="h-[14px] w-[100px] opacity-50" />
        </Link>

        <nav className="flex flex-col gap-4 mb-6">
          {c.navLinks.map((item) => (
            <Link key={item.id} href={item.href} className="text-[14px] text-[#303236]">
              {item.id === "nav-cs" ? `${item.label} ${c.cs_phone}` : item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-gray-200">
          <button
            onClick={() => setBizOpen(!bizOpen)}
            className="w-full flex items-center justify-center gap-1.5 py-4"
          >
            <span className="text-[13px] text-gray-600">{c.company_name} 사업자정보</span>
            <svg
              className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${bizOpen ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {bizOpen && (
            <div className="pb-6">
              <div className="text-[12px] text-gray-500 leading-[2] mb-3">{bizInfo}</div>
              <Link href="/admin"
                className="block text-[12px] text-gray-400 hover:text-[#303236] transition-colors mb-5">
                임직원 인증
              </Link>

              {socials.length > 0 && (
                <div className="flex items-center gap-5 mb-5">
                  {socials.map((s) => (
                    <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label || s.platform} className="text-gray-500">
                      <SocialIcon social={s} />
                    </a>
                  ))}
                </div>
              )}

              <div className="text-[12px] text-gray-500 leading-[1.9]">
                <p className="font-semibold text-[#303236] text-[13px] mb-1">
                  고객센터 <span className="font-bold">{c.cs_phone}</span>
                </p>
                <p>{c.cs_hours_weekday}</p>
                <p>{c.cs_hours_weekend}</p>
                <Link href="/support" className="mt-2 inline-block text-[12px] font-semibold text-[#E5541B]">
                  1:1 문의하기 →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 카피라이트 ── */}
      <div className="border-t border-gray-100 px-[15px] md:px-[70px] py-4">
        <p className="text-[11px] text-gray-400">{c.copyright}</p>
      </div>

    </footer>
  );
}
