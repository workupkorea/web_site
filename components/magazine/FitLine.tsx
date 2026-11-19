"use client";
import { useEffect, useRef } from "react";

// 한 줄 문구를 부모(이름 제목) 가로폭에 딱 맞춰 글자 크기를 조절한다 — PC 커버 하단 영문 문구용.
// 부모 폭을 넓히지 않도록 자신은 폭 0 + min-w-full 로 부모 폭만 따라간다. 폰트 로드·창 크기 변경 때 다시 맞춘다.
export default function FitLine({ children, className = "" }: { children: string; className?: string }) {
  const box = useRef<HTMLParagraphElement>(null);
  const text = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fit = () => {
      const b = box.current;
      const t = text.current;
      if (!b || !t || !b.clientWidth) return;
      t.style.fontSize = "100px"; // 기준 크기로 실제 글자 폭을 잰 뒤 비율로 환산
      const natural = t.getBoundingClientRect().width;
      if (natural) t.style.fontSize = `${(b.clientWidth / natural) * 100}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (box.current) ro.observe(box.current);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [children]);

  return (
    <p ref={box} className={`w-0 min-w-full whitespace-nowrap overflow-hidden ${className}`}>
      <span ref={text} className="inline-block leading-none tracking-wider" style={{ fontSize: 14 }}>
        {children}
      </span>
    </p>
  );
}
