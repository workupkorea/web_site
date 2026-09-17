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

  return (
    <div className="bg-gray-50 py-4 md:py-7">
      <div className="px-[15px] md:px-[70px]">
        <div className="flex flex-col gap-4 rounded-xl border-2 border-[#E5541B] bg-white px-5 py-5 shadow-md md:flex-row md:items-center md:gap-7 md:px-8 md:py-7">
          {/* 안내 문구 */}
          <div className="flex items-center gap-4 md:flex-shrink-0">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#E5541B] md:h-14 md:w-14">
              <svg className="h-6 w-6 md:h-7 md:w-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-base font-bold leading-tight text-[#303236] md:text-xl">가까운 워크업 매장을 찾아보세요</p>
              <p className="mt-1.5 text-[13px] leading-tight text-gray-500 md:text-[14px]">매장명, 지역, 도로명 등으로 검색할 수 있습니다.</p>
            </div>
          </div>

          {/* 검색 입력 + 버튼 */}
          <div className="flex flex-1 items-stretch gap-2.5">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="매장명이나 지역명을 입력하세요"
              aria-label="매장 검색어 입력"
              className="h-12 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-5 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#303236] md:h-14 md:text-base"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
                if (e.key === "Escape") { setQuery(""); e.currentTarget.blur(); }
              }}
            />
            <button
              onClick={handleSearch}
              aria-label="매장 검색"
              className="flex h-12 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-[#303236] text-white transition-colors hover:bg-[#22365c] md:h-14 md:w-16"
            >
              <svg className="h-5 w-5 md:h-6 md:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
