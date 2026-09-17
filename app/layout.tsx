import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import SideBanner from "@/components/SideBanner";
import BottomNav from "@/components/BottomNav";
import { CartProvider } from "@/contexts/CartContext";
import PixelManager from "@/components/PixelManager";
import { getTopbarConfig } from "@/lib/topbar-server";
import { getFooterConfig } from "@/lib/footer-server";
import { getHeaderNavConfig } from "@/lib/header-nav-server";
import { getLogoConfig } from "@/lib/logo-server";
import { getSearchConfig } from "@/lib/header-search-server";
import { getStudioSettings } from "@/lib/studio-server";
import { getMegaBrandsConfig } from "@/lib/mega-brands-server";
import { headers } from "next/headers";
import ScrollToTop from "@/components/ScrollToTop";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import ImageProtection from "@/components/ImageProtection";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { siteUrl } from "@/lib/site";

// 본문 기본 서체 — display:"optional"은 폰트가 즉시(수십 ms 내) 준비되지 않으면 그 페이지 조회에서는
// 웹폰트로 교체하지 않고 폴백 폰트를 계속 사용한다. 한글은 폴백/실제 글꼴의 글자 폭이 완전히 같지
// 않아 자간 지표를 맞춰도(swap) 교체 시점에 줄바꿈이 달라져 박스가 커지는 현상이 남았기 때문—
// optional로 교체 자체를 없애 리플로우를 원천 차단한다(재방문 시엔 캐시되어 처음부터 정상 표시).
const notoSansKR = Noto_Sans_KR({ weight: ["400", "700", "900"], display: "optional" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  // 페이지별 상대경로 OG 이미지/링크가 절대 URL로 해석되도록 기준 URL 설정
  metadataBase: new URL(siteUrl),
  title: {
    default: "WORKUP — 일하는 사람을 위한 옷",
    template: "%s | WORKUP",
  },
  description: "현장부터 일상까지. 기능성 워크웨어 브랜드 워크업.",
  // 네이버 서치어드바이저 소유 확인용
  verification: {
    other: {
      "naver-site-verification": "88bca7170905aa4f3fb074e92a86d5d48b78f2c2",
    },
  },
  // 카톡·SNS·문자 공유 시 노출되는 기본 미리보기 (페이지별 openGraph가 있으면 그것이 우선)
  openGraph: {
    type: "website",
    siteName: "WORKUP",
    locale: "ko_KR",
    title: "WORKUP — 일하는 사람을 위한 옷",
    description: "현장부터 일상까지. 기능성 워크웨어 브랜드 워크업.",
    url: siteUrl,
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "WORKUP",
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isAdmin = pathname.startsWith("/admin");
  // 지점 출고 패스 공개 페이지(/b/[token]), 관리 화면(/notices), 인플루언서 허브 모바일 뷰어(/ih-mobile/[token] —
  // 로그인 없이 토큰으로만 여는 페이지라 /admin 트리 밖에 있음), 입고 스케쥴(/arrival —
  // 주문관리 사이트에 삽입할 단독 페이지)도 관리자 화면과 동일하게 사이트 헤더·푸터·팝업 없이 단독으로 렌더링한다.
  const hideChrome = isAdmin || pathname.startsWith("/b/") || pathname.startsWith("/notices") || pathname.startsWith("/ih-mobile/") || pathname.startsWith("/arrival");

  const [topbar, footer, headerNav, logo, search, studio, megaBrands] = hideChrome
    ? [null, null, null, null, null, null, null]
    : await Promise.all([
        getTopbarConfig(), getFooterConfig(), getHeaderNavConfig(), getLogoConfig(), getSearchConfig(),
        getStudioSettings(), getMegaBrandsConfig(),
      ]);

  // 관리자가 숨김 처리한 메뉴는 실제 사이트 노출에서만 제외한다(관리 화면에는 전체 노출).
  const visibleNavItems = headerNav?.items.filter((it) => it.isVisible !== false);
  // BRANDS 아이템이 명시적으로 숨김(isVisible: false) 처리된 경우 mega menu도 함께 숨긴다.
  const brandNavItem = headerNav?.items.find((it) => it.label.toUpperCase() === "BRANDS");
  const effectiveMegaBrands = brandNavItem?.isVisible === false ? null : megaBrands;

  return (
    <html lang="ko">
      <body className={`min-h-full flex flex-col ${notoSansKR.className}`}>
        {/* 헤더가 top: var(--wu-topbar-h)로 스티키 위치를 잡고, 카탈로그 뷰어 등도 이 값을 참조한다.
            탑바가 꺼져 있거나 없으면 0, 켜져 있으면 PC/모바일 각각의 실제 높이로 맞춘다. */}
        <style>{`
          :root{--wu-topbar-h:${topbar?.enabled ? topbar.height : 0}px}
          @media (max-width:767px){:root{--wu-topbar-h:${topbar?.enabled ? topbar.mobile_height : 0}px}}
        `}</style>
        {/* 모바일 핀치줌 차단 — iOS Safari는 meta viewport user-scalable=no를 무시하므로 JS로 처리 */}
        <script dangerouslySetInnerHTML={{ __html: `document.addEventListener('touchmove',function(e){if(e.touches.length>1)e.preventDefault();},{passive:false});` }} />
        {/* 웹폰트 라이브러리 (영문+한글 장식용) — 슬라이딩 메뉴 텍스트 캔버스용 · 실제 사용 시에만 폰트 파일 다운로드 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Black+Han+Sans&family=Do+Hyeon&family=Jua&family=Montserrat:wght@400;600;700;900&family=Nanum+Pen+Script&family=Noto+Serif+KR:wght@400;600;700&family=Oswald:wght@400;500;700&family=Oxanium:wght@400;500;600;700;800&family=Playfair+Display:wght@400;700;900&display=swap"
        />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
        <ScrollToTop />
        <ScrollToTopButton />
        {!hideChrome && <PixelManager />}
        {!hideChrome && <ImageProtection />}
        <CartProvider>
            {/* BottomNav는 position:fixed 로 화면 최하단 고정. scroll-root는 스크롤 컨테이너 */}
            <div
              id={hideChrome ? undefined : "scroll-root"}
              className={hideChrome ? "flex-1 min-h-0 overflow-y-auto" : "flex-1 min-h-0 flex flex-col"}
            >
              {!hideChrome && topbar && <Topbar cfg={topbar} />}
              {!hideChrome && topbar && headerNav && logo && search && (
                <Header
                  navItems={visibleNavItems}
                  logo={logo}
                  topbarItems={[]}
                  studioEnabled={studio?.enabled ?? true}
                  megaBrandsConfig={effectiveMegaBrands}
                />
              )}
              <div className={hideChrome ? "flex-1" : "relative flex-1"}>
                {children}
              </div>
              {!hideChrome && <SideBanner />}
              {!hideChrome && footer && logo && <Footer config={footer} logo={logo} />}
            </div>
            {!hideChrome && headerNav && <BottomNav navItems={visibleNavItems} studioEnabled={studio?.enabled ?? true} />}
        </CartProvider>
        {/* Vercel 방문/전환 분석 · Core Web Vitals 측정 (대시보드에서 활성화 필요) */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
