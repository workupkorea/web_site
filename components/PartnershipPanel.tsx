import type { PartnerInfo } from "@/data/partnership";

// 가맹·창업 / 입점·제휴 페이지 좌측 소개 패널 (순수 표시용).
// 서버 페이지(PartnershipLayout)와 관리자 미리보기에서 공유해 마크업 드리프트를 막는다.
// 크기·색상은 info.styles의 인라인 스타일로 적용한다.
export default function PartnershipPanel({ info }: { info: PartnerInfo }) {
  const st = info.styles;
  return (
    <div className="px-8 py-10" style={{ backgroundColor: info.panel_bg }}>
      <p className="tracking-widest uppercase mb-3" style={{ fontSize: st.eyebrow.size, color: st.eyebrow.color }}>
        {info.eyebrow}
      </p>
      <h2 className="font-extrabold tracking-[-0.03em] mb-4" style={{ fontSize: st.panel_title.size, color: st.panel_title.color }}>
        {info.panel_title}
      </h2>
      <p className="leading-relaxed" style={{ fontSize: st.panel_desc.size, color: st.panel_desc.color }}>
        {info.panel_desc}
      </p>
      {info.benefits.length > 0 && (
        <ul className="mt-7 space-y-3">
          {info.benefits.map((item, i) => (
            <li
              key={i}
              className="flex items-center gap-2"
              style={{ fontSize: st.benefits.size, color: st.benefits.color }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: st.bullet_color }}
              />
              {item}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-7 pt-6 border-t border-white/15">
        <p className="tracking-widest uppercase mb-1" style={{ fontSize: st.phone_label.size, color: st.phone_label.color }}>
          {info.phone_label}
        </p>
        {/* 모바일에서 바로 전화 연결되도록 tel: 링크 (터치 영역 44px 이상) */}
        <a
          href={`tel:${info.phone.replace(/[^0-9+]/g, "")}`}
          className="inline-flex items-center gap-2 min-h-11 font-semibold tracking-[-0.01em] hover:opacity-80 transition-opacity"
          style={{ fontSize: st.phone.size, color: st.phone.color }}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.68l1.5 4.5a1 1 0 01-.5 1.2l-2.26 1.13a11 11 0 005.52 5.52l1.13-2.26a1 1 0 011.2-.5l4.5 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" />
          </svg>
          {info.phone}
        </a>
        <p className="mt-0.5" style={{ fontSize: st.hours.size, color: st.hours.color }}>
          {info.hours}
        </p>
      </div>
    </div>
  );
}
