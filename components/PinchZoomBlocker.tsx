"use client";
import { useEffect } from "react";

// 모바일 핀치줌 차단 — iOS Safari는 meta viewport의 user-scalable=no를 무시하므로 JS로 막는다.
// 레이아웃에 <script>를 직접 두면 React 19가 "Scripts inside React components are never executed"
// 경고를 내므로, 스크립트 태그 대신 마운트 시 리스너를 등록하는 컴포넌트로 처리한다.
export default function PinchZoomBlocker() {
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    // passive:false여야 preventDefault가 iOS에서 실제로 동작한다.
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => document.removeEventListener("touchmove", onTouchMove);
  }, []);

  return null;
}
