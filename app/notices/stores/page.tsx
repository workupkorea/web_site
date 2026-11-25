"use client";
import { useEffect, useState } from "react";
import StoreStatusModal from "../_components/StoreStatusModal";
import WjumunSyncPanel from "../_components/WjumunSyncPanel";
import { isBulkShip } from "@/lib/bulk-ship";
import { getShipName } from "@/data/store-ship-names";
import { useShipNameMode, ShipNameToggleButton } from "@/lib/useShipNameMode";

type StoreRow = {
  id: number;
  name: string;
  store_code: string | null;
  ship_name?: string | null;
  pass_link_token: string | null;
  closed_at?: string | null;
};

type HistoryRow = { id: number; summary: string; actor_name: string; created_at: string };
type ShipFilter = "blocked" | "available";

const filterButton = "inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap border px-3 text-[13px] font-semibold transition-colors disabled:opacity-50 lg:h-9";
const inactiveFilter = "border-[var(--admin-line)] bg-white text-slate-600 hover:border-[var(--admin-accent)]";
const activeFilter = "border-[var(--admin-accent)] bg-[var(--admin-accent)] text-white";

function fmtHistTime(iso: string) {
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}/${day} ${h}:${min}`;
}

export default function PassLinksPage() {
  const { showShip, toggle: toggleShip } = useShipNameMode();
  // 이 화면은 접두어("워크업")까지 포함한 전체 이름을 보여주므로 W지점명만 교체한다
  const shownName = (s: StoreRow) => (showShip ? getShipName(s.store_code, s.name, s.ship_name) : s.name);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenId, setRegenId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [previewStoreId, setPreviewStoreId] = useState<number | null>(null);
  const [showStatus, setShowStatus] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [search, setSearch] = useState("");
  // 일괄출고금지 여부는 지점 현황(store_status)의 오픈일 값이 기준 — 계속 바뀌므로 목록은 지우지 않고 표시·필터만 한다.
  const [bulkIds, setBulkIds] = useState<Set<number> | null>(null);
  const [shipFilter, setShipFilter] = useState<ShipFilter | null>(null);
  // 알림(웹푸시) 설정 현황 — 지점 화면에서 "알림받기"를 켠 기기 수. available=false면 확인 불가(테이블 미적용).
  const [push, setPush] = useState<{ available: boolean; stores: Record<number, { count: number; firstAt: string | null }> } | null>(null);
  const [pushOnly, setPushOnly] = useState(false); // 알림을 설정한 지점만 보기
  // 마지막 wjumun 동기화(승인·반영 완료 시점) — 누가, 언제
  const [lastSync, setLastSync] = useState<{ syncedAt: string | null; syncedBy: string | null } | null>(null);
  // 링크 히스토리 모달
  const [linkModalStoreId, setLinkModalStoreId] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const previewStore = stores.find((s) => s.id === previewStoreId) ?? null;
  const linkModalStore = stores.find((s) => s.id === linkModalStoreId) ?? null;

  const listedStores = stores.filter((s) => !s.closed_at); // 오픈예정 지점도 출고 처리 대상
  const blockedCount = bulkIds ? listedStores.filter((s) => bulkIds.has(s.id)).length : 0;
  const shipFilters = [
    { key: "blocked", label: "일괄출고금지", count: blockedCount },
    { key: "available", label: "출고가능", count: listedStores.length - blockedCount },
  ] as const;
  const filteredStores = listedStores
    .filter((s) => !shipFilter || !bulkIds || bulkIds.has(s.id) === (shipFilter === "blocked"))
    .filter((s) => !pushOnly || !!push?.stores[s.id])
    .filter((s) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || (s.store_code ?? "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (!a.store_code && !b.store_code) return 0;
      if (!a.store_code) return 1;
      if (!b.store_code) return -1;
      return a.store_code.localeCompare(b.store_code, undefined, { numeric: true });
    });

  const load = () => {
    setLoading(true);
    fetch("/api/admin/stores")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: StoreRow[]) => setStores(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  const loadBulk = () => {
    fetch("/api/admin/site-settings/store_status")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load store status");
        return r.json();
      })
      .then((config: { rows?: { storeId: number; openedAt: string }[] } | null) => {
        setBulkIds(new Set((config?.rows ?? []).filter((r) => isBulkShip(r.openedAt)).map((r) => r.storeId)));
      })
      .catch(() => {
        setBulkIds(null);
        setShipFilter(null);
      });
  };

  useEffect(load, []);
  useEffect(loadBulk, []);
  useEffect(() => {
    fetch("/api/admin/stores/push-status")
      .then((r) => (r.ok ? r.json() : null))
      .then(setPush);
  }, []);
  useEffect(() => {
    fetch("/api/admin/wjumun/sync")
      .then((r) => (r.ok ? r.json() : null))
      .then(setLastSync);
  }, []);

  const showMsg = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  };

  const regenerate = async (id: number, name: string) => {
    if (!confirm(`${name}의 링크를 재발급할까요? 기존 링크는 즉시 무효화됩니다.`)) return;
    setRegenId(id);
    try {
      const res = await fetch(`/api/admin/stores/${id}/pass-link`, { method: "POST" });
      if (res.ok) {
        showMsg("링크가 재발급됐습니다.");
        load();
        if (linkModalStoreId === id) {
          loadHistory(id);
        }
      } else {
        const d = await res.json().catch(() => ({}));
        showMsg(`재발급 실패: ${d.error ?? res.status}`);
      }
    } finally {
      setRegenId(null);
    }
  };

  const copyLink = async (id: number, token: string | null) => {
    if (!token) return;
    const url = `${window.location.origin}/b/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      showMsg("링크가 복사됐습니다.");
      // 복사 기록을 히스토리에 남김 (실패해도 복사 동작엔 영향 없음)
      fetch(`/api/admin/stores/${id}/pass-link/history`, { method: "POST" })
        .then(() => { if (linkModalStoreId === id) loadHistory(id); })
        .catch(() => {});
    } catch {
      showMsg(url);
    }
  };

  const loadHistory = async (id: number) => {
    setHistoryLoading(true);
    setHistory([]);
    try {
      const res = await fetch(`/api/admin/stores/${id}/pass-link/history`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openLinkModal = (id: number) => {
    setLinkModalStoreId(id);
    setHistory([]);
    loadHistory(id);
  };

  const closeLinkModal = () => {
    setLinkModalStoreId(null);
    setHistory([]);
  };

  return (
    <>
      <div className="space-y-3 lg:pr-[32vw]">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-bold text-slate-900">지점 링크 관리</h1>
            <p className="mt-0.5 text-[12px] text-slate-600">링크 유출이 의심되면 즉시 재발급하세요.</p>
          </div>
          <div className="flex flex-wrap items-center lg:justify-end gap-2">
            {lastSync?.syncedAt && (
              <span className="text-[12px] text-gray-500 text-right leading-tight whitespace-nowrap">
                마지막 동기화{lastSync.syncedBy ? ` ${lastSync.syncedBy}` : ""}
                <br />
                {new Date(lastSync.syncedAt).toLocaleString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowSync(true)}
              className="bg-[var(--admin-accent)] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[var(--admin-accent-hover)] max-lg:min-h-11"
            >
              wjumun 동기화
            </button>
            <button
              type="button"
              onClick={() => setShowStatus(true)}
              className="border border-[var(--admin-line)] bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-600 hover:border-[var(--admin-accent)] max-lg:min-h-11"
            >
              지점 현황
            </button>
          </div>
        </div>

        {msg && <div className="px-4 py-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">{msg}</div>}

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            aria-label="지점명 또는 지점코드 검색"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="지점명 또는 지점코드 검색"
            className="h-11 w-full min-w-36 border border-[var(--admin-line)] bg-white px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-[var(--admin-accent)] lg:h-9 lg:flex-1"
          />
          <button
            type="button"
            onClick={toggleShip}
            title="지점명 ⇄ W지점명 전환"
            className={`${filterButton} ${inactiveFilter}`}
          >
            {showShip ? "W지점명" : "지점명"} ⇄
          </button>
          {shipFilters.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setShipFilter((current) => current === key ? null : key)}
              aria-pressed={shipFilter === key}
              disabled={!bulkIds}
              className={`${filterButton} ${shipFilter === key ? activeFilter : inactiveFilter}`}
            >
              {label}{bulkIds && !loading ? ` ${count}` : ""}
            </button>
          ))}
          {push?.available && (
            <button
              type="button"
              onClick={() => setPushOnly((v) => !v)}
              aria-pressed={pushOnly}
              className={`${filterButton} ${pushOnly ? activeFilter : inactiveFilter}`}
            >
              알림 설정 {listedStores.filter((s) => push.stores[s.id]).length}
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : (
          <>
            {/* 모바일/태블릿: 지점 카드 목록 */}
            <div className="lg:hidden space-y-2.5">
              {filteredStores.length === 0 && (
                <div className="py-10 text-center text-sm text-gray-400 bg-white border border-gray-200 rounded-xl">조건에 맞는 지점이 없습니다.</div>
              )}
              {filteredStores.map((s) => (
                <div
                  key={s.id}
                  className={`border rounded-xl p-3.5 space-y-3 ${!s.pass_link_token ? "bg-amber-50/60 border-amber-200" : "bg-white border-gray-200"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] text-gray-400 font-mono">{s.store_code || "-"}</p>
                      <p className="break-words text-[13px] font-semibold text-slate-900">{shownName(s)}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {push?.available && (
                          push.stores[s.id] ? (
                            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-50 text-emerald-700">
                              알림 설정 ({push.stores[s.id].count}대)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-gray-100 text-gray-500">알림 미설정</span>
                          )
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {bulkIds?.has(s.id) && (
                        <span className="bg-[var(--admin-danger-bg)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--admin-danger)]">일괄출고금지</span>
                      )}
                      {!s.pass_link_token && (
                        <span className="px-2.5 py-0.5 text-[12px] font-semibold bg-amber-100 text-amber-700">발급 필요</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {s.pass_link_token ? (
                      <button
                        onClick={() => copyLink(s.id, s.pass_link_token)}
                        className="min-h-[44px] text-[13px] font-semibold text-[#3A6DF0] border border-[#3A6DF0]/30 rounded-lg active:bg-blue-50"
                      >
                        링크 복사
                      </button>
                    ) : (
                      <button
                        onClick={() => regenerate(s.id, s.name)}
                        disabled={regenId === s.id}
                        className="min-h-[44px] text-[13px] font-semibold text-red-600 border border-red-200 rounded-lg active:bg-red-50 disabled:opacity-50"
                      >
                        {regenId === s.id ? "처리 중..." : "링크 발급"}
                      </button>
                    )}
                    <button
                      onClick={() => setPreviewStoreId(s.id)}
                      className="min-h-[44px] text-[13px] font-semibold border border-gray-300 text-gray-600 rounded-lg active:bg-gray-50"
                    >
                      화면 확인
                    </button>
                  </div>
                </div>
              ))}
            </div>

          <div className="hidden lg:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-auto" style={{ maxHeight: "80vh" }}>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr className="whitespace-nowrap text-[12px] font-bold text-slate-600 [&>th]:px-3 [&>th]:py-2">
                  <th scope="col">지점코드</th>
                  <th scope="col"><ShipNameToggleButton showShip={showShip} onToggle={toggleShip} /></th>
                  <th scope="col" className="w-28">일괄출고금지</th>
                  <th scope="col">링크</th>
                  <th scope="col">알림</th>
                  <th scope="col"><span className="sr-only">화면 확인</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStores.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-[13px] text-slate-500">조건에 맞는 지점이 없습니다.</td></tr>
                )}
                {filteredStores.map((s) => (
                  <tr
                    key={s.id}
                    className={`[&>td]:px-3 [&>td]:py-1.5 ${previewStore?.id === s.id ? "bg-gray-50" : !s.pass_link_token ? "bg-amber-50/60" : ""}`}
                  >
                    <td className="font-mono text-[12px] text-slate-500">{s.store_code || "-"}</td>
                    <td className="text-[13px] font-semibold text-slate-900">{shownName(s)}</td>
                    <td>
                      {bulkIds?.has(s.id) && (
                        <span className="whitespace-nowrap bg-[var(--admin-danger-bg)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--admin-danger)]">일괄출고금지</span>
                      )}
                    </td>
                    <td>
                      {s.pass_link_token ? (
                        <button
                          onClick={() => copyLink(s.id, s.pass_link_token)}
                          className="h-7 whitespace-nowrap border border-[var(--admin-line)] px-2 text-[12px] font-semibold text-[var(--admin-accent)] hover:bg-blue-50"
                        >
                          링크 복사
                        </button>
                      ) : (
                        <span className="px-2.5 py-0.5 text-[12px] font-semibold rounded-full bg-amber-100 text-amber-700">발급 필요</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {!push?.available ? (
                        <span className="text-[12px] text-gray-300">-</span>
                      ) : push.stores[s.id] ? (
                        <span
                          className="px-2.5 py-0.5 text-[12px] font-semibold rounded-full bg-emerald-50 text-emerald-700"
                          title={push.stores[s.id].firstAt ? `처음 설정 ${new Date(push.stores[s.id].firstAt as string).toLocaleString("ko-KR")}` : undefined}
                        >
                          설정 ({push.stores[s.id].count}대)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 text-[12px] font-semibold rounded-full bg-gray-100 text-gray-500">미설정</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      <button
                        onClick={() => setPreviewStoreId(s.id)}
                        className={`h-7 px-2 text-[12px] font-semibold ${
                          previewStore?.id === s.id
                            ? "bg-[#303236] text-white"
                            : "border border-gray-300 text-gray-600 hover:border-[#303236] hover:text-[#303236]"
                        }`}
                      >
                        화면 확인
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* 화면 확인 패널 — PC: 오른쪽 고정, 모바일: 지점을 선택했을 때만 전체 화면으로 열림 */}
      <div className={`${previewStore ? "flex" : "hidden lg:flex"} fixed top-0 right-0 h-dvh w-full lg:w-[32vw] bg-white border-l border-gray-200 shadow-2xl z-40 flex-col`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0 gap-3">
          <span className="text-sm font-semibold text-gray-900 truncate">
            {previewStore ? `${previewStore.name} 화면 확인` : "화면 확인"}
          </span>
          {previewStore && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {previewStore.pass_link_token && (
                <button
                  type="button"
                  onClick={() => openLinkModal(previewStore.id)}
                  className="px-2.5 py-1 max-lg:min-h-[44px] text-[12px] font-semibold whitespace-nowrap text-gray-600 border border-gray-300 rounded-lg hover:border-gray-500 hover:text-gray-800"
                >
                  히스토리
                </button>
              )}
              <button
                type="button"
                onClick={() => regenerate(previewStore.id, previewStore.name)}
                disabled={regenId === previewStore.id}
                className="px-2.5 py-1 max-lg:min-h-[44px] text-[12px] font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                {regenId === previewStore.id ? "처리 중..." : previewStore.pass_link_token ? "재발급" : "발급"}
              </button>
              <button
                type="button"
                onClick={() => setPreviewStoreId(null)}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none max-lg:min-w-[44px] max-lg:min-h-[44px]"
                aria-label="선택 해제"
              >
                ×
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 bg-gray-100 min-h-0 overflow-hidden">
          {previewStore?.pass_link_token ? (
            <iframe
              key={previewStore.id}
              src={`/b/${previewStore.pass_link_token}`}
              className="w-full h-full border-0 bg-white"
              title={`${previewStore.name} 지점 화면`}
            />
          ) : previewStore ? (
            <div className="w-full h-full flex items-center justify-center text-sm text-gray-400 text-center px-6">
              아직 링크가 발급되지 않았습니다. 위의 &quot;발급&quot; 버튼을 눌러주세요.
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-gray-400 text-center px-6">
              지점 목록에서 &quot;화면 확인&quot;을 누르면 여기에 표시됩니다.
            </div>
          )}
        </div>
      </div>

      {/* 링크 확인 모달 */}
      {linkModalStore && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={closeLinkModal}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-[16px] text-gray-900">{linkModalStore.name} 링크 히스토리</h3>
              <button onClick={closeLinkModal} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              {linkModalStore.pass_link_token ? (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">현재 링크 주소</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 flex items-start gap-2">
                    <p className="text-[12px] text-gray-700 font-mono break-all flex-1 select-all leading-relaxed">
                      {`${typeof window !== "undefined" ? window.location.origin : ""}/b/${linkModalStore.pass_link_token}`}
                    </p>
                    <button
                      onClick={() => copyLink(linkModalStore.id, linkModalStore.pass_link_token)}
                      className="flex-shrink-0 px-2.5 py-1 text-[12px] font-semibold text-[#3A6DF0] border border-[#3A6DF0]/30 rounded-lg hover:bg-blue-50"
                    >
                      복사
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                  아직 링크가 발급되지 않았습니다.
                </div>
              )}

              {/* 재발급 히스토리 */}
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">재발급 히스토리</p>
                <div className="border border-gray-100 rounded-xl max-h-52 overflow-y-auto">
                  {historyLoading ? (
                    <p className="px-4 py-3 text-[12px] text-gray-400">불러오는 중...</p>
                  ) : history.length === 0 ? (
                    <p className="px-4 py-3 text-[12px] text-gray-400">재발급 기록이 없습니다.</p>
                  ) : (
                    <ul className="divide-y divide-gray-50">
                      {history.map((h) => (
                        <li key={h.id} className="px-4 py-2.5 flex items-start justify-between gap-2">
                          <span className="text-[12px] text-gray-700">{h.summary}</span>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[11px] text-gray-400 font-mono">{fmtHistTime(h.created_at)}</p>
                            <p className="text-[11px] text-gray-500">{h.actor_name}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-1 border-t border-gray-100">
                <button
                  onClick={() => regenerate(linkModalStore.id, linkModalStore.name)}
                  disabled={regenId === linkModalStore.id}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50"
                >
                  {regenId === linkModalStore.id ? "처리 중..." : linkModalStore.pass_link_token ? "재발급" : "발급"}
                </button>
                <button
                  onClick={closeLinkModal}
                  className="flex-1 px-4 py-2 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStatus && (
        <StoreStatusModal
          onClose={() => {
            setShowStatus(false);
            loadBulk(); // 지점 현황에서 오픈일을 직접 고쳤을 수 있으니 표시를 갱신
          }}
        />
      )}
      {showSync && (
        <WjumunSyncPanel
          onClose={() => setShowSync(false)}
          onApplied={(message, last) => {
            setShowSync(false);
            loadBulk();
            setLastSync(last);
            showMsg(message);
          }}
        />
      )}
    </>
  );
}
