"use client";
import { useEffect } from "react";

// ── 개인정보 수집·이용 동의 안내 모달 ──
// 가맹·창업 / 입점·제휴 / 단체복·대량구매 문의 폼이 공통으로 사용한다.
// 수집 항목은 폼마다 달라서 collectedItems 로 받고, 기본값은 기존 가맹·입점 폼과 동일하다.
export default function PrivacyConsentModal({
  onClose,
  collectedItems = "이름, 연락처",
}: {
  onClose: () => void;
  collectedItems?: string;
}) {
  // ESC 닫기 + 모달 동안 배경 스크롤 잠금
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-modal-title"
    >
      <div
        className="bg-white w-full max-w-md max-h-[85vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 id="consent-modal-title" className="text-sm font-bold text-[#303236]">개인정보 수집·이용 동의</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-8 h-8 -mr-2 flex items-center justify-center text-gray-400 hover:text-[#303236] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div className="px-5 py-5 text-xs text-gray-600 leading-relaxed space-y-4">
          <p>워크업은 문의 접수 및 상담을 위해 아래와 같이 개인정보를 수집·이용합니다.</p>

          <table className="w-full border-t border-gray-200 text-left">
            <tbody className="divide-y divide-gray-100">
              <tr>
                <th className="py-2.5 pr-3 align-top font-medium text-[#303236] whitespace-nowrap w-24">수집 항목</th>
                <td className="py-2.5 text-gray-600">{collectedItems}</td>
              </tr>
              <tr>
                <th className="py-2.5 pr-3 align-top font-medium text-[#303236] whitespace-nowrap">수집·이용 목적</th>
                <td className="py-2.5 text-gray-600">문의 접수 및 상담 안내</td>
              </tr>
              <tr>
                <th className="py-2.5 pr-3 align-top font-medium text-[#303236] whitespace-nowrap">보유·이용 기간</th>
                <td className="py-2.5 text-gray-600">문의 처리 완료 후 지체 없이 파기 (관계 법령에 따라 보관이 필요한 경우 해당 기간 동안 보관)</td>
              </tr>
            </tbody>
          </table>

          <p className="text-gray-500">
            귀하는 개인정보 수집·이용에 동의하지 않으실 수 있으며, 동의하지 않으실 경우 문의 접수가 제한됩니다.
          </p>

          <p className="text-gray-400">
            자세한 내용은{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline text-[#303236] hover:text-[#E5541B]">
              개인정보처리방침
            </a>
            에서 확인하실 수 있습니다.
          </p>
        </div>

        {/* 푸터 */}
        <div className="px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-[#303236] text-white text-xs font-semibold tracking-widest py-2.5 hover:bg-[#E5541B] transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
