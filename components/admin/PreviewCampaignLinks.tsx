"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 관리자 예약 미리보기(/magazine-preview?campaign=1) 전용.
// 예약 오픈 전 기획전의 상세 링크(/products/feature/…)는 공개 규칙상 404라서,
// 미리보기 안에서 누른 링크에만 ?campaign=1 을 붙여 관리자에게 열어 준다. 공개 사이트에는 쓰이지 않는다.
const FEATURE_PATH = /^\/products\/feature\/[^/?#]+\/[^/?#]+/;

export default function PreviewCampaignLinks() {
  const router = useRouter();
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a || a.target === "_blank") return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || !FEATURE_PATH.test(url.pathname) || url.searchParams.has("campaign")) return;
      e.preventDefault();
      url.searchParams.set("campaign", "1");
      router.push(url.pathname + url.search + url.hash);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);
  return null;
}
