// /ih-mobile/[token] 전용 layout — app/admin 트리 바깥에 둬서 app/admin/layout.tsx의 로그인 필수 리다이렉트를
// 아예 타지 않게 한다(관리자 로그인 없이, 토큰 하나로만 열람하는 화면이라는 취지).
export const metadata = { title: "인플루언서 허브", robots: { index: false, follow: false } };

export default function IHMobileStandaloneLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 bg-white">{children}</div>;
}
