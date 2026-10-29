import type { PartnerInfo } from "@/data/partnership";

// 가맹·창업 / 입점·제휴 페이지 좌측 소개 패널 (순수 표시용).
// 서버 페이지(PartnershipLayout)와 관리자 미리보기에서 공유해 마크업 드리프트를 막는다.
// 크기·색상은 info.styles의 인라인 스타일로 적용한다.
// 페이지 전체 글자 위계에 맞춘 최소 크기 — 관리자 설정이 이보다 작아도 이 크기 이상으로 표시한다.
// 제목은 모바일 26px → PC 32px로 커진다(CSS max/clamp).
const fs = (size: number, min: number) => `max(${size}px, ${min}px)`;

export default function PartnershipPanel({ info }: { info: PartnerInfo }) {
  const st = info.styles;
  // 연락처 칸에 이메일이 들어 있으면(예: 제휴 문의 메일) 전화 대신 메일 아이콘·링크를 쓴다.
  const isEmail = info.phone.includes("@");
  // 장식 글로우 색 — 배경이 푸른 계열(네이비)이면 하늘색, 그 외(차콜 등)는 브랜드 오렌지
  const bgHex = /^#([0-9a-f]{6})$/i.exec(info.panel_bg.trim())?.[1];
  const bgBlue = bgHex ? parseInt(bgHex.slice(4, 6), 16) - parseInt(bgHex.slice(0, 2), 16) > 10 : false;
  // 단계 포인트 색 — 네이비 배경이면 연한 블루, 그 외는 설정된 불릿 색
  const accent = bgBlue ? "#8fb8ff" : st.bullet_color;
  const glow = bgBlue ? "bg-[#3b82f6]/30" : "bg-[#E5541B]/25";
  return (
    <div className="relative isolate overflow-hidden px-8 py-10" style={{ backgroundColor: info.panel_bg }}>
      {/* 장식: 우상단 컬러 글로우 + 좌하단 화이트 글로우 (텍스트 뒤, 클릭 무관) */}
      <div aria-hidden="true" className={`pointer-events-none absolute -top-28 -right-24 -z-10 h-72 w-72 rounded-full ${glow} blur-3xl`} />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-20 -z-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      {info.eyebrow && (
        <p className="tracking-widest uppercase mb-3" style={{ fontSize: fs(st.eyebrow.size, 13), color: st.eyebrow.color }}>
          {info.eyebrow}
        </p>
      )}
      <h2 className="font-extrabold tracking-[-0.03em] leading-tight mb-4" style={{ fontSize: `max(${st.panel_title.size}px, clamp(26px, 2.1vw, 32px))`, color: st.panel_title.color }}>
        {info.panel_title}
      </h2>
      <p className="leading-relaxed" style={{ fontSize: fs(st.panel_desc.size, 15), color: st.panel_desc.color, wordBreak: "keep-all" }}>
        {info.panel_desc}
      </p>
      {info.benefits.length > 0 && (
        // 컴팩트 가로 4열(모바일 2열) — 그라데이션 그라데이션 번호 + 단계명. 칸마다 헤어라인 위에 짧은 강조 바를 얹는다.
        <ol className="mt-6 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4">
          {info.benefits.map((item, i) => (
            <li key={i} className="relative border-t border-white/15 pt-3">
              <span aria-hidden="true" className="absolute -top-px left-0 h-[2px] w-6" style={{ backgroundColor: accent }} />
              <span
                aria-hidden="true"
                className="block text-[24px] font-light leading-none tabular-nums tracking-tight bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(135deg, ${accent}, rgba(255,255,255,0.35))` }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="mt-2 font-semibold leading-snug tracking-[-0.02em]" style={{ fontSize: fs(st.benefits.size, 14), color: "#ffffff", wordBreak: "keep-all" }}>
                {item}
              </p>
            </li>
          ))}
        </ol>
      )}
      {/* 문의 전화 안내: 라벨·전화번호·문의 시간을 같은 텍스트 스타일로 표기.
          PC(xl 이상)는 한 줄, 그 미만(모바일·태블릿)은 2줄(라벨 / 전화번호 | 시간) */}
      <div className="mt-7 pt-6 border-t border-white/15 flex flex-col gap-1 xl:flex-row xl:items-center xl:gap-3 font-medium text-white" style={{ fontSize: 17 }}>
        <p className="flex items-center gap-2 whitespace-nowrap">
          <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
            {isEmail ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 0l9 6 9-6" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.68l1.5 4.5a1 1 0 01-.5 1.2l-2.26 1.13a11 11 0 005.52 5.52l1.13-2.26a1 1 0 011.2-.5l4.5 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" />
            )}
          </svg>
          {info.phone_label}
        </p>
        <div className="flex items-center gap-3">
          {/* 모바일에서 바로 전화 연결되도록 tel: 링크, 이메일이면 mailto: (터치 영역 44px 이상) */}
          <a
            href={isEmail ? `mailto:${info.phone.trim()}` : `tel:${info.phone.replace(/[^0-9+]/g, "")}`}
            className="inline-flex items-center min-h-11 tracking-[-0.01em] hover:opacity-80 transition-opacity"
          >
            {info.phone}
          </a>
          {info.hours && (
            <>
              <span className="w-px h-4 bg-white/25" aria-hidden="true" />
              <span>{info.hours}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
