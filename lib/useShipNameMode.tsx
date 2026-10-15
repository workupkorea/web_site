"use client";
import { useCallback, useSyncExternalStore } from "react";
import { getShipName } from "@/data/store-ship-names";
import { stripBranchPrefix } from "@/lib/ih/influencer-shared";

// 지점명 ⇄ W지점명(택배 기준 가맹점명) 표시 전환. 한 화면에서 바꾸면 다른 관리자 화면에도 같은 모드가 유지되도록
// localStorage + 커스텀 이벤트로 공유한다 (같은 탭의 여러 컴포넌트도 함께 갱신).
const STORAGE_KEY = "workup:ship-name-mode";
const EVENT_NAME = "workup:ship-name-mode-change";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT_NAME, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT_NAME, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function useShipNameMode() {
  const showShip = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const toggle = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, getSnapshot() ? "0" : "1");
    } catch {
      /* 저장 불가 환경에서는 전환만 포기 */
    }
    window.dispatchEvent(new Event(EVENT_NAME));
  }, []);

  /** 지점코드로 W지점명을 찾아 현재 모드에 맞는 이름을 돌려준다. 화면 모드에서는 "워크업" 접두어를 뗀 기존 이름. */
  const displayName = useCallback(
    (name: string, code?: string | null) => {
      const base = stripBranchPrefix(name);
      return showShip ? getShipName(code, base) : base;
    },
    [showShip]
  );

  return { showShip, toggle, displayName };
}

/** 표 제목줄용 — 클릭하면 지점명 ⇄ W지점명 전환. */
export function ShipNameToggleButton({ showShip, onToggle }: { showShip: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title="클릭하면 지점명 ⇄ W지점명 전환"
      className="inline-flex items-center gap-1 max-lg:min-h-[44px] uppercase hover:text-[#303236]"
    >
      {showShip ? "W지점명" : "지점명"} <span aria-hidden>⇄</span>
    </button>
  );
}
