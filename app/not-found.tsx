import Link from "next/link";

// 존재하지 않는 URL·비공개 페이지 안내. HTTP 404와 noindex는 Next.js가 자동으로 붙인다.
export default function NotFound() {
  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 py-20 bg-white">
      <p className="text-xs tracking-widest text-[#E5541B] mb-3">404</p>
      <h1 className="text-2xl md:text-3xl font-bold text-[#303236] mb-3">페이지를 찾을 수 없습니다</h1>
      <p className="text-sm text-gray-500 leading-relaxed mb-8">
        주소가 바뀌었거나 비공개된 페이지입니다. 가까운 워크업 매장을 찾아보세요.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <Link href="/store"
          className="inline-flex items-center justify-center min-h-[44px] bg-[#E5541B] text-white text-sm font-bold px-8 hover:bg-[#d6480a] transition-colors">
          가까운 매장 찾기
        </Link>
        <Link href="/"
          className="inline-flex items-center justify-center min-h-[44px] border border-gray-300 text-[#303236] text-sm font-semibold px-8 hover:border-[#303236] transition-colors">
          홈으로
        </Link>
      </div>
    </main>
  );
}
