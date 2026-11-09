"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import VercelTab from "./_tabs/VercelTab";
import DbStatusTab from "./_tabs/DbStatusTab";
import FixLogTab from "./_tabs/FixLogTab";

// 시스템 관리 — Vercel 상태 / DB 상태 / 오류 수정 내역을 탭으로 묶은 통합 페이지
const TABS = [
  { key: "vercel", label: "Vercel 상태", Component: VercelTab },
  { key: "db-status", label: "DB 상태", Component: DbStatusTab },
  { key: "fix-log", label: "오류 수정 내역", Component: FixLogTab },
] as const;

function SystemTabs() {
  const router = useRouter();
  const params = useSearchParams();
  const active = TABS.find((t) => t.key === params.get("tab")) ?? TABS[0];
  const Active = active.Component;

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={t.key === active.key}
            onClick={() => router.replace(`/admin/system?tab=${t.key}`, { scroll: false })}
            className={`min-h-[44px] px-5 rounded-full text-sm font-bold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1a1a1a] focus-visible:ring-offset-2 ${
              t.key === active.key
                ? "bg-[#1a1a1a] text-white"
                : "bg-white text-gray-500 hover:text-gray-900 border border-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Active />
    </div>
  );
}

export default function AdminSystemPage() {
  return (
    <Suspense fallback={null}>
      <SystemTabs />
    </Suspense>
  );
}
