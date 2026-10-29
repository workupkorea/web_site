"use client";
import { createContext, useContext, useState } from "react";

// 가맹 문의 페이지 모바일 전용 탭: '문의하기' ↔ '창업안내'.
// PC(lg 이상)는 좌측 폼 + 우측 탭(창업안내|문의현황) 구조라 이 탭은 쓰지 않는다.
// 폼·안내·보드를 한 번씩만 렌더하고, 선택 상태를 data-mtab 속성으로 노출해
// 자손이 group-data-[mtab=...]/m 변형 클래스로 표시 여부를 정한다(폼 id 중복 방지).
export type MobileTabKey = "form" | "guide";

const Ctx = createContext<{ tab: MobileTabKey; setTab: (t: MobileTabKey) => void } | null>(null);

export function PartnershipShell({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<MobileTabKey>("form");
  return (
    <Ctx.Provider value={{ tab, setTab }}>
      <div className="group/m" data-mtab={tab}>{children}</div>
    </Ctx.Provider>
  );
}

export function MobileTabBar({ formLabel = "문의하기", guideLabel = "창업안내" }: { formLabel?: string; guideLabel?: string }) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  const items: { key: MobileTabKey; label: string }[] = [
    { key: "form", label: formLabel },
    { key: "guide", label: guideLabel },
  ];
  return (
    <div id="pt-mobile-tabs" role="tablist" className="lg:hidden scroll-mt-14 flex border-b border-gray-200 bg-white">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="tab"
          aria-selected={ctx.tab === it.key}
          onClick={() => ctx.setTab(it.key)}
          className={`flex-1 min-h-[52px] text-sm font-extrabold tracking-[-0.02em] border-b-2 -mb-px transition-colors ${
            ctx.tab === it.key ? "border-[#E5541B] text-[#303236]" : "border-transparent text-gray-400"
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

// 모바일 창업안내 하단 CTA: 문의하기 탭으로 전환하고 탭 위치로 이동 (PC는 폼이 항상 보이므로 숨김)
export function GoFormButton({ children, accent }: { children: React.ReactNode; accent: string }) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  const go = () => {
    ctx.setTab("form");
    setTimeout(() => document.getElementById("pt-mobile-tabs")?.scrollIntoView({ block: "start" }), 80);
  };
  return (
    <div className="lg:hidden p-5 pt-2">
      <button
        type="button"
        onClick={go}
        style={{ backgroundColor: accent }}
        className="w-full min-h-14 text-base font-extrabold text-white tracking-[-0.01em] active:opacity-90"
      >
        {children}
      </button>
    </div>
  );
}
