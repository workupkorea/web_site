import type { Metadata } from "next";
import DOMPurify from "isomorphic-dompurify";
import { notFound } from "next/navigation";
import { getPassContextByToken, getNoticeSchedule, getNoticeDateCounts } from "@/lib/notices";
import RefreshButton from "./_components/RefreshButton";
import NoticeViewToggle, { type NoticeItem } from "./_components/NoticeViewToggle";
import PassPageShell from "./_components/PassPageShell";
import DatePickerButton from "./_components/DatePickerButton";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ date?: string }> };

export const revalidate = 0;

function todayKstDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const ctx = await getPassContextByToken(token);
  return { title: ctx ? `${ctx.store.name} — 출고 패스` : "링크를 찾을 수 없음" };
}

export default async function BranchPassPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { date } = await searchParams;
  const todayKst = todayKstDate();
  const selectedDate = date && date !== todayKst ? date : undefined;

  const [ctx, schedule] = await Promise.all([
    getPassContextByToken(token, selectedDate),
    getNoticeSchedule(),
  ]);
  if (!ctx) notFound();

  const dateCounts = await getNoticeDateCounts(ctx.store.id);

  const items: NoticeItem[] = ctx.notices.map((card) => ({
    noticeId: card.notice.id,
    status: card.notice.status,
    productName: card.product?.name ?? "상품 정보 없음",
    badge: card.notice.badge,
    images: [card.product?.image_url, ...(card.product?.detail_image_urls ?? [])].filter(
      (u): u is string => Boolean(u)
    ),
    taglineHtml: card.product?.tagline ? DOMPurify.sanitize(card.product.tagline) : null,
    descriptionHtml: card.notice.description ? DOMPurify.sanitize(card.notice.description) : null,
    extraImages: card.notice.extraImages,
    imagePortrait: card.notice.imagePortrait,
    passStatus: card.passStatus,
    updatedAt: card.updatedAt,
  }));

  return (
    <PassPageShell>
      <div className="w-full max-w-sm">
        {/* 지점명 + 새로고침 */}
        <div className="mb-2 px-1 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-base font-bold text-[#303236] leading-snug">{ctx.store.name}</h1>
            {ctx.store.manager_name && (
              <p className="text-[11px] text-gray-400 mt-0.5">{ctx.store.manager_name}님 반갑습니다</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <a
              href={`/b/${token}/history`}
              className="px-4 py-2 rounded-lg text-[13.5px] font-bold whitespace-nowrap border-2 border-[#303236] bg-[#303236] text-white hover:bg-[#444] hover:border-[#444] transition-colors"
            >
              패스현황
            </a>
            <RefreshButton />
          </div>
        </div>

        {/* 달력 — 항상 펼쳐져 상단에 고정 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-3 py-2.5 mb-4">
          <DatePickerButton
            selectedDate={selectedDate ?? todayKst}
            todayKst={todayKst}
            markedDates={dateCounts}
          />
        </div>

        <div id="notices">
          <NoticeViewToggle
            items={items}
            token={token}
            closeTime={schedule.closeTime}
            emptyMessage={selectedDate ? `${selectedDate} 등록된 공지가 없습니다.` : "오늘 등록된 공지가 없습니다."}
            isHistorical={Boolean(selectedDate)}
          />
        </div>
      </div>
    </PassPageShell>
  );
}
