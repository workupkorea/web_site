import type { CSSProperties } from "react";
import type { MagazineDivider as Divider } from "@/lib/home-magazine";

// 구분선(라인) 레이아웃 — 섹션 사이에 끼우는 장식 구간. 가는 선 / 굵은 선 / 이중선 / 점선 / 글자가 들어가는 선.
const SPACE: Record<Divider["space"], string> = { sm: "py-5 md:py-6", md: "py-10 md:py-14", lg: "py-16 md:py-24" };

export default function MagazineDivider({ divider }: { divider: Divider }) {
  const color = divider.color ?? "#1d1e20";
  const line = (border: string): CSSProperties => ({ borderTop: border, borderColor: color });

  return (
    <div role="separator" aria-hidden={divider.style !== "label"} className={`mag-sans px-5 md:px-14 ${SPACE[divider.space]}`} style={{ backgroundColor: divider.bg, color }}>
      {divider.style === "label" ? (
        <div className="flex items-center gap-4 md:gap-6">
          <span className="flex-1" style={line("1px solid")} />
          {divider.label && <span className="text-[10px] md:text-[12px] font-bold tracking-[0.3em] uppercase">{divider.label}</span>}
          <span className="flex-1" style={line("1px solid")} />
        </div>
      ) : divider.style === "bold" ? (
        <div style={line("3px solid")} />
      ) : divider.style === "double" ? (
        <div style={line("4px double")} />
      ) : divider.style === "dashed" ? (
        <div style={line("1px dashed")} />
      ) : (
        <div style={line("1px solid")} />
      )}
    </div>
  );
}
