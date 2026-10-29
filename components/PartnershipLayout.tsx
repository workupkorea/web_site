import Link from "next/link";
import type { PartnerInfo } from "@/data/partnership";
import PartnershipPanel from "./PartnershipPanel";
import InquiryBoard from "./InquiryBoard";
import PartnershipTabs, { FocusFormButton } from "./PartnershipTabs";

// 가맹·창업 / 입점·제휴 문의 페이지 공통 레이아웃 (서버 컴포넌트, 폼은 children으로 주입)
// 좌: 소개 패널 + 문의 폼(세로 스택) / 우: 문의 현황 보드 (guide가 있으면 문의현황·창업안내 탭)
// 패널 배경색·글자 크기·색상은 info(관리자 편집값)로 제어한다.
export default function PartnershipLayout({ info, boardType, guide, children }: {
  info: PartnerInfo;
  boardType?: string;             // "franchise" | "wholesale" — 우측 보드를 해당 유형만 표시
  guide?: React.ReactNode;        // 있으면 우측에 '창업안내' 탭으로 노출(예: 창업안내 콘텐츠)
  children: React.ReactNode;
}) {
  const st = info.styles;
  return (
    <main>
      <div className="bg-[#FAFAF8] pb-8 lg:pt-8">
        <div className="max-w-6xl xl:max-w-[1360px] mx-auto lg:px-6 space-y-8">
          <div className="grid lg:grid-cols-2 gap-0 lg:gap-6 items-stretch">
            {/* 좌: 소개 패널 + 폼 (세로 스택) — 모바일은 여백 없는 전체화면형, lg 이상은 카드형 */}
            <div className="flex flex-col border-0 lg:border border-gray-200 bg-white overflow-hidden min-w-0">
              <PartnershipPanel info={info} />

              <div className="px-6 sm:px-8 py-8">
                <h3 className="font-extrabold tracking-[-0.03em]" style={{ fontSize: st.form_title.size, color: st.form_title.color }}>
                  {info.form_title}
                </h3>
                {info.form_desc ? (
                  <p className="mt-1.5 mb-6" style={{ fontSize: st.form_desc.size, color: st.form_desc.color }}>
                    {info.form_desc}
                  </p>
                ) : (
                  <div className="mb-6" />
                )}
                {children}
              </div>
            </div>

            {/* 우: 실시간 문의 현황 — 데스크톱은 좌측 칼럼 높이에 맞춰 내부 스크롤, 모바일은 고정 높이 */}
            <div className="relative h-[600px] lg:h-auto min-w-0">
              <div className="h-full lg:absolute lg:inset-0">
                {/* 창업안내가 있으면 '문의현황 | 창업안내' 탭, 없으면 보드만 */}
                {guide ? (
                  <PartnershipTabs
                    tabs={[
                      { key: "board", label: "문의현황", content: <InquiryBoard type={boardType} /> },
                      {
                        key: "guide",
                        label: "창업안내",
                        scroll: true,
                        content: (
                          <>
                            {guide}
                            <FocusFormButton>창업 상담 신청하기</FocusFormButton>
                          </>
                        ),
                      },
                    ]}
                  />
                ) : (
                  <InquiryBoard type={boardType} />
                )}
              </div>
            </div>
          </div>

          {/* 페이지 간 이동 */}
          <div className="flex items-center justify-center gap-5 text-xs flex-wrap px-6 lg:px-0">
            <Link href="/partnership/franchise" className="text-[#303236] underline hover:text-[#E5541B] transition-colors">가맹·창업 문의</Link>
            <Link href="/partnership/wholesale" className="text-[#303236] underline hover:text-[#E5541B] transition-colors">브랜드 입점·제휴 문의</Link>
            <Link href="/products" className="text-[#303236] underline hover:text-[#E5541B] transition-colors">제품 라인업 보기</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
