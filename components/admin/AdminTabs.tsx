"use client";

import { Suspense, type ComponentType, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import AdminSectionNav, { ADMIN_SECTION_NAV_IN_CONTENT } from "./AdminSectionNav";
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

// 한 페이지 안에서 ?tab=키 로 전환하는 관리자 공용 탭
function Inner({ basePath, tabs: allTabs, children }: { basePath: string; tabs: readonly AdminTab[]; children?: ReactNode }) {
  const { superAdmin } = useAdminUI();
  const tabs = allTabs.filter((t) => !t.superOnly || superAdmin);
  const params = useSearchParams();
  const active = tabs.find((t) => t.key === params.get("tab")) ?? tabs[0];
  const Active = active.Component;
  const Actions = active.Actions;

  return (
    <>
      <AdminSectionNav
        className={ADMIN_SECTION_NAV_IN_CONTENT}
        links={tabs.map(({ key, label }) => ({ label, href: `${basePath}?tab=${key}`, active: key === active.key }))}
        actions={Actions && <Actions />}
        replace
      />
      {children}
      <Active />
    </>
  );
}

export default function AdminTabs(props: { basePath: string; tabs: readonly AdminTab[]; children?: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}
