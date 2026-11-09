"use client";

import { Suspense, type ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminUI } from "@/components/admin-ui-context";

export interface AdminTab {
  key: string;
  label: string;
  Component: ComponentType;
  /** true면 S관리자에게만 탭을 보여준다 */
  superOnly?: boolean;
  /** 탭 줄 오른쪽 끝에 보여줄 버튼 등 (이 탭이 선택됐을 때만) */
  Actions?: ComponentType;
}

// 한 페이지 안에서 ?tab=키 로 전환하는 관리자 공용 탭 (알약형)
function Inner({ basePath, tabs: allTabs }: { basePath: string; tabs: readonly AdminTab[] }) {
  const { superAdmin } = useAdminUI();
  const tabs = allTabs.filter((t) => !t.superOnly || superAdmin);
  const router = useRouter();
  const params = useSearchParams();
  const active = tabs.find((t) => t.key === params.get("tab")) ?? tabs[0];
  const Active = active.Component;
  const Actions = active.Actions;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={t.key === active.key}
            onClick={() => router.replace(`${basePath}?tab=${t.key}`, { scroll: false })}
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
      {Actions && <div className="ml-auto shrink-0"><Actions /></div>}
      </div>
      <Active />
    </div>
  );
}

export default function AdminTabs(props: { basePath: string; tabs: readonly AdminTab[] }) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}
