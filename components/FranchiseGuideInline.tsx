import type { FranchiseGuideConfig } from "@/data/franchise-guide";
import { GoFormButton } from "./PartnershipShell";

// 가맹 문의 페이지 안에 직접 보여주는 창업안내 (모바일 우선 반응형).
// 텍스트·수치·이미지·포인트 색은 관리자 편집값(franchise_guide)을 그대로 사용하고,
// 글자 크기·간격은 사이트 공통 규칙(각진 모서리, 얇은 선, 굵고 좁은 자간)에 맞춰 이 컴포넌트가 정한다.
// /franchise 페이지와 팝업은 기존 FranchiseGuide를 그대로 쓴다.
const LINE = "border-white/10";

function SectionHead({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-6 md:mb-8">
      <h2 className="text-[20px] md:text-[24px] font-extrabold tracking-[-0.03em] text-white leading-tight">{title}</h2>
      {desc && <p className="mt-2 text-[15px] md:text-base text-white/55 leading-relaxed" style={{ wordBreak: "keep-all" }}>{desc}</p>}
    </div>
  );
}

export default function FranchiseGuideInline({ config, storeCount = 0, supports = [] }: {
  config: FranchiseGuideConfig;
  storeCount?: number;
  supports?: string[];
}) {
  const col = config.colors;
  const accent = col.accent;
  const count = storeCount > 0 ? storeCount : config.count_fallback;
  const heroDesc = config.hero_desc.replace("{count}", count.toLocaleString());
  const stats = [...config.stats, { value: `${count.toLocaleString()}${config.store_stat_unit}`, label: config.store_stat_label }];

  return (
    <div className="flex flex-col min-h-full text-white" style={{ backgroundColor: col.page_bg }}>
      {/* 히어로 */}
      <section className={`relative overflow-hidden border-b ${LINE}`}>
        <div
          className="absolute inset-0"
          style={{ background: config.hero_bg_img ? `url(${config.hero_bg_img}) center / cover no-repeat` : "linear-gradient(135deg,#242424,#111 65%)" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,.88) 100%)" }} aria-hidden="true" />
        <div className="relative z-10 px-5 sm:px-8 md:px-12 pt-14 pb-12 sm:pt-16 md:pt-24 md:pb-20">
          <h1 className="whitespace-pre-line font-extrabold tracking-[-0.04em] leading-[1.18] text-[24px] sm:text-[28px] md:text-[clamp(30px,2.5vw,42px)] max-w-3xl">
            {config.hero_title}
          </h1>
          <p className="mt-4 md:mt-6 md:whitespace-pre-line text-[13.5px] sm:text-[14.5px] md:text-lg leading-relaxed text-white/70 max-w-2xl" style={{ wordBreak: "keep-all" }}>
            {heroDesc}
          </p>
        </div>
      </section>

      {/* 핵심 수치 */}
      <section className={`grid grid-cols-3 border-b ${LINE}`} aria-label="워크업 창업 핵심 수치">
        {stats.map((st, i) => (
          <div key={i} className={`px-2 py-6 md:py-10 text-center ${i > 0 ? `border-l ${LINE}` : ""}`}>
            <strong className="block font-extrabold tracking-[-0.03em] text-[22px] sm:text-[26px] md:text-[clamp(30px,2.6vw,44px)] leading-none" style={{ color: accent }}>
              {st.value}
            </strong>
            <span className="mt-2.5 block text-xs md:text-sm text-white/55">{st.label}</span>
          </div>
        ))}
      </section>

      {/* 본사 지원 */}
      {supports.length > 0 && (
        <section className={`px-5 sm:px-8 md:px-12 py-10 md:py-14 border-b ${LINE}`}>
          <SectionHead title="본사가 함께 지원합니다" />
          <ul className={`grid grid-cols-1 sm:grid-cols-2 border-t border-l ${LINE}`}>
            {supports.map((item, i) => (
              <li key={i} className={`flex items-center gap-4 sm:block border-r border-b ${LINE} px-5 py-4 sm:p-5 md:p-6`} style={{ backgroundColor: col.card_bg }}>
                <span className="flex-shrink-0 sm:block text-xs font-bold tracking-[0.12em]" style={{ color: accent }}>{String(i + 1).padStart(2, "0")}</span>
                <span className="sm:mt-2 block text-[15px] md:text-lg font-bold leading-snug tracking-[-0.02em]" style={{ wordBreak: "keep-all" }}>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 창업 포인트 */}
      <section className={`px-5 sm:px-8 md:px-12 py-10 md:py-14 border-b ${LINE} md:flex-1 md:flex md:flex-col md:justify-center`}>
        <SectionHead title={config.section_title} desc={config.section_desc} />
        <div className={`grid md:grid-cols-3 border-t ${LINE}`}>
          {config.benefits.map((b, i) => (
            <article
              key={i}
              className={`flex gap-4 md:block py-6 md:py-8 border-b last:border-b-0 md:border-b-0 ${LINE} ${i > 0 ? "md:border-l md:pl-7" : ""} ${i < config.benefits.length - 1 ? "md:pr-7" : ""}`}
            >
              <span className="flex-shrink-0 w-9 md:w-auto text-[26px] md:text-[40px] font-extrabold leading-none tracking-[-0.04em] md:mb-5 md:block" style={{ color: accent }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h3 className="text-[18px] md:text-xl font-extrabold tracking-[-0.03em] leading-snug" style={{ wordBreak: "keep-all" }}>{b.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/60" style={{ wordBreak: "keep-all" }}>{b.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 창업 기본 조건 */}
      <section className="px-5 sm:px-8 md:px-12 py-10 md:py-14 md:flex-1 md:flex md:flex-col md:justify-center">
        <SectionHead title={config.conditions_title} desc={config.conditions_desc} />
        <div className={`grid md:grid-cols-2 md:gap-x-12 border-t ${LINE}`}>
          {config.conditions.map((row, i) => (
            <div key={i} className={`flex items-baseline justify-between gap-4 py-4 md:py-5 border-b ${LINE}`}>
              <span className="text-[15px] text-white/55">{row.label}</span>
              <strong className="text-right text-base md:text-lg font-extrabold tracking-[-0.02em]">{row.value}</strong>
            </div>
          ))}
        </div>
        {config.notice && <p className="mt-4 text-[13px] leading-relaxed text-white/40" style={{ wordBreak: "keep-all" }}>{config.notice}</p>}
      </section>

      {/* 모바일 전용: 안내를 읽은 뒤 바로 문의 폼으로 */}
      <GoFormButton accent={accent}>창업 상담 문의하기</GoFormButton>
    </div>
  );
}
