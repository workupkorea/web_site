"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// 챕터 전환 공유 상태 — 상단 챕터 탭(MagazineChapterTabs)과 "배우가 입은 제품"(MagazineWearing)이 같은 값을 본다.
// tabs=false(모두 펼치기)면 activeId 는 null → 착용 제품도 챕터 구분 없이 전체를 보여준다.
// 목차(#mag-chapter-…) 링크를 누르면 해당 챕터로 전환하고 그 위치로 스크롤한다.
type Ctx = {
  activeId: string | null;
  setActiveId: (id: string) => void; // 사용자가 직접 고른 전환 → 자동 롤링을 멈춘다
  autoAdvance: (id: string) => void; // 자동 롤링에 의한 전환
  autoStopped: boolean;
  tabs: boolean;
};
const ChapterCtx = createContext<Ctx | null>(null);

export const useChapter = () => useContext(ChapterCtx);

const ANCHOR_PREFIX = "mag-chapter-";

export function ChapterProvider({ ids, tabs, children }: { ids: string[]; tabs: boolean; children: ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [autoStopped, setAutoStopped] = useState(false);
  // 저장된 챕터가 바뀌어도(삭제 등) 항상 유효한 챕터를 가리키게 한다
  const activeId = tabs && ids.length > 0 ? (selected && ids.includes(selected) ? selected : ids[0]) : null;

  const setActiveId = useCallback((id: string) => {
    setSelected(id);
    setAutoStopped(true);
  }, []);
  const autoAdvance = useCallback((id: string) => setSelected(id), []);

  useEffect(() => {
    if (!tabs) return;
    const go = (id: string) => {
      if (!ids.includes(id)) return false;
      setSelected(id);
      setAutoStopped(true);
      // 전환된 챕터가 화면에 그려진 뒤 제목 위치로 이동
      setTimeout(() => document.getElementById(ANCHOR_PREFIX + id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      return true;
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.(`a[href^="#${ANCHOR_PREFIX}"]`);
      if (!a) return;
      const id = a.getAttribute("href")!.slice(1 + ANCHOR_PREFIX.length);
      if (go(id)) e.preventDefault();
    };
    document.addEventListener("click", onClick);
    // 주소에 #mag-chapter-… 가 붙어 들어온 경우
    const hash = window.location.hash;
    if (hash.startsWith(`#${ANCHOR_PREFIX}`)) go(hash.slice(1 + ANCHOR_PREFIX.length));
    return () => document.removeEventListener("click", onClick);
  }, [tabs, ids]);

  const value = useMemo(() => ({ activeId, setActiveId, autoAdvance, autoStopped, tabs }), [activeId, setActiveId, autoAdvance, autoStopped, tabs]);
  return <ChapterCtx.Provider value={value}>{children}</ChapterCtx.Provider>;
}
