"use client";

import { useEffect, useRef } from "react";
import NoticesPage from "@/app/notices/page";

// 관리자 화면에서만 보여줄 버튼 이름 (단독 페이지의 원문은 그대로 둔다)
const LABELS: Record<string, string> = { "공지 & 현황": "공지 및 현황", "지점 화면 보기": "지점 화면", "공지 수정": "수정" };

// 탭 줄 오른쪽에 놓이는 외부 링크 버튼 (단독 화면 /notices)
export function PassNewWindowButton() {
  return (
    <a
      href="/notices"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 min-h-[44px] px-4 text-sm font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 rounded-full whitespace-nowrap"
    >
      새 창으로 열기
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

// 지점 출고 패스 — 관리자 화면 안에 /notices 화면을 직접 렌더링한다(iframe 아님 → 이중 스크롤·폭 깨짐 방지).
export default function PassTab() {
  const ref = useRef<HTMLDivElement>(null);

  // 버튼 글자만 바꿔 표시 (React가 글자를 갱신해도 다시 적용)
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const apply = () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = n.nodeValue?.trim() ?? "";
        // 버튼 글자만 대상 (모달 제목 등 다른 문구는 건드리지 않는다)
        if (LABELS[t] && n.parentElement?.tagName === "BUTTON") n.nodeValue = LABELS[t];
      }
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(root, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, []);

  return (
    <>
      {/* 관리자 내부 화면 전용 보정 — .pass-embed 안에서만 적용되어 단독 페이지(/notices)에는 영향이 없다 */}
      <style>{`
        .pass-embed div:has(> table) { overflow-x: auto; }
        .pass-embed table td:last-child > .inline-flex { flex-wrap: wrap; justify-content: flex-end; max-width: 170px; }
        .pass-embed table td:last-child > .inline-flex > button { white-space: nowrap; }
        .pass-embed table td:nth-last-child(2) > div { flex-wrap: wrap; row-gap: 4px; }
        @media (min-width: 1024px) { .pass-embed nav { width: 8.5rem; } }
        .pass-embed nav button { padding-left: 0.625rem; padding-right: 0.625rem; }
      `}</style>
      <div ref={ref} className="pass-embed">
        <NoticesPage />
      </div>
    </>
  );
}
