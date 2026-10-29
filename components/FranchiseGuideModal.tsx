"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import FranchiseGuide from "./FranchiseGuide";
import type { FranchiseGuideConfig } from "@/data/franchise-guide";

// 문의 페이지에서 '창업안내'를 페이지 이동 없이 팝업(모달)으로 띄우는 버튼.
export default function FranchiseGuideModal({ label = "창업안내 보기", config, storeCount }: {
  label?: string;
  config?: FranchiseGuideConfig;
  storeCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  // 팝업을 닫고 문의 폼의 '이름' 입력란으로 스크롤·포커스 이동
  const goToNameField = () => {
    setOpen(false);
    setTimeout(() => {
      const nameInput = document.getElementById("pf-name");
      nameInput?.scrollIntoView({ behavior: "smooth", block: "center" });
      nameInput?.focus();
    }, 200);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 w-full bg-black/20 border-t border-white/15 text-white text-sm font-bold min-h-[52px] hover:bg-[#E5541B] transition-colors"
      >
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
        {label}
        <span aria-hidden>→</span>
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pt-6 sm:p-6 bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="워크업 창업안내"
        >
          <div
            className="relative w-full sm:w-[min(960px,calc(100vw-48px))] max-h-[88dvh] flex flex-col overflow-hidden rounded-t-[20px] sm:rounded-[22px] border border-white/10 shadow-2xl bg-[#0d0d0d]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-h-0 overflow-y-auto overscroll-contain">
              <FranchiseGuide embedded config={config} storeCount={storeCount} onClose={() => setOpen(false)} />
            </div>

            {/* 하단 고정 CTA (PC·모바일 공통) */}
            <div className="flex-shrink-0 p-3 border-t border-white/10 bg-[#0d0d0d]/95 backdrop-blur">
              <button
                type="button"
                onClick={goToNameField}
                className="flex items-center justify-center w-full min-h-[48px] rounded-xl bg-[#ff4d00] text-white text-sm font-extrabold"
              >
                창업 상담 신청하기
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
