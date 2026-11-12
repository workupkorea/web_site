"use client";
import { useEffect } from "react";
import { trackHomeClick } from "@/lib/track";

const MAX_LABEL = 40;
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_LABEL);

// 메인 페이지 본문(main 안)의 링크·버튼 클릭을 "섹션 · 요소명"으로 기록한다.
// 섹션은 HomeSections가 data-home-section으로 표시. 상단/하단 메뉴·푸터는 main 밖이라 제외된다.
export default function HomeClickTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const el = target?.closest?.("a, button") as HTMLElement | null;
      if (!el || !el.closest("main")) return;
      const section = clean(el.closest<HTMLElement>("[data-home-section]")?.dataset.homeSection) || "기타";
      const href = el instanceof HTMLAnchorElement ? el.getAttribute("href") ?? "" : "";
      const label =
        clean(el.dataset.track) ||
        clean(el.getAttribute("aria-label")) ||
        clean(el.textContent) ||
        clean(el.querySelector("img")?.getAttribute("alt")) ||
        clean(href) ||
        "(이름 없음)";
      trackHomeClick(`${section} · ${label}`, href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
