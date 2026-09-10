"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminSidebar, { getNavLeafByHref } from "./AdminSidebar";
import AdminTabBar from "./AdminTabBar";
import { AdminUIContext, type AdminTab, type AdminUIValue } from "./admin-ui-context";

const MAX_TABS = 10;
const TAB_IDLE_MS = 8 * 60 * 60 * 1000; // 8시간 미사용 탭은 자동으로 닫음
const STALE_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10분마다 점검

// 로컬 캐시(빠른 초기 렌더용) — 서버(계정별)가 항상 최종 기준.
const LS_TABS = "admin.tabs.v1";
const LS_FAVS = "admin.favorites.v1";
const LS_TAB_TS = "admin.tabTimestamps.v1";
const LS_VISITS = "admin.visits.v1";
// 즐겨찾기·열린 탭은 로그인 계정(memberId) 기준으로 서버(site_settings)에 저장한다.
const UI_STATE_API = "/api/admin/ui-state";

type TabTimestamps = Record<string, number>;

/**
 * 관리자 본문 래퍼.
 * - 좌측 사이드바(아코디언 + 즐겨찾기)
 * - 우측 상단 멀티탭(최대 10개) + 본문
 * 즐겨찾기·열린 탭 모두 로그인 계정(memberId) 기준으로 서버에 저장한다(기기 무관, 계정별로 다름).
 * 8시간 이상 사용하지 않은 탭은 자동으로 닫힌다(현재 보고 있는 탭은 제외).
 */
