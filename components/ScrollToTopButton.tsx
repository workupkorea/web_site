"use client";
import { useEffect, useState } from "react";

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = () => {
      // window 스크롤(공개 페이지) + #scroll-root 스크롤(일부 모바일 컨테이너) 모두 감지
      const winY = window.scrollY;
      const rootY = document.getElementById("scroll-root")?.scrollTop ?? 0;
      setVisible(winY > 300 || rootY > 300);
    };

    const scrollRoot = document.getElementById("scroll-root");
    window.addEventListener("scroll", check, { passive: true });
    scrollRoot?.addEventListener("scroll", check, { passive: true });
    check();

    return () => {
      window.removeEventListener("scroll", check);
      scrollRoot?.removeEventListener("scroll", check);
    };
  }, []);

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("scroll-root")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      onClick={scrollTop}
      aria-label="맨 위로"
      className={`fixed bottom-24 right-4 sm:bottom-8 sm:right-6 z-50
        w-11 h-11 rounded-full bg-[#1a1a1a]/70 hover:bg-[#1a1a1a] text-white
        flex items-center justify-center shadow-lg backdrop-blur-sm
        transition-all duration-300
        ${visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}
