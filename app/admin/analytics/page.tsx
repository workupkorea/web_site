import { redirect } from "next/navigation";
import { getAdminMember, SUPER_ADMIN_GRADE } from "@/lib/admin-auth";
import MarketingTabs, { MATE_ADMIN_PATH } from "./_tabs/MarketingTabs";
import PixelsTab from "./_tabs/PixelsTab";
import GiveawayTab from "./_tabs/GiveawayTab";
import NavTab from "./_tabs/NavTab";

const panels = { giveaway: GiveawayTab, nav: NavTab, pixels: PixelsTab };

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const admin = await getAdminMember();
  if (!admin) redirect("/member/login?from=admin");
  const { tab } = await searchParams;
  if (admin.grade !== SUPER_ADMIN_GRADE || tab === "mate") redirect(MATE_ADMIN_PATH);

  const active = tab === "nav" || tab === "pixels" ? tab : "giveaway";
  const Panel = panels[active];
  return (
    <div className="space-y-5">
      <MarketingTabs active={active} superAdmin />
      <Panel />
    </div>
  );
}
