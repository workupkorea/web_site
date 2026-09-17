import Link from "next/link";
import { Fragment } from "react";
import { Oxanium } from "next/font/google";
import TopbarIcon from "@/components/TopbarIcon";
import { safeHref, type TopbarConfig } from "@/lib/topbar";

const oxanium = Oxanium({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

// 사이트 최상단 띠 배너. PC/모바일 각각 다른 높이·글자 크기를 쓰므로
// 같은 내용을 두 번 렌더링하고 반응형 클래스로 하나만 보이게 한다(admin 미리보기와 동일한 방식).
function TopbarRow({ cfg, height, fontSize, narrow }: { cfg: TopbarConfig; height: number; fontSize: number; narrow?: boolean }) {
  const iconPx = Math.max(11, Math.round(height * 0.4));
  const textStyle = { fontSize, fontWeight: cfg.font_weight, letterSpacing: `${cfg.letter_spacing}em` };
  const leftHref = safeHref(cfg.left_link);
  const leftContent = (
    <span className={`${oxanium.className} flex items-center gap-1.5 whitespace-nowrap truncate`} style={textStyle}>
      {cfg.left_icon !== "none" && <TopbarIcon name={cfg.left_icon} style={{ width: iconPx, height: iconPx }} className="flex-shrink-0" />}
      {cfg.left_text}
    </span>
  );

  return (
    <div className="flex items-center w-full overflow-hidden" style={{ height, backgroundColor: cfg.bg_color, color: cfg.text_color }}>
      <div className={`${narrow ? "px-3" : "px-6 md:px-[70px]"} w-full flex items-center justify-between gap-3`}>
        <div className="min-w-0">
          {leftHref ? (
            leftHref.startsWith("/") || leftHref.startsWith("#") ? (
              <Link href={leftHref}>{leftContent}</Link>
            ) : (
              <a href={leftHref}>{leftContent}</a>
            )
          ) : (
            leftContent
          )}
        </div>

        {cfg.items.length > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {cfg.items.map((it, idx) => {
              const href = safeHref(it.href) || "/";
              const external = !href.startsWith("/") && !href.startsWith("#");
              const linkContent = (
                <span className="flex items-center gap-1 whitespace-nowrap" style={textStyle}>
                  {it.icon !== "none" && <TopbarIcon name={it.icon} style={{ width: iconPx, height: iconPx }} />}
                  {it.label}
                </span>
              );
              return (
                <Fragment key={it.id}>
                  {idx > 0 && <span className="text-[10px] opacity-40 select-none">|</span>}
                  {external ? (
                    <a href={href} target={it.newTab ? "_blank" : undefined} rel={it.newTab ? "noopener noreferrer" : undefined} className="hover:opacity-80 transition-opacity">
                      {linkContent}
                    </a>
                  ) : (
                    <Link href={href} className="hover:opacity-80 transition-opacity">
                      {linkContent}
                    </Link>
                  )}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Topbar({ cfg }: { cfg: TopbarConfig }) {
  if (!cfg.enabled) return null;
  return (
    <>
      {/* PC: 헤더가 md:sticky로 top: var(--wu-topbar-h)에 붙으므로, 탑바도 함께 top-0에 고정해야
          스크롤 시 탑바가 사라진 자리에 헤더 위 빈 틈(뒤 콘텐츠 노출)이 생기지 않는다. */}
      <div className="hidden md:sticky md:top-0 md:z-[60] md:block">
        <TopbarRow cfg={cfg} height={cfg.height} fontSize={cfg.font_size} />
      </div>
      {/* 모바일: 헤더 자체가 sticky가 아니므로(md:sticky) 탑바도 그냥 문서 흐름대로 스크롤되면 된다. */}
      <div className="md:hidden">
        <TopbarRow cfg={cfg} height={cfg.mobile_height} fontSize={cfg.mobile_font_size} narrow />
      </div>
    </>
  );
}
