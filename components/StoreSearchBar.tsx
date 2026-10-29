"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 메인 페이지 슬라이딩 배너(히어로) 바로 아래에 놓이는 전체 폭 매장 검색행.
// 온라인 판매가 아닌 "매장 방문 유도"가 목적이므로, 검색 시 매장 찾기(/store)로 이동해
// 입력한 키워드(매장명·지역·도로명)를 그대로 적용한다.
export default function StoreSearchBar() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSearch = () => {
    const q = query.trim();
    router.push(q ? `/store?q=${encodeURIComponent(q)}` : "/store");
  };

  // 어두운 전체 폭 띠 안에 입력+돋보기를 하나의 얇은 선 바로 묶는다. (모바일·PC 공통)
  // PC는 화면이 넓어 바가 가로를 꽉 채우고 높이를 키워 여백이 비어 보이지 않게 한다.
  return (
    <div className="bg-[#303236]">
      <div className="flex items-center gap-4 px-5 py-5 md:gap-8 md:px-[70px] md:py-10">
        {/* 모바일 전용: 검색 바 앞 W 로고 마크 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo_w_white.png" alt="WORKUP" width={34} height={26} className="h-[26px] w-auto flex-shrink-0 md:hidden" />
        {/* PC 전용 안내: 좌측 제목, 우측 검색 바 (모바일은 바만) */}
        <div className="hidden flex-shrink-0 md:block">
          <p className="text-xl font-extrabold tracking-[-0.03em] text-white lg:text-2xl">가까운 워크업 매장을 찾아보세요</p>
        </div>
        <div className="flex flex-1 items-stretch border border-white/50 transition-colors focus-within:border-white">
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder=" "
              aria-label="매장 검색어 입력"
              lang="ko"
              inputMode="text"
              enterKeyHint="search"
              autoCapitalize="off"
              autoCorrect="off"
              className="h-12 w-full bg-transparent px-4 text-sm text-white outline-none md:h-16 md:px-7 md:text-base"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
                if (e.key === "Escape") { setQuery(""); e.currentTarget.blur(); }
              }}
            />
            {/* 입력 전에만 보이는 안내 문구 (placeholder 대신 오버레이) */}
            {!query && (
              <span className="pointer-events-none absolute inset-y-0 left-4 right-2 flex items-center truncate text-sm text-white/60 md:left-7 md:text-base">
                <span className="md:hidden">가까운 워크업 매장찾기</span>
                <span className="hidden md:inline">매장명, 지역, 도로명 등으로 검색할 수 있습니다.</span>
              </span>
            )}
          </div>
          <button
            onClick={handleSearch}
            aria-label="매장 검색"
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center text-white transition-colors hover:bg-white/10 md:h-16 md:w-20"
          >
            <svg className="h-6 w-6 md:h-7 md:w-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
