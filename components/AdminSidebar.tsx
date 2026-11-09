"use client";
import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAdminUI } from "./admin-ui-context";
import { TOPBAR_ENABLED_EVENT } from "@/lib/topbar";

const TOPBAR_HREF = "/admin/main/topbar";

export type NavLeaf = { label: string; href: string; exact?: boolean; newTab?: boolean; icon: ReactNode; superAdminOnly?: boolean };
export type NavDropdown = { label: string; icon: ReactNode; children: NavLeaf[]; superAdminOnly?: boolean };
export type NavItem = NavLeaf | NavDropdown;
export type NavGroup = { label: string; items: NavItem[]; superAdminOnly?: boolean };

export function isDropdown(item: NavItem): item is NavDropdown {
  return "children" in item;
}

export const navGroups: NavGroup[] = [
  // ── 1. 사이트관리 (디자인·UI 변경 요소 전체 통합: 메인 배치·메뉴바·팝업·탑바·푸터·콘텐츠 페이지) ──
  {
    label: "사이트관리",
    items: [
      {
        label: "메인 관리",
        href: "/admin/main/home",
        exact: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <rect x="4" y="4" width="16" height="4" rx="1" />
            <rect x="4" y="10" width="16" height="4" rx="1" />
            <rect x="4" y="16" width="16" height="4" rx="1" />
          </svg>
        ),
      },
      {
        label: "팝업 관리",
        href: "/admin/main/popups",
        exact: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
        ),
      },
      {
        label: "콘텐츠",
        href: "/admin/main/contents",
        exact: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        ),
      },
      {
        label: "레이아웃",
        href: "/admin/main/layout",
        exact: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="16" rx="2" /><path strokeLinecap="round" d="M3 9h18" />
          </svg>
        ),
      },
    ],
  },
  // ── 3. 브랜드 관리 ───────────────────────────────────────────────────────
  {
    label: "브랜드 관리",
    items: [
      {
        label: "브랜드 관리",
        href: "/admin/catalog/brands",
        exact: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122" />
          </svg>
        ),
      },
    ],
  },
  // ── 3-1. 지점 및 상품관리 ─────────────────────────────────────────────────
  {
    label: "지점 및 상품관리",
    items: [
      {
        label: "입고 스케쥴 · 출고 패스",
        href: "/admin/arrival",
        exact: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
    ],
  },
  // ── 4. 스토어 관리 ────────────────────────────────────────────────────────
  {
    label: "스토어 관리",
    items: [
      {
        label: "스토어 관리",
        href: "/admin/stores",
        exact: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      },
    ],
  },
  // ── 5. 고객 문의 (하위 페이지 편집은 /admin/inquiries 안의 탭으로 이동) ──
  {
    label: "고객 문의",
    items: [
      {
        label: "문의 관리",
        href: "/admin/inquiries",
        exact: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        ),
      },
    ],
  },
  // ── 6. 마케팅/분석 ────────────────────────────────────────────────────────
  {
    label: "마케팅/분석",
    superAdminOnly: true,
    items: [
      {
        label: "마케팅/분석",
        href: "/admin/analytics"
        ,exact: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
        ),
      },
    ],
  },
  // ── 8. 회원 관리 ──────────────────────────────────────────────────────────
  {
    label: "회원 관리",
    items: [
      {
        label: "회원 관리",
        href: "/admin/members",
        exact: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
    ],
  },
  // ── 시스템 관리 (Vercel·DB 상태, 오류 수정 내역) ───────────────────────────
  {
    label: "시스템 관리",
    superAdminOnly: true,
    items: [
      {
        label: "시스템 관리",
        href: "/admin/system",
        exact: true,
        superAdminOnly: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
          </svg>
        ),
      },
    ],
  },
  // ── 마지막. 비활성 기능 (현재 사용하지 않는 기능 모음) ──────────────────────
  {
    label: "비활성 기능",
    superAdminOnly: true,
    items: [
      {
        label: "인플루언서 허브",
        href: "/admin/influencer-hub",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
      },
      {
        label: "제품 목록",
        href: "/admin/products",
        exact: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
      },
      {
        label: "카테고리 관리",
        href: "/admin/main/categories",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        ),
      },
      {
        label: "상세 배너 관리",
        href: "/admin/main/product-banners",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <rect x="3" y="5" width="18" height="6" rx="1" /><rect x="3" y="13" width="18" height="6" rx="1" />
          </svg>
        ),
      },
      {
        label: "인스타 피드",
        href: "/admin/main/instagram",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        ),
      },
      {
        label: "피팅리스트 관리",
        href: "/admin/main/wishlist",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        ),
      },
      {
        label: "검색관리",
        href: "/admin/main/search",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        ),
      },
      {
        label: "스튜디오(티셔츠 꾸미기)",
        href: "/admin/studio",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        ),
      },
      {
        label: "필드테스트",
        href: "/admin/field-test",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        ),
      },
      {
        label: "채용공고 관리",
        href: "/admin/stores/jobs",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        ),
      },
    ],
  },
];

