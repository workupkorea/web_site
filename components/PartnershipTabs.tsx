"use client";
import { useState } from "react";

// 가맹 문의 페이지 우측 칼럼의 탭: '문의현황' ↔ '창업안내'.
// 좌측 문의 폼은 항상 보이게 두고, 팝업 없이 같은 자리에서 창업안내를 볼 수 있게 한다.
// 모든 패널을 렌더(hidden 토글)해 탭을 오가도 문의현황 검색값·스크롤이 유지된다.
export type PartnershipTab = { key: string; label: string; content: React.ReactNode; scroll?: boolean };

export default function PartnershipTabs({ tabs }: { tabs: PartnershipTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);

  return (
    <div className="h-full flex flex-col bg-white border border-gray-200 overflow-hidden">
      <div role="tablist" className="flex flex-shrink-0 border-b border-gray-200 bg-white">
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
          hidden={active !== t.key}
          // 내부 보드의 자체 테두리는 탭 컨테이너 테두리와 겹치지 않게 제거,
          // 안내 콘텐츠의 상단 고정 슬림바는 사이트 헤더와 겹치므로 일반 흐름으로
          className={`flex-1 min-h-0 [&_.sticky]:!static [&>div]:!border-0 ${t.scroll ? "overflow-y-auto overscroll-contain" : ""}`}
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}

// 창업안내 탭 하단 CTA — 문의 폼의 이름 입력란으로 스크롤·포커스
export function FocusFormButton({ children }: { children: React.ReactNode }) {
  const go = () => {
    const nameInput = document.getElementById("pf-name");
    nameInput?.scrollIntoView({ behavior: "smooth", block: "center" });
    nameInput?.focus();
  };
  return (
    <button
      type="button"
      onClick={go}
      className="flex items-center justify-center w-full min-h-[56px] bg-[#E5541B] text-white text-sm font-extrabold hover:bg-[#c94716] transition-colors"
    >
      {children}
    </button>
  );
}
