"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminSectionNav, { ADMIN_SECTION_NAV_IN_CONTENT } from "./AdminSectionNav";

// "고객 문의" 아래 페이지(문의 관리·B2B·페이지 편집 3종)를 하나의 탭 UI로 묶는다.
// 사이드바에는 "문의 관리" 하나만 남기고, 나머지는 이 탭바로 이동한다(실제 페이지/라우트는 그대로 유지).

const PAGE_EDIT_ROUTES = [
  { label: "가맹·입점 페이지 편집", href: "/admin/partnership" },
  { label: "창업안내 페이지 편집", href: "/admin/franchise-guide" },
  { label: "고객센터 페이지 편집", href: "/admin/support" },
];

const TOP_TABS = [
  { label: "문의 관리", href: "/admin/inquiries" },
  { label: "B2B", href: "/admin/b2b" },
  { label: "페이지 편집", href: PAGE_EDIT_ROUTES[0].href, isPageEdit: true },
];

export default function InquiryTabs() {
  const pathname = usePathname();
  const isPageEditActive = PAGE_EDIT_ROUTES.some((r) => pathname.startsWith(r.href));

  return (
    <div className="mb-6">
      <AdminSectionNav
        label="고객 문의"
        className={ADMIN_SECTION_NAV_IN_CONTENT}
        links={TOP_TABS.map(({ label, href, isPageEdit }) => ({
          label, href, active: isPageEdit ? isPageEditActive : pathname === href,
        }))}
      />
      {isPageEditActive && (
        <div className="flex flex-wrap gap-2 mt-3">
          {PAGE_EDIT_ROUTES.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                pathname === r.href ? "bg-[#303236] text-white border-[#303236]" : "border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