/** 새 창(target=_blank)으로 열리는 메뉴임을 알리는 작은 아이콘 — 상단 헤더의 "사이트 미리보기"와 동일한 모양 */
function ExternalLinkIcon() {
  return (
    <svg className="w-3 h-3 flex-shrink-0 opacity-60" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.36 4.18a1 1 0 00.95.69h4.4c.97 0 1.37 1.24.59 1.81l-3.56 2.59a1 1 0 00-.36 1.12l1.36 4.18c.3.92-.76 1.69-1.54 1.12l-3.56-2.59a1 1 0 00-1.18 0l-3.56 2.59c-.78.57-1.84-.2-1.54-1.12l1.36-4.18a1 1 0 00-.36-1.12L2.1 9.61c-.78-.57-.38-1.81.59-1.81h4.4a1 1 0 00.95-.69z" />
    </svg>
  ) : (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5l2.2 4.46 4.92.72-3.56 3.47.84 4.9-4.4-2.31-4.4 2.31.84-4.9L4.9 8.68l4.92-.72z" />
    </svg>
  );
}

/** 사이드바 단일 메뉴 항목 (별표 토글 포함) */
function LeafRow({
  leaf,
  active,
  fav,
  onToggleFav,
  status,
}: {
  leaf: NavLeaf;
  active: boolean;
  fav: boolean;
  onToggleFav: () => void;
  status?: boolean; // 켜고 끄는 기능의 현재 상태 — 있으면 ON/OFF 배지 표시
}) {
  return (
    <div className="group/leaf relative flex items-center">
      <Link
        href={leaf.href}
        target={leaf.newTab ? "_blank" : undefined}
        rel={leaf.newTab ? "noopener noreferrer" : undefined}
        className={`flex-1 min-w-0 flex items-center gap-3 pl-4 pr-9 py-2.5 rounded-lg text-[14px] font-medium transition-all ${
          active
            ? "bg-[#1d4ed8] text-white shadow-md shadow-blue-900/30"
            : "text-slate-400 hover:text-white hover:bg-white/8"
        }`}
      >
        <span className={`flex-shrink-0 ${active ? "text-white" : "text-slate-500"}`}>{leaf.icon}</span>
        <span className="truncate">{leaf.label}</span>
        {leaf.newTab && <ExternalLinkIcon />}
        {status !== undefined && (
          <span className={`flex-shrink-0 px-1.5 py-px rounded text-[10px] font-bold tracking-wide leading-4 ${
            status
              ? active ? "bg-white/25 text-white" : "bg-emerald-500/15 text-emerald-400"
              : active ? "bg-black/20 text-white/70" : "bg-slate-500/20 text-slate-400"
          }`}>
            {status ? "ON" : "OFF"}
          </span>
        )}
      </Link>
      <button
        type="button"
        onClick={onToggleFav}
        title={fav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
        aria-label={fav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
        className={`absolute right-2 p-1 rounded transition-opacity ${
          fav
            ? "opacity-100 text-amber-400 hover:text-amber-300"
            : "opacity-0 group-hover/leaf:opacity-100 text-slate-500 hover:text-amber-400"
        }`}
      >
        <StarIcon filled={fav} />
      </button>
    </div>
  );
}

export default function AdminSidebar({ superAdmin: superAdminProp }: { superAdmin?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchStr = searchParams.toString();
  const { favorites, isFavorite, toggleFavorite } = useAdminUI();

  // S관리자 여부: prop 전달이 불안정할 수 있어 API로 직접 확인
  const [superAdmin, setSuperAdmin] = useState(superAdminProp ?? false);
  useEffect(() => {
    fetch("/api/admin/super-check")
      .then(r => r.json())
      .then(d => { setSuperAdmin(!!d.superAdmin); })
      .catch(() => {});
  }, []);

  // 상단 탑바 ON/OFF 상태 — 메뉴 배지용. 탑바 관리 화면에서 바꾸면 이벤트로 즉시 반영
  const [topbarEnabled, setTopbarEnabled] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    fetch("/api/admin/site-settings/topbar")
      .then(r => r.json())
      .then(d => { setTopbarEnabled(typeof d?.enabled === "boolean" ? d.enabled : true); })
      .catch(() => {});
    const onChange = (e: Event) => setTopbarEnabled(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener(TOPBAR_ENABLED_EVENT, onChange);
    return () => window.removeEventListener(TOPBAR_ENABLED_EVENT, onChange);
  }, []);
  const statusOf = (href: string) => (href === TOPBAR_HREF ? topbarEnabled : undefined);

  // S관리자 전용 그룹/항목 필터
  const visibleNavGroups = navGroups.filter(g => !g.superAdminOnly || superAdmin);

  // 현재 활성 항목이 속한 그룹 계산
  const activeGroup = (() => {
    for (const group of visibleNavGroups) {
      for (const item of group.items) {
        if (isDropdown(item)) {
          if (item.children.some((c) => isLeafActive(c, pathname, searchStr))) return group.label;
        } else if (isLeafActive(item, pathname, searchStr)) {
          return group.label;
        }
      }
    }
    return null;
  })();

  // 아코디언: 한 번에 한 그룹만 펼침
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroup);
  // 활성 자식을 가진 드롭다운 펼침
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeGroup) setOpenGroup(activeGroup);
    const dd = new Set<string>();
    for (const group of visibleNavGroups) {
      for (const item of group.items) {
        if (isDropdown(item) && item.children.some((c) => isLeafActive(c, pathname, searchStr))) {
          dd.add(item.label);
        }
      }
    }
    setOpenDropdowns(dd);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchStr]);

  const toggleGroup = (label: string) =>
    setOpenGroup((prev) => (prev === label ? null : label));

  const toggleDropdown = (label: string) =>
    setOpenDropdowns((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  // 즐겨찾기 메뉴 메타 해석
  const favoriteLeaves = favorites
    .map((href) => getNavLeafByHref(href))
    .filter((l): l is NavLeaf => Boolean(l));

  return (
    <aside className="w-72 flex-shrink-0 bg-[#0f172a] min-h-full flex flex-col">
      <nav className="flex-1 py-4 overflow-y-auto">
        {/* 대시보드 (홈) */}
        <div className="px-3 mb-2">
          <Link
            href="/admin"
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-[14px] font-semibold transition-all ${
              pathname === "/admin"
                ? "bg-[#1d4ed8] text-white shadow-md shadow-blue-900/30"
                : "text-slate-300 hover:text-white hover:bg-white/8"
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            대시보드
          </Link>
        </div>

        {/* 즐겨찾기 */}
        {favoriteLeaves.length > 0 && (
          <div className="mb-3 px-3">
            <p className="px-3 pt-2 pb-2 text-[11px] font-bold text-amber-400/80 uppercase tracking-[0.18em] flex items-center gap-1.5">
              <StarIcon filled />
              즐겨찾기
            </p>
            <div className="space-y-0.5">
              {favoriteLeaves.map((leaf) => (
                <LeafRow
                  key={leaf.href}
                  leaf={leaf}
                  active={isLeafActive(leaf, pathname, searchStr)}
                  fav
                  onToggleFav={() => toggleFavorite(leaf.href)}
                  status={statusOf(leaf.href)}
                />
              ))}
            </div>
            <div className="mt-3 mx-3 border-t border-white/5" />
          </div>
        )}

        {/* 그룹 (아코디언) */}
        {visibleNavGroups.map((group) => {
          const isGroupOpen = openGroup === group.label;
          const groupActive = activeGroup === group.label;

          // 항목이 하나뿐인 그룹(아코디언 불필요)은 그룹 라벨 자체를 바로가기 링크로 렌더링
          if (group.items.length === 1 && !isDropdown(group.items[0])) {
            const only = group.items[0] as NavLeaf;
            const active = isLeafActive(only, pathname, searchStr);
            return (
              <div key={group.label} className="mb-0.5 px-3">
                <div className="group/leaf relative flex items-center">
                  <Link
                    href={only.href}
                    target={only.newTab ? "_blank" : undefined}
                    rel={only.newTab ? "noopener noreferrer" : undefined}
                    className={`flex-1 min-w-0 flex items-center gap-2 pl-3 pr-9 py-2.5 rounded-lg text-[14px] font-bold tracking-tight transition-colors ${
                      active ? "bg-[#1d4ed8] text-white shadow-md shadow-blue-900/30" : "text-slate-300 hover:text-white hover:bg-white/8"
                    }`}
                  >
                    <span className={`flex-shrink-0 ${active ? "text-white" : "text-slate-500"}`}>{only.icon}</span>
                    <span className="truncate">{group.label}</span>
                    {only.newTab && <ExternalLinkIcon />}
                  </Link>
                  {/* 최상단 단일 메뉴도 즐겨찾기 가능 */}
                  <button
                    type="button"
                    onClick={() => toggleFavorite(only.href)}
                    title={isFavorite(only.href) ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                    aria-label={isFavorite(only.href) ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                    className={`absolute right-2 p-1 rounded transition-opacity ${
                      isFavorite(only.href)
                        ? "opacity-100 text-amber-400 hover:text-amber-300"
                        : active
                          ? "opacity-0 group-hover/leaf:opacity-100 text-white/70 hover:text-amber-300"
                          : "opacity-0 group-hover/leaf:opacity-100 text-slate-500 hover:text-amber-400"
                    }`}
                  >
                    <StarIcon filled={isFavorite(only.href)} />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={group.label} className="mb-0.5 px-3">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[14px] font-bold tracking-tight transition-colors ${
                  groupActive ? "text-blue-300" : "text-slate-300 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {group.label}
                  {group.superAdminOnly && (
                    <span className="text-[9px] font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">S</span>
                  )}
                </span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${isGroupOpen ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isGroupOpen && (
                <div className="space-y-0.5 mt-0.5 pb-1">
                  {group.items.filter(item => !item.superAdminOnly || superAdmin).map((item) => {
                    if (isDropdown(item)) {
                      const isOpen = openDropdowns.has(item.label);
                      const hasActive = item.children.some((c) => isLeafActive(c, pathname, searchStr));
                      return (
                        <div key={item.label}>
                          <button
                            type="button"
                            onClick={() => toggleDropdown(item.label)}
                            className={`w-full flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-lg text-[14px] font-medium transition-all ${
                              hasActive ? "text-white bg-white/8" : "text-slate-400 hover:text-white hover:bg-white/8"
                            }`}
                          >
                            <span className={`flex-shrink-0 ${hasActive ? "text-blue-400" : "text-slate-500"}`}>
                              {item.icon}
                            </span>
                            <span className="flex-1 text-left truncate">{item.label}</span>
                            <svg
                              className={`w-4 h-4 flex-shrink-0 text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {isOpen && (
                            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                              {item.children.map((child) => (
                                <LeafRow
                                  key={child.href}
                                  leaf={child}
                                  active={isLeafActive(child, pathname, searchStr)}
                                  fav={isFavorite(child.href)}
                                  onToggleFav={() => toggleFavorite(child.href)}
                                  status={statusOf(child.href)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <LeafRow
                        key={item.href}
                        leaf={item}
                        active={isLeafActive(item, pathname, searchStr)}
                        fav={isFavorite(item.href)}
                        onToggleFav={() => toggleFavorite(item.href)}
                        status={statusOf(item.href)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t border-white/5">
        <p className="text-[12px] text-slate-600 font-medium">WORKUP Admin v1.0</p>
      </div>
    </aside>
  );
}

export function isLeafActive(item: NavLeaf, pathname: string, searchParamsStr: string): boolean {
  const [itemPath, itemQuery] = item.href.split("?");
  if (item.exact) {
    if (pathname !== itemPath) return false;
  } else {
    if (pathname !== itemPath && !pathname.startsWith(itemPath + "/")) return false;
  }
  if (!itemQuery) {
    // 쿼리 없는 링크: 쿼리가 없거나 type=main 일 때만 활성
    if (itemPath === "/admin/main/visual") {
      const sp = new URLSearchParams(searchParamsStr);
      return !sp.has("type") || sp.get("type") === "main";
    }
    return true;
  }
  // 쿼리 있는 링크: 모든 파라미터가 일치해야 활성
  const itemParams = new URLSearchParams(itemQuery);
  const currentParams = new URLSearchParams(searchParamsStr);
  for (const [k, v] of itemParams.entries()) {
    if (currentParams.get(k) !== v) return false;
  }
  return true;
}

/** href(쿼리 포함)로 메뉴 항목을 찾는다. 정확 매칭 우선, 없으면 쿼리 없는 경로 매칭. */
export function getNavLeafByHref(href: string): NavLeaf | null {
  for (const group of navGroups) {
    for (const item of group.items) {
      if (isDropdown(item)) {
        for (const c of item.children) if (c.href === href) return c;
      } else if (item.href === href) {
        return item;
      }
    }
  }
  const path = href.split("?")[0];
  for (const group of navGroups) {
    for (const item of group.items) {
      if (isDropdown(item)) {
        for (const c of item.children) if (!c.href.includes("?") && c.href === path) return c;
      } else if (!item.href.includes("?") && item.href === path) {
        return item;
      }
    }
  }
  return null;
}

// 사이드바에 없는 동적 경로의 탭 라벨
const DYNAMIC_ROUTE_LABELS: { test: (p: string) => boolean; label: string }[] = [
  { test: (p) => p === "/admin", label: "대시보드" },
  { test: (p) => p === "/admin/products/new", label: "제품 등록" },
  { test: (p) => /^\/admin\/products\/[^/]+\/edit$/.test(p), label: "제품 수정" },
  { test: (p) => p === "/admin/products/import", label: "제품 가져오기" },
  { test: (p) => p === "/admin/products/main-expose", label: "메인 노출 관리" },
  { test: (p) => /^\/admin\/stores\/[^/]+\/edit$/.test(p), label: "매장 수정" },
];

/** 경로(+쿼리)에 대한 탭 표시용 라벨을 해석한다. */
export function getRouteLabel(pathname: string, searchStr = ""): string {
  const href = pathname + (searchStr ? `?${searchStr}` : "");
  const exact = getNavLeafByHref(href);
  if (exact && exact.href === href) return exact.label;
  for (const d of DYNAMIC_ROUTE_LABELS) if (d.test(pathname)) return d.label;
  const byPath = getNavLeafByHref(pathname);
  if (byPath) return byPath.label;
  // 최장 접두사 매칭
  let best: NavLeaf | null = null;
  let bestLen = 0;
  for (const group of navGroups) {
    for (const item of group.items) {
      const leaves = isDropdown(item) ? item.children : [item];
      for (const l of leaves) {
        const p = l.href.split("?")[0];
        if (p !== "/admin" && (pathname === p || pathname.startsWith(p + "/")) && p.length > bestLen) {
          best = l;
          bestLen = p.length;
        }
      }
    }
  }
  if (best) return best.label;
  const seg = pathname.split("/").filter(Boolean).pop();
  return seg ? decodeURIComponent(seg) : "관리자";
}
