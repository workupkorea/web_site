"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./FranchiseConditionsBox.module.css";

export default function FranchiseConditionsBox({ accent, children }: { accent: string; children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGRectElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const line = lineRef.current;
    const svg = line?.ownerSVGElement;
    if (!box || !line || !svg) return;

    const sizeObserver = new ResizeObserver(([{ contentRect }]) => {
      const width = Math.max(0, contentRect.width - 2);
      const height = Math.max(0, contentRect.height - 2);
      const perimeter = 2 * (width + height);
      line.setAttribute("width", String(width));
      line.setAttribute("height", String(height));
      line.setAttribute("stroke-dasharray", `${perimeter * 0.16} ${perimeter * 0.84}`);
      line.style.setProperty("--outline-offset", `${-perimeter}px`);
    });
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      line.style.animationPlayState = entry.isIntersecting ? "running" : "paused";
    });
    sizeObserver.observe(svg);
    visibilityObserver.observe(box);

    return () => {
      sizeObserver.disconnect();
      visibilityObserver.disconnect();
    };
  }, []);

  return (
    <div ref={boxRef} className="relative p-4 sm:p-6 md:p-8 lg:py-6">
      <span aria-hidden="true" className="pointer-events-none absolute inset-px border opacity-55" style={{ borderColor: accent }} />
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" fill="none">
        <rect
          ref={lineRef}
          className={styles.outline}
          x="1"
          y="1"
          stroke={accent}
          strokeWidth="2"
        />
      </svg>
      {children}
    </div>
  );
}
