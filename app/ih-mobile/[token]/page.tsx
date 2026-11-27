import { notFound } from "next/navigation";
import { isValidIHMobileViewerToken } from "@/lib/ih/mobile-viewer";
import { searchInfluencers } from "@/lib/ih/influencers";
import { searchSponsors, searchBranchMarketing, searchBrandedPpl } from "@/lib/ih/collabs";
import { getIHDashboardData, getIHIntegratedDashboardData } from "@/lib/ih/dashboard";
import IHMobileStandaloneApp from "@/components/ih/mobile/IHMobileStandaloneApp";

// 관리자 로그인 없이 링크(토큰)만으로 여는 실제 모바일 페이지. 토큰은 /admin/influencer-hub/mobile(로그인 필요)에서
// 발급/재발급한다 — 이 라우트 자체는 app/admin 트리 밖에 있어 로그인 리다이렉트를 타지 않는다.
export default async function IHMobileStandalonePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ok = await isValidIHMobileViewerToken(token);

  // 잘못된·만료된 토큰은 404 (안내 문구는 같은 폴더의 not-found.tsx)
  if (!ok) notFound();

  const [influencersRes, sponsorsRes, branchRes, pplRes, dashboardData, integratedDashboardData] = await Promise.all([
    searchInfluencers({ pageSize: 500 }),
    searchSponsors({ pageSize: 500 }),
    searchBranchMarketing({ pageSize: 500 }),
    searchBrandedPpl({ pageSize: 500 }),
    getIHDashboardData(),
    getIHIntegratedDashboardData({ period: "this_month" }),
  ]);

  return (
    <IHMobileStandaloneApp
      influencers={influencersRes.items}
      influencersTotal={influencersRes.total}
      sponsors={sponsorsRes.items}
      branchMarketing={branchRes.items}
      brandedPpl={pplRes.items}
      dashboardData={dashboardData}
      integratedDashboardData={integratedDashboardData}
    />
  );
}
