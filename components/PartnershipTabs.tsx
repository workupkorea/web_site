"use client";
import { useState } from "react";

// 가맹 문의 페이지 우측 칼럼의 탭: '문의현황' ↔ '창업안내'.
// 좌측 문의 폼은 항상 보이게 두고, 팝업 없이 같은 자리에서 창업안내를 볼 수 있게 한다.
// 모든 패널을 렌더(hidden 토글)해 탭을 오가도 문의현황 검색값·스크롤이 유지된다.
// mobile: 모바일(lg 미만)에서의 표시 방식 — "guide"=모바일 '창업안내' 탭을 선택했을 때만, "always"=항상(고정 높이 리스트).
export type PartnershipTab = { key: string; label: string; content: React.ReactNode; scroll?: boolean; mobile?: "guide" | "always" };

export default function PartnershipTabs({ tabs }: { tabs: PartnershipTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);

  return (
    <div className="lg:h-full flex flex-col bg-white border border-gray-200 overflow-hidden">
      {/* 탭 바는 PC 전용 — 모바일은 좌측 영역의 '문의하기|창업안내' 탭이 대신한다 */}
      <div role="tablist" className="max-lg:hidden flex flex-shrink-0 border-b border-gray-200 bg-white">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`pt-tab-${t.key}`}
            aria-selected={active === t.key}
            aria-controls={`pt-panel-${t.key}`}
            onClick={() => setActive(t.key)}
            className={`flex-1 min-h-[52px] text-sm font-extrabold tracking-[-0.02em] border-b-2 -mb-px transition-colors ${
              active === t.key ? "border-[#E5541B] text-[#303236]" : "border-transparent text-gray-400 hover:text-[#303236]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tabs.map((t) => (
        <div
          key={t.key}
          id={`pt-panel-${t.key}`}
          role="tabpanel"
          aria-labelledby={`pt-tab-${t.key}`}
          // PC: 선택된 탭만 표시 / 모바일: mobile 설정에 따라 표시(보드는 항상, 안내는 모바일 탭 선택 시)
          // 내부 보드의 자체 테두리는 탭 컨테이너 테두리와 겹치지 않게 제거,
          // 안내 콘텐츠의 상단 고정 슬림바는 사이트 헤더와 겹치므로 일반 흐름으로
          className={[
            "lg:flex-1 lg:min-h-0 [&_.sticky]:!static [&>div]:!border-0 [&>div]:min-h-full",
            active !== t.key ? "lg:hidden" : "",
            t.mobile === "guide" ? "max-lg:group-data-[mtab=form]/m:hidden" : "",
            t.mobile === "always" ? "max-lg:h-[560px]" : "",
            t.scroll ? "lg:overflow-y-auto lg:overscroll-contain wu-scroll-dark" : "",
          ].join(" ")}
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
