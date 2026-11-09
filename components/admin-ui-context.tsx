"use client";
import { createContext, useContext } from "react";

export type AdminTab = { href: string; label: string };

export type AdminUIValue = {
  /** 열린 탭 목록 (최대 10개) */
  tabs: AdminTab[];
  /** 현재 활성 경로 (pathname + ?query) */
  currentHref: string;
  /** 탭으로 이동 */
  selectTab: (href: string) => void;
  /** 탭 닫기 */
  closeTab: (href: string) => void;
  /** 전체 탭 닫기 */
  closeAllTabs: () => void;
  /** 즐겨찾기 href 목록 */
  favorites: string[];
  isFavorite: (href: string) => boolean;
  toggleFavorite: (href: string) => void;
  /** S관리자 여부 */
  superAdmin: boolean;
};

export const AdminUIContext = createContext<AdminUIValue | null>(null);

export function useAdminUI(): AdminUIValue {
  const ctx = useContext(AdminUIContext);
  if (!ctx) throw new Error("useAdminUI must be used within <AdminShell>");
  return ctx;
}
