// Oxanium 영문 디스플레이 폰트.
// next/font/google은 빌드 시 Google Fonts를 내려받는데, Vercel 빌드에서 반복 실패해(Turbopack
// "next/font/google queries have exactly one entry") 배포가 막혔다.
// app/layout.tsx의 <link>가 이미 Oxanium(400~800)을 불러오므로, 클래스만 제공한다(스타일은 globals.css).
export const oxanium = { className: "font-oxanium" } as const;