export default function AdminShell({ children, superAdmin }: { children: React.ReactNode; superAdmin?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const searchStr = searchParams.toString();
  const currentHref = pathname + (searchStr ? `?${searchStr}` : "");

  // 현재 경로가 "왼쪽 메뉴(사이드바)에 있는 항목"인지 판별.
  // 메뉴에 있으면 그 메뉴의 정규 href를 탭 키로 사용한다.
  // 제품 수정/등록 같은 동적 페이지는 메뉴에 없으므로 routeLeaf === null → 탭 생성 안 함.
  const routeLeaf = getNavLeafByHref(currentHref);
  const activeHref = routeLeaf ? routeLeaf.href : currentHref;

  const [hydrated, setHydrated] = useState(false);
  // 서버(계정별) 조회가 끝나기 전에는 저장(PUT)을 하지 않는다 — 그 전에 저장하면
  // 로컬 캐시(다른 계정/이전 방식의 값일 수 있음)로 서버 값을 덮어써버릴 위험이 있음.
  const [serverSynced, setServerSynced] = useState(false);
  const [tabs, setTabs] = useState<AdminTab[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [tabTimestamps, setTabTimestamps] = useState<TabTimestamps>({});

  // 최초 로드: 로컬 캐시로 빠르게 먼저 그리고, 서버(계정별) 값이 도착하면 덮어씀
  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem(LS_TABS) || "[]");
      if (Array.isArray(t)) {
        setTabs(
          t.filter(
            (x) =>
              x && typeof x.href === "string" && typeof x.label === "string" && getNavLeafByHref(x.href)
          )
        );
      }
      const f = JSON.parse(localStorage.getItem(LS_FAVS) || "[]");
      if (Array.isArray(f)) setFavorites(f.filter((x) => typeof x === "string"));
      const ts = JSON.parse(localStorage.getItem(LS_TAB_TS) || "{}");
      if (ts && typeof ts === "object") setTabTimestamps(ts);
    } catch {
      /* noop */
    }
    setHydrated(true);
  }, []);

  // 변경 시 로컬 캐시 저장(다음 방문 시 빠른 초기 렌더용)
  useEffect(() => {
    if (hydrated) try { localStorage.setItem(LS_TABS, JSON.stringify(tabs)); } catch { /* noop */ }
  }, [tabs, hydrated]);
  useEffect(() => {
    if (hydrated) try { localStorage.setItem(LS_FAVS, JSON.stringify(favorites)); } catch { /* noop */ }
  }, [favorites, hydrated]);
  useEffect(() => {
    if (hydrated) try { localStorage.setItem(LS_TAB_TS, JSON.stringify(tabTimestamps)); } catch { /* noop */ }
  }, [tabTimestamps, hydrated]);

  // 즐겨찾기·열린 탭: 로그인 계정 기준으로 서버에서 불러오기.
  // 서버가 비어있고(이 계정으로 처음 접속) 로컬 캐시가 있으면 1회 서버로 이관(seed).
  useEffect(() => {
    let cancelled = false;
    fetch(UI_STATE_API, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const serverFavs =
          data && Array.isArray(data.favorites)
            ? data.favorites.filter((x: unknown): x is string => typeof x === "string")
            : null;
        const serverTabs =
          data && Array.isArray(data.tabs)
            ? (data.tabs as unknown[]).filter(
                (x): x is AdminTab =>
                  !!x &&
                  typeof (x as AdminTab).href === "string" &&
                  typeof (x as AdminTab).label === "string" &&
                  !!getNavLeafByHref((x as AdminTab).href)
              )
            : null;
        const serverTs =
          data && data.tabTimestamps && typeof data.tabTimestamps === "object" ? data.tabTimestamps : null;

        const hasServerData = (serverFavs && serverFavs.length > 0) || (serverTabs && serverTabs.length > 0);

        if (hasServerData) {
          if (serverFavs) setFavorites(serverFavs);
          if (serverTabs) setTabs(serverTabs);
          if (serverTs) setTabTimestamps(serverTs);
        } else {
          // 이 계정으로 처음 접속 — 로컬 캐시가 있으면 그대로 서버로 올려 이관 시작
          try {
            const localFavs = JSON.parse(localStorage.getItem(LS_FAVS) || "[]");
            const localTabs = JSON.parse(localStorage.getItem(LS_TABS) || "[]");
            const localTs = JSON.parse(localStorage.getItem(LS_TAB_TS) || "{}");
            if ((Array.isArray(localFavs) && localFavs.length > 0) || (Array.isArray(localTabs) && localTabs.length > 0)) {
              fetch(UI_STATE_API, {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ favorites: localFavs, tabs: localTabs, tabTimestamps: localTs }),
              }).catch(() => {});
            }
          } catch {
            /* noop */
          }
        }
        if (!cancelled) setServerSynced(true);
      })
      .catch(() => {
        // 서버 조회 실패 시에도 로컬 값으로라도 계속 동작하게 저장을 허용
        if (!cancelled) setServerSynced(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 현재 경로가 메뉴 항목일 때만 탭에 추가 (동적 편집/등록 페이지는 제외), 활성 탭 시각 갱신
  useEffect(() => {
    if (!hydrated || !routeLeaf) return;
    const href = routeLeaf.href;
    setTabs((prev) => {
      if (prev.some((t) => t.href === href)) return prev;
      const next = [...prev, { href, label: routeLeaf.label }];
      if (next.length > MAX_TABS) {
        // 현재(활성) 탭이 아닌 가장 오래된 탭 제거
        const idx = next.findIndex((t) => t.href !== href);
        if (idx !== -1) next.splice(idx, 1);
      }
      return next;
    });
    setTabTimestamps((prev) => ({ ...prev, [href]: Date.now() }));
  }, [hydrated, routeLeaf]);

  // 8시간 이상 사용하지 않은 탭 자동 닫기(현재 보고 있는 탭은 제외) — 로드 시 + 주기 점검
  const closeStaleTabs = useCallback(() => {
    setTabs((prev) => {
      const now = Date.now();
      const next = prev.filter(
        (t) => t.href === activeHref || now - (tabTimestamps[t.href] ?? now) < TAB_IDLE_MS
      );
      return next.length === prev.length ? prev : next;
    });
  }, [activeHref, tabTimestamps]);

  useEffect(() => {
    if (!hydrated) return;
    closeStaleTabs();
    const id = setInterval(closeStaleTabs, STALE_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // 메뉴 방문 횟수 집계 (대시보드 "자주 방문" 용, 기기별 그대로 유지). /admin(대시보드 자신)은 제외.
  useEffect(() => {
    if (!hydrated || !pathname.startsWith("/admin") || pathname === "/admin") return;
    try {
      const raw = JSON.parse(localStorage.getItem(LS_VISITS) || "{}");
      raw[pathname] = (Number(raw[pathname]) || 0) + 1;
      localStorage.setItem(LS_VISITS, JSON.stringify(raw));
    } catch {
      /* noop */
    }
  }, [hydrated, pathname]);

  const selectTab = useCallback(
    (href: string) => {
      setTabTimestamps((prev) => ({ ...prev, [href]: Date.now() }));
      router.push(href);
    },
    [router]
  );

  const closeTab = useCallback(
    (href: string) => {
      const idx = tabs.findIndex((t) => t.href === href);
      if (idx === -1) return;
      const next = tabs.filter((t) => t.href !== href);
      setTabs(next);
      // 활성 탭을 닫으면 인접 탭으로 이동 (setState 업데이터 밖에서 호출해야 함)
      if (href === activeHref) {
        const fallback = next[idx - 1] || next[idx] || next[next.length - 1];
        router.push(fallback ? fallback.href : "/admin");
      }
    },
    [tabs, activeHref, router]
  );

  const closeAllTabs = useCallback(() => {
    setTabs([]);
    router.push("/admin");
  }, [router]);

  // 즐겨찾기·열린 탭 서버 저장(연속 변경 시 마지막 상태만 전송하도록 디바운스)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveToServer = useCallback((next: { favorites?: string[]; tabs?: AdminTab[]; tabTimestamps?: TabTimestamps }) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(UI_STATE_API, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => {});
    }, 500);
  }, []);

  // 탭·즐겨찾기 변경을 서버에 반영 — 서버 조회가 끝난 뒤에만(그 전엔 로컬 캐시로 서버 값을 덮어쓸 위험)
  useEffect(() => {
    if (serverSynced) saveToServer({ favorites, tabs, tabTimestamps });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites, tabs, tabTimestamps, serverSynced]);

  const isFavorite = useCallback((href: string) => favorites.includes(href), [favorites]);
  const toggleFavorite = useCallback(
    (href: string) => {
      setFavorites((prev) => (prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]));
    },
    []
  );

  const value = useMemo<AdminUIValue>(
    () => ({ tabs, currentHref: activeHref, selectTab, closeTab, closeAllTabs, favorites, isFavorite, toggleFavorite }),
    [tabs, activeHref, selectTab, closeTab, closeAllTabs, favorites, isFavorite, toggleFavorite]
  );

  return (
    <AdminUIContext.Provider value={value}>
      <AdminSidebar superAdmin={superAdmin} />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <AdminTabBar />
        <main className="flex-1 min-w-0 overflow-y-auto bg-[#f1f5f9]">
          <div className="px-4 sm:px-6 lg:px-10 pt-5 pb-10 admin-content">{children}</div>
        </main>
      </div>
    </AdminUIContext.Provider>
  );
}
