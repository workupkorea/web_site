"use client";

import { useEffect, useRef, type ReactNode } from "react";

export default function FranchiseConditionsBox({ accent, children }: { accent: string; children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGRectElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const line = lineRef.current;
    if (!box || !line) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = false;
    let animation: Animation | undefined;

    const updateAnimation = () => {
      if (reducedMotion.matches) {
        animation?.cancel();
        animation = undefined;
      } else if (inView) {
        animation ??= line.animate(
          [
            { strokeDashoffset: 0, opacity: 1 },
            { strokeDashoffset: -100, opacity: 1 },
          ],
          { duration: 5000, iterations: Infinity, easing: "linear" },
        );
        animation.play();
      } else {
        animation?.pause();
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.intersectionRatio >= 0.2;
      updateAnimation();
    }, { threshold: 0.2 });
    observer.observe(box);
    reducedMotion.addEventListener("change", updateAnimation);

    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", updateAnimation);
      animation?.cancel();
    };
  }, []);

  return (
    <div ref={boxRef} className="relative p-4 sm:p-6 md:p-8 lg:py-6">
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" fill="none">
        <rect
          x="1"
          y="1"
          style={{ width: "calc(100% - 2px)", height: "calc(100% - 2px)" }}
          stroke={accent}
          strokeOpacity="0.55"
        />
        <rect
          ref={lineRef}
          x="1"
          y="1"
          style={{ width: "calc(100% - 2px)", height: "calc(100% - 2px)" }}
          pathLength="100"
          stroke={accent}
          strokeWidth="2"
          strokeDasharray="16 84"
          opacity="0"
        />
      </svg>
      {children}
    </div>
  );
}
