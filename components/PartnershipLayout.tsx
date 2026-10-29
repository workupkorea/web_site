import type { PartnerInfo } from "@/data/partnership";
import PartnershipPanel from "./PartnershipPanel";
import InquiryBoard from "./InquiryBoard";
import PartnershipTabs from "./PartnershipTabs";
import { PartnershipShell, MobileTabBar } from "./PartnershipShell";

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
        <div className="w-full lg:px-[70px] space-y-8">
          <PartnershipShell>
          <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-0 lg:gap-6 items-stretch">
            {/* 좌: 소개 패널 + 폼 (세로 스택) — 모바일은 여백 없는 전체화면형, lg 이상은 카드형 */}
            <div className="flex flex-col border-0 lg:border border-gray-200/70 bg-white overflow-hidden min-w-0">
              {/* 창업안내 탭이 있으면 혜택 목록은 우측 안내로 옮겨 표시하고 영문 보조 문구(eyebrow)는 쓰지 않으므로 좌측 패널에서는 뺀다 */}
              <PartnershipPanel info={guide ? { ...info, benefits: [], eyebrow: "" } : info} />

              {/* 모바일: '문의하기 | 창업안내' 탭 (PC는 우측 탭을 사용) */}
              {guide && <MobileTabBar />}

              {/* 모바일에서 '창업안내' 탭 선택 시 폼 숨김 */}
              <div className="px-6 sm:px-8 py-8 max-lg:group-data-[mtab=guide]/m:hidden">
                <h3 className="font-extrabold tracking-[-0.03em]" style={{ fontSize: `max(${st.form_title.size}px, clamp(20px, 1.6vw, 24px))`, color: st.form_title.color }}>
                  {info.form_title}
                </h3>
                {info.form_desc ? (
                  <p className="mt-1.5 mb-6" style={{ fontSize: Math.max(st.form_desc.size, 15), color: st.form_desc.color }}>
                    {info.form_desc}
                  </p>
                ) : (
                  <div className="mb-6" />
                )}
                {children}
              </div>
            </div>

            {/* 우: 실시간 문의 현황 — 데스크톱은 좌측 칼럼 높이에 맞춰 내부 스크롤, 모바일은 고정 높이
                (창업안내가 있으면 모바일에서 안내(선택 시)+문의현황 리스트를 아래로 이어 붙임) */}
            <div className={`relative lg:h-auto min-w-0 ${guide ? "max-lg:mt-3" : "h-[600px]"}`}>
              <div className={`lg:h-full lg:absolute lg:inset-0 ${guide ? "" : "h-full"}`}>
                {/* 창업안내가 있으면 '창업안내 | 문의현황' 탭(창업안내가 먼저), 없으면 보드만 */}
                {guide ? (
                  <PartnershipTabs
                    tabs={[
                      {
                        key: "guide",
                        label: "창업안내",
                        scroll: true,
                        content: guide,
                        mobile: "guide",
                      },
                      { key: "board", label: "문의현황", content: <InquiryBoard type={boardType} />, mobile: "always" },
                    ]}
                  />
                ) : (
                  <InquiryBoard type={boardType} />
                )}
              </div>
            </div>
          </div>
          </PartnershipShell>
        </div>
      </div>
    </main>
  );
}
