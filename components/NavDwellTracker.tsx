"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { takeNavPending, trackNavDwell } from "@/lib/track";

// 상단 메뉴로 이동해 온 페이지의 체류시간(화면이 보이는 시간만)을 측정해 이탈 시 1회 전송한다.
export default function NavDwellTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const pending = takeNavPending(pathname ?? "");
    if (!pending) return;

    let visibleMs = 0;
    let startedAt: number | null = document.visibilityState === "visible" ? Date.now() : null;
    let sent = false;

    const pause = () => {
      if (startedAt != null) {
        visibleMs += Date.now() - startedAt;
        startedAt = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") startedAt = Date.now();
      else pause();
    };
    const flush = () => {
      if (sent) return;
      sent = true;
      pause();
      trackNavDwell(pending, Math.round(visibleMs / 1000));
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush(); // 다른 페이지로 이동(경로 변경) 시
    };
  }, [pathname]);

  return null;
}
