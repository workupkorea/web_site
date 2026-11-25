import AdminSectionNav, { ADMIN_SECTION_NAV_IN_CONTENT } from "@/components/admin/AdminSectionNav";

export const MATE_ADMIN_PATH = "/admin/mate";

const tabs = [
  { key: "giveaway", label: "댓글추첨기", href: "/admin/analytics?tab=giveaway" },
  { key: "nav", label: "메뉴분석", href: "/admin/analytics?tab=nav" },
  { key: "pixels", label: "픽셀/광고", href: "/admin/analytics?tab=pixels" },
  { key: "mate", label: "메이트 관리", href: MATE_ADMIN_PATH },
] as const;

export default function MarketingTabs({ active, superAdmin }: { active: (typeof tabs)[number]["key"]; superAdmin: boolean }) {
  const visibleTabs = superAdmin ? tabs : tabs.filter(({ key }) => key === "mate");
  return (
    <AdminSectionNav
      label="마케팅/분석"
      className={ADMIN_SECTION_NAV_IN_CONTENT}
      links={visibleTabs.map(({ key, label, href }) => ({ label, href, active: key === active }))}
    />
  );
}
