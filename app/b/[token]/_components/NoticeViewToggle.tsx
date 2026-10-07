"use client";
import { useEffect, useState } from "react";
import CloseCountdown from "./CloseCountdown";
import PassToggle from "./PassToggle";
import PushSubscribeButton from "./PushSubscribeButton";
import NoticeCard from "./NoticeCard";
import { useIsPastClose } from "@/lib/hooks/useIsPastClose";

export type NoticeItem = {
  noticeId: string;
  status: "대기" | "진행중" | "마감";
  productName: string;
  badge?: string | null;
  images: string[];
  taglineHtml: string | null;
  descriptionHtml: string | null;
  extraImages: string[];
  imagePortrait?: boolean;
  passStatus: "출고" | "패스";
  updatedAt: string | null;
};

type ViewMode = "card" | "list";

export default function NoticeViewToggle({
  items,
  token,
  closeTime,
  emptyMessage = "오늘 등록된 공지가 없습니다.",
  isHistorical = false,
}: {
  items: NoticeItem[];
  token: string;
  closeTime: string;
  emptyMessage?: string;
  // 오늘이 아닌 지난 날짜 조회 화면 — 기본 보기를 목록형으로 강제한다(오늘 화면의 저장된 설정과 무관).
  isHistorical?: boolean;
}) {
  const [view, setView] = useState<ViewMode>("card");
  // 마감 크론이 아직 안 돌았어도 브라우저 시계로 마감 시각이 지났으면 즉시 마감 취급.
  const isPastClose = useIsPastClose(closeTime);

  useEffect(() => {
    // 지난 날짜 조회는 목록형으로 강제, 오늘 화면은 항상 카드형으로 시작
    if (isHistorical) setView("list");
    else setView("card");
  }, [isHistorical]);

  const changeView = (next: ViewMode) => {
    setView(next);
  };

  return (
    <div>
      {items.length > 0 && (
        <p className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-center text-[12.5px] font-semibold text-amber-800">
          상품 사진을 누르면 크게 볼 수 있어요.
        </p>
      )}
      <div className="flex items-center justify-between gap-2 mb-3">
        <PushSubscribeButton token={token} />
        <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 rounded-lg flex-shrink-0">
          <button
            type="button"
            onClick={() => changeView("card")}
            className={`px-2.5 py-1.5 text-[12px] font-semibold rounded-md transition-colors ${
              view === "card" ? "bg-white text-[#303236] shadow-sm" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            카드형
          </button>
          <button
            type="button"
            onClick={() => changeView("list")}
            className={`px-2.5 py-1.5 text-[12px] font-semibold rounded-md transition-colors ${
              view === "list" ? "bg-white text-[#303236] shadow-sm" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            목록형
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 py-16 text-center text-sm text-gray-400">
          {emptyMessage}
        </div>
      ) : view === "list" ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          {items.map((item) => {
            const effectiveStatus = item.status === "진행중" && isPastClose ? "마감" : item.status;
            return (
              <div key={item.noticeId} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-[13.5px] font-semibold text-gray-900 truncate">{item.productName}</p>
                  {effectiveStatus === "진행중" && <CloseCountdown closeTime={closeTime} compact />}
                </div>
                <PassToggle
                  token={token}
                  noticeId={item.noticeId}
                  noticeStatus={effectiveStatus}
                  initialStatus={item.passStatus}
                  initialUpdatedAt={item.updatedAt}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <NoticeCard key={item.noticeId} item={item} token={token} closeTime={closeTime} />
          ))}
        </div>
      )}
    </div>
  );
}
