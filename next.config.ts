import type { NextConfig } from "next";

// 모든 응답에 적용할 보안 헤더.
// CSP는 외부 리소스(구글폰트·jsdelivr·Supabase·ImageKit·픽셀 등) 전수 점검이
// 필요해 오작동 위험이 있어 제외했다. 추후 별도 작업으로 도입 권장.
const securityHeaders = [
  // HTTPS 강제 (2년). 커스텀 도메인 preload 등록 전이므로 preload 지시어는 제외.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // MIME 스니핑 차단
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 클릭재킹 방지 (자사 도메인 내 iframe만 허용)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // 리퍼러 최소 노출
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 불필요한 브라우저 기능 차단 (geolocation은 길찾기용으로 기본값 유지)
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=()" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["react-pdf", "pdfjs-dist"],
  // 응답 헤더에서 x-powered-by 제거 (불필요한 정보 노출 차단)
  poweredByHeader: false,
  // 동적 페이지의 클라이언트 라우터 캐시 비활성화
  // → 관리자에서 탑바 높이 저장 후 새로고침 한 번으로 즉시 반영됨
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
  images: {
    // 최신 경량 포맷 우선 (원본 JPG/PNG → AVIF/WebP 자동 변환)
    formats: ["image/avif", "image/webp"],
    // 최적화 이미지 캐시 최소 유지시간 31일.
    // 이미지 교체 시 새 파일명을 쓰므로 URL이 바뀌어 캐시 충돌 없음.
    minimumCacheTTL: 2678400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "hovotcjzyzmcffusellp.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "images.workupkorea.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // 입고 스케쥴 페이지는 거래처 발주 사이트(wjumun.com)에 iframe으로 삽입할 수 있도록 허용한다.
        // X-Frame-Options는 도메인을 하나만 지정할 수 없어(SAMEORIGIN 고정) 위 공용 헤더를 그대로 두고,
        // CSP frame-ancestors만 추가로 얹는다. 최신 브라우저는 둘 다 있으면 frame-ancestors를 우선시하므로
        // (구형 브라우저만 X-Frame-Options로 인해 계속 차단됨) 다른 라우트의 클릭재킹 방지는 그대로 유지된다.
        source: "/arrival",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://wjumun.com;" },
        ],
      },
      {
        source: "/arrival/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://wjumun.com;" },
        ],
      },
    ];
  },
};

export default nextConfig;
