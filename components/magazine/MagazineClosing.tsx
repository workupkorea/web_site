import Link from "next/link";
import type { HomeMagazineConfig } from "@/lib/home-magazine";
import MagazineImg from "./MagazineImg";

// 클로징 — 매거진의 마지막을 매장 방문 행동으로 마무리. (가까운 매장 찾기 / 전화 / 카카오톡)
// 전화·카톡 버튼은 관리자가 값을 넣었을 때만 노출.
const BTN = "inline-flex items-center justify-center min-h-[44px] px-5 md:px-7 text-[13px] md:text-sm tracking-wider focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";

export default function MagazineClosing({ closing }: { closing: HomeMagazineConfig["closing"] }) {
  if (!closing.enabled) return null;
  const tel = closing.phone ? `tel:${closing.phone.replace(/[^0-9+]/g, "")}` : null;
  return (
    <section aria-labelledby="mag-closing" className="relative h-[360px] md:h-[420px] overflow-hidden bg-[#3a3b3e] text-white">
      {closing.image.url && (
        // 흐림(blur)을 주면 가장자리가 비치지 않게 살짝 확대한다
        <div className="absolute inset-0" style={closing.blur ? { filter: `blur(${closing.blur}px)`, transform: "scale(1.1)" } : undefined}>
          <MagazineImg image={{ ...closing.image, random: undefined, more: undefined, mobileMore: undefined }} className="absolute inset-0 w-full h-full" />
        </div>
      )}
      <div aria-hidden className="absolute inset-0 bg-black/60" />
      <div className="relative h-full flex flex-col items-center justify-center text-center px-5">
        {closing.eyebrow && <p className="italic text-[15px] md:text-xl mb-1.5 md:mb-2">{closing.eyebrow}</p>}
        <h2 id="mag-closing" className="text-2xl md:text-[44px] font-bold leading-snug break-keep">
          {closing.title}
        </h2>
        {closing.sub && <p className="mag-body mt-2 md:mt-3 text-[13px] md:text-[15px] text-white/85 break-keep">{closing.sub}</p>}
        <div className="mt-5 md:mt-7 flex flex-wrap justify-center gap-2">
          <Link href="/store" className={`${BTN} bg-[#E5541B] hover:bg-[#d04a15]`}>
            가까운 매장 찾기
          </Link>
          {tel && (
            <a href={tel} className={`${BTN} border border-white hover:bg-white hover:text-[#1d1e20]`}>
              전화 문의
            </a>
          )}
          {closing.kakaoUrl && (
            <a
              href={closing.kakaoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${BTN} border border-white hover:bg-white hover:text-[#1d1e20]`}
            >
              카카오톡 상담
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
