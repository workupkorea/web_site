"use client";
import TempProductReveal from "./TempProductReveal";
import VerticalImageStack from "./VerticalImageStack";
import CloseCountdown from "./CloseCountdown";
import { usePassStatus, STATUS_PILL } from "./usePassStatus";
import { useIsPastClose } from "@/lib/hooks/useIsPastClose";
import type { NoticeItem } from "./NoticeViewToggle";

// 카드형 한 장 — 상단에 마감 카운트다운 + 현재 상태(출고/패스) 뱃지를 나란히 보여주고,
// 하단엔 단일 토글 버튼 하나로만 조작한다(두 버튼을 나란히 두면 헷갈린다는 피드백 반영).
export default function NoticeCard({ item, token, closeTime }: { item: NoticeItem; token: string; closeTime: string }) {
  const { status, updatedAt, saving, error, toggle } = usePassStatus(token, item.noticeId, item.passStatus, item.updatedAt);
  // 마감 크론이 아직 안 돌아 item.status가 "진행중"으로 남아있어도, 브라우저 시계로 마감 시각이
  // 지났으면 화면에서 즉시 마감 처리한다(패스 버튼 자체를 숨김). 실제 저장은 서버가 다시 검증.
  const isPastClose = useIsPastClose(closeTime);
  const isClosed = item.status === "마감" || (item.status === "진행중" && isPastClose);
  const closed = item.status !== "진행중" || isPastClose;

  return (
    <div className={`rounded-2xl shadow-sm border p-6 ${isClosed ? "bg-gray-100 border-gray-200" : "bg-white border-gray-100"}`}>
      {item.badge && (
        <div className="mb-3">
          <span className="inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-orange-100 text-orange-700 border border-orange-200">
            {item.badge}
          </span>
        </div>
      )}
      {!closed ? (
        <div className="flex items-stretch gap-2 mb-3">
          <div
            className={`flex-shrink-0 flex items-center justify-center px-4 text-[15px] font-bold rounded-xl ${STATUS_PILL[status]}`}
          >
            {status}
          </div>
          <div className="flex-1 min-w-0">
            <CloseCountdown closeTime={closeTime} noMargin />
          </div>
        </div>
      ) : (
        <div className="flex justify-end mb-2">
          <p className="text-xl font-black text-gray-400 tracking-wide">마감</p>
        </div>
      )}

      <div className={`rounded-xl border p-3.5 mb-4 ${isClosed ? "border-gray-200" : "border-gray-100"}`}>
        <TempProductReveal
          images={item.images}
          name={item.productName}
          portrait={item.imagePortrait}
          tagline={
            item.taglineHtml ? (
              <div className="text-[13.5px] text-gray-500 mt-0.5 [&_p]:m-0" dangerouslySetInnerHTML={{ __html: item.taglineHtml }} />
            ) : undefined
          }
        />

        {(item.descriptionHtml || item.extraImages.length > 0) && (
          <div className="mt-3.5 pt-3.5 border-t border-gray-100">
            {item.descriptionHtml && (
              <div className="text-[13.5px] text-gray-600 mb-3 [&_p]:m-0" dangerouslySetInnerHTML={{ __html: item.descriptionHtml }} />
            )}
            {item.extraImages.length > 0 && <VerticalImageStack images={item.extraImages} alt="추가 사진" />}
          </div>
        )}
      </div>

      {closed ? (
        <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${STATUS_PILL[status]}`}>
          {status} (최종)
        </span>
      ) : (
        <div>
          {error && (
            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-[12.5px] rounded-lg">{error}</div>
          )}
          <button
            onClick={toggle}
            disabled={saving}
            className={`w-full py-3 text-sm font-bold rounded-xl disabled:opacity-50 ${
              status === "출고"
                ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                : "bg-[#303236] text-white hover:bg-[#1f2124]"
            }`}
          >
            {saving ? "처리 중..." : status === "출고" ? "패스 신청하기" : "패스 취소하기"}
          </button>
          <p className="mt-2.5 text-center text-[11.5px] text-gray-400">
            {status === "출고"
              ? "패스하지 않으면 자동으로 출고됩니다."
              : updatedAt
              ? `${new Date(updatedAt).toLocaleString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 변경됨 · 마감 전까지 자유롭게 변경 가능합니다.`
              : "마감 전까지 자유롭게 변경 가능합니다."}
          </p>
        </div>
      )}
    </div>
  );
}
