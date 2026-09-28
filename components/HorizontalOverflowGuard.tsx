"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// 개발 환경 전용 가로 스크롤 감시기.
// 이 사이트는 뷰포트보다 넓은 요소(주로 데스크탑 전용 UI가 모바일에서 display:none 없이
// opacity/pointer-events로만 숨겨진 경우) 때문에 iOS Safari에서 가로로 드래그하면 흰
// 여백이 드러나는 문제가 반복적으로 재발했다. overflow-x:hidden 같은 전역 CSS는 증상만
// 가리고 iOS 고무줄 스크롤에서는 완전히 막지 못하므로, 원인 요소를 매번 직접 찾아 고쳐야 한다.
// 개발 중 이 문제가 다시 생기면 콘솔에 원인 요소를 즉시 지목해 재발을 조기에 잡아내기 위한 장치.
export default function HorizontalOverflowGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const check = () => {
      const docWidth = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth <= docWidth + 1) return;

      const offenders: { el: Element; width: number }[] = [];
      document.querySelectorAll("body *").forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.right > docWidth + 1 || rect.left < -1) {
          offenders.push({ el, width: Math.round(rect.width) });
        }
      });
      // 가장 바깥쪽(자식이 아닌) 요소만 남겨 원인을 좁힌다.
      const outer = offenders.filter(
        ({ el }) => !offenders.some((o) => o.el !== el && o.el.contains(el))
      );

      console.error(
        `[가로 스크롤 감지] ${pathname} — 문서 너비 ${docWidth}px인데 실제 콘텐츠 너비 ${document.documentElement.scrollWidth}px. ` +
          `모바일에서 display:none 없이 opacity/pointer-events로만 숨긴 데스크탑 전용 UI가 없는지 확인하세요.`,
        outer.map(({ el, width }) => ({ element: el, width, class: el.className }))
      );
    };

    const t = setTimeout(check, 500);
    window.addEventListener("resize", check);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", check);
    };
  }, [pathname]);

  return null;
}
