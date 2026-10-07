"use client";
import { noticeCoverAspect } from "@/lib/noticeImage";
import { useEffect, useRef, useState } from "react";
import NoticeStatusSelect, { type NoticeStatus } from "./_components/NoticeStatusSelect";
import NoticeStatusLine from "./_components/NoticeStatusLine";
import PassEntriesTable from "./_components/PassEntriesTable";
import TempNoticeEditModal from "./_components/TempNoticeEditModal";
import NoticeProductPicker from "./_components/NoticeProductPicker";
import CoverAndDetailImagesField from "./_components/CoverAndDetailImagesField";
import DescriptionField from "./_components/DescriptionField";
import { useIsPastClose } from "@/lib/hooks/useIsPastClose";

const DEFAULT_CLOSE_TIME = "14:00";

// 공지는 이제 항상 마감패스 전용(products 테이블 미연결)으로만 등록된다.
type NoticeRow = {
  id: string;
  product_id: string | null;
  notice_date: string;
  status: NoticeStatus;
  opened_at: string | null;
  closed_at: string | null;
  description: string | null;
  extra_images: string[];
  temp_name: string | null;
  temp_image_url: string | null;
  temp_tagline: string | null;
  badge: string | null;
  temp_image_portrait?: boolean;
  pass_count?: number;
  store_total?: number;
  products: { id: string; name: string; image_url?: string | null } | null;
};

const PRESET_BADGES = ["재공지", "정보변경", "가격변동"];

const STATIC_NAV = [
  { key: "detail", label: "공지 & 현황", src: null as string | null },
  { key: "stores", label: "지점 링크 관리", src: "/notices/stores?embed=1" },
  { key: "stats", label: "통계", src: "/notices/stats?embed=1" },
];

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
function fmtNoticeDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}(${WEEKDAYS[d.getDay()]})`;
}

// 정식 상품(products) 공지든 마감패스 전용(temp_name) 공지든 상관없이 표시용 이름 하나로.
function noticeImage(n: NoticeRow): string | null {
  return n.products?.image_url ?? n.temp_image_url ?? null;
}

function noticeName(n: NoticeRow): string {
  return n.products?.name ?? n.temp_name ?? "상품 정보 없음";
}

type DeadlineStatus = { 대기: number; 진행중: number; 마감: number; total: number };

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export default function NoticesPreviewPage() {
  // ── 관리자 화면 ──
  const [adminTab, setAdminTab] = useState("detail");
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [noticesLoading, setNoticesLoading] = useState(true);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [closingDate, setClosingDate] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [editingTempNotice, setEditingTempNotice] = useState<NoticeRow | null>(null);
  const [reregisterSource, setReregisterSource] = useState<NoticeRow | null>(null);
  const [reregBadge, setReregBadge] = useState("");
  const [reregShowCustom, setReregShowCustom] = useState(false);
  const [reregName, setReregName] = useState("");
  const [reregCover, setReregCover] = useState("");
  const [reregPortrait, setReregPortrait] = useState(false);
  const [reregTagline, setReregTagline] = useState("");
  const [reregExtraImages, setReregExtraImages] = useState<string[]>([]);
  const [reregDesc, setReregDesc] = useState("");
  const [reregError, setReregError] = useState("");
  const [reregInfo, setReregInfo] = useState("");
  const [reregSaving, setReregSaving] = useState(false);

  // ── 지점 화면 미리보기 ──
  const [previewModalToken, setPreviewModalToken] = useState<string | null>(null);
  const [previewFetching, setPreviewFetching] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const openPreviewModal = () => {
    setPreviewFetching(true);
    fetch("/api/admin/stores")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { pass_link_token: string | null }[]) => {
        const first = Array.isArray(data) ? data.find((s) => s.pass_link_token) : null;
        if (first?.pass_link_token) setPreviewModalToken(first.pass_link_token);
        else alert("링크가 발급된 지점이 없습니다.");
      })
      .finally(() => setPreviewFetching(false));
  };

  // ── 마감 관리 썸머리 ──
  const [dlCounts, setDlCounts] = useState<DeadlineStatus>({ 대기: 0, 진행중: 0, 마감: 0, total: 0 });
  const [openTime, setOpenTime] = useState("11:00");
  const [dlBusy, setDlBusy] = useState<"open" | "close" | null>(null);
  const [dlNow, setDlNow] = useState(() => new Date());

  const loadDeadline = () => {
    const today = new Date().toISOString().slice(0, 10);
    fetch("/api/admin/notices")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: NoticeRow[]) => {
        const todayList = Array.isArray(data) ? data.filter((n) => n.notice_date === today) : [];
        setDlCounts({
          total: todayList.length,
          대기: todayList.filter((n) => n.status === "대기").length,
          진행중: todayList.filter((n) => n.status === "진행중").length,
          마감: todayList.filter((n) => n.status === "마감").length,
        });
      });
  };

  const runBulk = async (action: "open-all" | "close-all") => {
    setDlBusy(action === "open-all" ? "open" : "close");
    try {
      await fetch(`/api/admin/notices/${action}`, { method: "POST" });
      loadDeadline();
      loadNotices();
    } finally {
      setDlBusy(null);
    }
  };

  // ── 스케줄 설정 팝업 ──
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editOpenTime, setEditOpenTime] = useState("11:00");
  const [editCloseTime, setEditCloseTime] = useState(DEFAULT_CLOSE_TIME);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState("");

  const openScheduleModal = () => {
    setEditOpenTime(openTime);
    setEditCloseTime(closeTime);
    setScheduleMsg("");
    setShowScheduleModal(true);
  };

  const saveSchedule = async () => {
    setSavingSchedule(true);
    setScheduleMsg("");
    try {
      const res = await fetch("/api/admin/site-settings/notice_schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openTime: editOpenTime, closeTime: editCloseTime }),
      });
      if (res.ok) {
        setOpenTime(editOpenTime);
        setCloseTime(editCloseTime);
        setScheduleMsg("저장되었습니다.");
        setTimeout(() => { setScheduleMsg(""); setShowScheduleModal(false); }, 1200);
      } else {
        setScheduleMsg("저장에 실패했습니다.");
      }
    } catch {
      setScheduleMsg("네트워크 오류로 저장에 실패했습니다.");
    } finally {
      setSavingSchedule(false);
    }
  };

  const loadNotices = () => {
    setNoticesLoading(true);
    fetch("/api/admin/notices")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setNotices(list);
        setSelectedNoticeId((prev) => prev ?? (list[0] ? list[0].id : null));
      })
      .finally(() => setNoticesLoading(false));
  };

  // 마감 관리에서 설정한 마감 시각 — 자동 마감 크론(하루 1회)이 아직 안 돌았어도
  // 브라우저 시계 기준으로 마감 시각이 지났으면 화면에서 즉시 "마감"임을 알려준다.
  const [closeTime, setCloseTime] = useState(DEFAULT_CLOSE_TIME);
  const isPastClose = useIsPastClose(closeTime);

  useEffect(() => {
    loadNotices();
    loadDeadline();
    fetch("/api/admin/site-settings/notice_schedule")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setCloseTime(data?.closeTime || DEFAULT_CLOSE_TIME);
        setOpenTime(data?.openTime || "11:00");
      });
    const timer = setInterval(() => setDlNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const handleNoticeCreated = (id: string) => {
    setShowRegister(false);
    loadNotices();
    setSelectedNoticeId(id);
    // 생성된 공지가 목록에 나타날 때까지 잠시 스크롤 안내
  };

  const handleCloseByDate = async (date: string) => {
    const dateNotices = notices.filter((n) => n.notice_date === date);
    const active = dateNotices.filter((n) => n.status === "진행중");
    if (active.length === 0) {
      alert("이 날짜에 진행중인 공지가 없습니다.");
      return;
    }
    if (!confirm(`${fmtNoticeDate(date)} 공지 ${active.length}건을 마감 처리할까요?`)) return;
    setClosingDate(date);
    try {
      const res = await fetch(`/api/admin/notices/close-by-date?date=${date}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error ?? "마감 처리에 실패했습니다."); return; }
      setNotices((prev) =>
        prev.map((n) => n.notice_date === date && n.status === "진행중"
          ? { ...n, status: "마감" as const, closed_at: new Date().toISOString() }
          : n
        )
      );
    } catch {
      alert("네트워크 오류로 마감 처리에 실패했습니다.");
    } finally {
      setClosingDate(null);
    }
  };

  const handleDelete = async (id: string, name?: string) => {
    if (!confirm(`"${name ?? "이 공지"}" 공지를 삭제할까요?\n접수된 패스 현황도 함께 삭제되며 되돌릴 수 없습니다.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/notices/${id}`, { method: "DELETE" });
      if (res.ok) {
        setNotices((prev) => prev.filter((n) => n.id !== id));
        setSelectedNoticeId((prev) => (prev === id ? null : prev));
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "삭제에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류로 삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  const currentSrc = adminTab === "detail" ? null : STATIC_NAV.find((n) => n.key === adminTab)?.src ?? null;
  const selectedNotice = notices.find((n) => n.id === selectedNoticeId) ?? null;

  // ── 공지 목록 필터 ──
  type ListFilterMode = "month" | "today" | "range";
  const todayKst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const currentMonthKst = () => todayKst().slice(0, 7);
  const [listFilterMode, setListFilterMode] = useState<ListFilterMode>("month");
  const [listFilterFrom, setListFilterFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  });
  const [listFilterTo, setListFilterTo] = useState(todayKst);

  const displayedNotices = notices.filter((n) => {
    if (listFilterMode === "month") return n.notice_date.startsWith(currentMonthKst());
    if (listFilterMode === "today") return n.notice_date === todayKst();
    return n.notice_date >= listFilterFrom && n.notice_date <= listFilterTo;
  });

  // 마감 패스 현황 — 일자 선택 후 그날 공지 전체(여러 상품 포함)의 패스 현황을 엑셀로 한 번에 다운로드
  const uniqueDates = [...new Set(displayedNotices.map((n) => n.notice_date))].sort().reverse();
  const [excelDate, setExcelDate] = useState("");
  const [excelDownloading, setExcelDownloading] = useState(false);

  useEffect(() => {
    if (!excelDate && uniqueDates.length > 0) setExcelDate(uniqueDates[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notices]);

  const downloadDateExcel = async () => {
    if (!excelDate) return;
    const dateNotices = notices.filter((n) => n.notice_date === excelDate);
    if (dateNotices.length === 0) return;
    setExcelDownloading(true);
    try {
      const XLSX = await import("xlsx");
      const allRows: Record<string, string>[] = [];
      for (const n of dateNotices) {
        const res = await fetch(`/api/admin/notices/${n.id}/pass-entries`);
        const data = await res.json();
        if (Array.isArray(data)) {
          for (const r of data as { store_name: string; store_code: string | null; status: string; updated_at: string | null }[]) {
            allRows.push({
              "공지일자": excelDate,
              "상품명": noticeName(n),
              "지점코드": r.store_code ?? "",
              "지점명": r.store_name,
              "상태": r.status,
              "변경 시각": r.updated_at ? new Date(r.updated_at).toLocaleString("ko-KR") : "",
            });
          }
        }
      }
      const ws = XLSX.utils.json_to_sheet(allRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "패스현황");
      XLSX.writeFile(wb, `패스현황_${excelDate}.xlsx`);
    } finally {
      setExcelDownloading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-5">
          <nav className="w-48 flex-shrink-0 space-y-1">
            {STATIC_NAV.map((n) => (
              <button
                key={n.key}
                onClick={() => setAdminTab(n.key)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  adminTab === n.key ? "bg-[#303236] text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {n.label}
              </button>
            ))}
            <div className="pt-2" ref={previewRef}>
              <button
                onClick={openPreviewModal}
                disabled={previewFetching}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-100 flex items-center gap-1.5 disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                {previewFetching ? "불러오는 중..." : "지점 화면 보기"}
              </button>
            </div>
          </nav>

          {/* ── 지점 화면 미리보기 모달 ── */}
          {previewModalToken && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPreviewModalToken(null)}>
              <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ width: 420, height: "85vh" }} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
                  <span className="text-sm font-semibold text-gray-700">지점 화면 샘플</span>
                  <button onClick={() => setPreviewModalToken(null)} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <iframe src={`/b/${previewModalToken}`} className="flex-1 w-full border-0" title="지점 화면 샘플" />
              </div>
            </div>
          )}

          {adminTab === "detail" ? (
            <div className="flex-1 min-w-0 space-y-4">

              {/* ── 마감 관리 썸머리 ── */}
              {(() => {
                const nowMin = dlNow.getHours() * 60 + dlNow.getMinutes();
                const openMin = toMinutes(openTime);
                const closeMin = toMinutes(closeTime);
                const pct = Math.min(100, Math.max(0, ((nowMin - openMin) / (closeMin - openMin)) * 100));
                const countdown =
                  nowMin < openMin
                    ? `${openTime} 자동 오픈 예정`
                    : nowMin >= closeMin
                    ? "마감 시간이 지났습니다"
                    : `마감까지 ${Math.floor((closeMin - nowMin) / 60)}시간 ${(closeMin - nowMin) % 60}분 남음`;
                return (
                  <div className="bg-white border border-gray-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 text-sm flex-shrink-0">
                      <span className="font-bold text-gray-900">{dlCounts.total}건</span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500">대기 <b className="text-gray-700">{dlCounts.대기}</b></span>
                      <span className="text-emerald-600">진행중 <b>{dlCounts.진행중}</b></span>
                      <span className="text-amber-600">마감 <b>{dlCounts.마감}</b></span>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <div className="relative h-1.5 bg-gray-100 rounded-full">
                        <div className="absolute left-0 top-0 h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">{dlNow.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · {countdown}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0 items-center">
                      <button
                        onClick={() => runBulk("open-all")}
                        disabled={dlBusy !== null || dlCounts.대기 === 0}
                        className="px-3 py-1.5 text-[12px] font-bold rounded-lg disabled:opacity-40 bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
                      >
                        {dlBusy === "open" ? "처리 중..." : `대기 (${dlCounts.대기}건)`}
                      </button>
                      <button
                        onClick={() => runBulk("close-all")}
                        disabled={dlBusy !== null || dlCounts.진행중 === 0}
                        className="px-3 py-1.5 text-[12px] font-bold rounded-lg disabled:opacity-40 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                      >
                        {dlBusy === "close" ? "처리 중..." : `진행중 (${dlCounts.진행중}건)`}
                      </button>
                      <span className="px-3 py-1.5 text-[12px] font-bold rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                        마감 {dlCounts.마감}건
                      </span>
                      <button
                        onClick={openScheduleModal}
                        className="px-3 py-1.5 text-[12px] font-medium rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5" />
                        </svg>
                        설정
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* ── 공지 등록 패널 ── */}
              <div className={`border rounded-xl overflow-hidden transition-colors ${showRegister ? "bg-orange-50 border-orange-200" : "bg-white border-orange-200"}`}>
                <button
                  onClick={() => setShowRegister((v) => !v)}
                  className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${showRegister ? "hover:bg-orange-100" : "hover:bg-orange-50"}`}
                >
                  <span className="text-sm font-bold text-orange-700">
                    {showRegister ? "등록 닫기" : "+ 새 공지 등록"}
                  </span>
                  <span className="text-orange-400 text-base">{showRegister ? "▲" : "▼"}</span>
                </button>
                {showRegister && (
                  <div className="border-t border-orange-200 p-5">
                    <NoticeProductPicker onCreated={handleNoticeCreated} />
                  </div>
                )}
              </div>

              {/* ── 공지 목록 ── */}
              {noticesLoading ? (
                <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
              ) : (
                <>
                  {/* 필터 + 엑셀 다운로드 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* 빠른 선택 */}
                    <div className="flex gap-0 border border-gray-200 rounded-lg overflow-hidden">
                      {(["month", "today"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => { setListFilterMode(m); setSelectedNoticeId(null); }}
                          className={`px-3 py-1.5 text-sm font-medium transition-colors ${listFilterMode === m ? "bg-[#303236] text-white" : "text-gray-500 hover:text-gray-900"}`}
                        >
                          {m === "month" ? "이번 달" : "오늘"}
                        </button>
                      ))}
                    </div>
                    {/* 날짜 범위 */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={listFilterFrom}
                        max={listFilterTo}
                        onFocus={() => { setListFilterMode("range"); setSelectedNoticeId(null); }}
                        onChange={(e) => { setListFilterMode("range"); setListFilterFrom(e.target.value); setSelectedNoticeId(null); }}
                        className={`px-3 py-1.5 border rounded-lg text-sm focus:outline-none transition-colors ${listFilterMode === "range" ? "border-[#303236]" : "border-gray-200"}`}
                      />
                      <span className="text-gray-400 text-sm">~</span>
                      <input
                        type="date"
                        value={listFilterTo}
                        min={listFilterFrom}
                        max={todayKst()}
                        onFocus={() => { setListFilterMode("range"); setSelectedNoticeId(null); }}
                        onChange={(e) => { setListFilterMode("range"); setListFilterTo(e.target.value); setSelectedNoticeId(null); }}
                        className={`px-3 py-1.5 border rounded-lg text-sm focus:outline-none transition-colors ${listFilterMode === "range" ? "border-[#303236]" : "border-gray-200"}`}
                      />
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <select
                        value={excelDate}
                        onChange={(e) => setExcelDate(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-[#303236]"
                      >
                        {uniqueDates.map((d) => (
                          <option key={d} value={d}>{fmtNoticeDate(d)}</option>
                        ))}
                      </select>
                      <button
                        onClick={downloadDateExcel}
                        disabled={excelDownloading || !excelDate || uniqueDates.length === 0}
                        className="px-3 py-1.5 text-sm font-semibold border border-gray-200 rounded-lg hover:border-[#303236] disabled:opacity-50"
                      >
                        {excelDownloading ? "다운로드 중..." : "선택 일자 엑셀 다운로드"}
                      </button>
                    </div>
                  </div>
                  {displayedNotices.length === 0 && (
                    <div className="py-10 text-center text-sm text-gray-400 bg-white border border-gray-200 rounded-xl">
                      {notices.length === 0 ? "아직 생성된 공지가 없습니다." : "해당 기간에 공지가 없습니다."}
                    </div>
                  )}
                  {displayedNotices.length > 0 && <div className="flex gap-5 items-start">
                  <div className="w-[70%] min-w-0 bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">공지일자</th>
                          <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 uppercase">상품명</th>
                          <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 uppercase">상태</th>
                          <th className="px-5 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(() => {
                          // 날짜별 그룹핑 — 순서 유지
                          const groups: { date: string; items: typeof notices }[] = [];
                          for (const n of displayedNotices) {
                            const last = groups[groups.length - 1];
                            if (last && last.date === n.notice_date) last.items.push(n);
                            else groups.push({ date: n.notice_date, items: [n] });
                          }
                          return groups.map(({ date, items }) =>
                            items.map((n, ni) => (
                          <tr
                            key={n.id}
                            onClick={() => setSelectedNoticeId(n.id)}
                            className={`cursor-pointer transition-colors ${
                              selectedNoticeId === n.id ? "bg-gray-50" : "hover:bg-gray-50"
                            }`}
                          >
                            {ni === 0 && (
                              <td
                                rowSpan={items.length}
                                className="px-5 py-3 align-top border-r border-gray-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex flex-col gap-2">
                                  <span className="text-sm text-gray-500 font-mono whitespace-nowrap">{fmtNoticeDate(date)}</span>
                                  {items.some((x) => x.status === "진행중") && (
                                    <button
                                      onClick={() => handleCloseByDate(date)}
                                      disabled={closingDate === date}
                                      className="px-2 py-1 text-[11px] font-bold rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-50 whitespace-nowrap"
                                    >
                                      {closingDate === date ? "처리 중..." : "마감 처리"}
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                            <td className="px-5 py-3 text-sm font-semibold text-gray-900">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex-shrink-0 rounded-md overflow-hidden border border-gray-100 bg-gray-50 ${n.temp_image_portrait ? "h-12" : "w-[68px]"}`}
                                  style={{ aspectRatio: noticeCoverAspect(n.temp_image_portrait) }}
                                >
                                  {noticeImage(n) && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={noticeImage(n)!}
                                      alt={noticeName(n)}
                                      loading="lazy"
                                      className={`w-full h-full ${n.temp_image_portrait ? "object-contain" : "object-cover"}`}
                                    />
                                  )}
                                </div>
                                <span>{noticeName(n)}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <NoticeStatusSelect
                                  noticeId={n.id}
                                  status={n.status}
                                  onChanged={(status, data) =>
                                    setNotices((prev) => prev.map((x) => (x.id === n.id ? { ...x, status, ...data } : x)))
                                  }
                                />
                                {n.store_total ? (
                                  <span
                                    className="text-[12px] font-semibold text-gray-500 whitespace-nowrap"
                                    title={`${n.store_total}개 지점 중 ${n.pass_count ?? 0}개 지점 패스`}
                                  >
                                    패스율 {Math.round(((n.pass_count ?? 0) / n.store_total) * 100)}%
                                  </span>
                                ) : null}
                                {n.status === "진행중" && isPastClose && (
                                  <span className="text-[11px] font-semibold text-amber-600 whitespace-nowrap" title="마감 시각이 지났습니다. 자동 마감 처리를 기다리는 중입니다.">
                                    마감 시각 경과
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3 text-right whitespace-nowrap">
                              <div className="inline-flex gap-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReregisterSource(n);
                                    setReregBadge("재공지");
                                    setReregShowCustom(false);
                                    setReregName(n.temp_name ?? n.products?.name ?? "");
                                    setReregCover(n.temp_image_url ?? "");
                                    setReregPortrait(n.temp_image_portrait ?? false);
                                    setReregTagline(n.temp_tagline ?? "");
                                    setReregExtraImages(n.extra_images ?? []);
                                    setReregDesc(n.description ?? "");
                                    setReregError("");
                                    setReregInfo("");
                                  }}
                                  className="px-2.5 py-1.5 text-[12px] font-semibold text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50"
                                >
                                  재등록
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTempNotice(n);
                                  }}
                                  className="px-2.5 py-1.5 text-[12px] font-semibold text-gray-600 border border-gray-300 rounded-lg hover:border-[#303236] hover:text-[#303236]"
                                >
                                  공지 수정
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(n.id, noticeName(n));
                                  }}
                                  disabled={deletingId === n.id || n.status !== "마감"}
                                  title={n.status !== "마감" ? "마감된 공지만 삭제할 수 있습니다." : undefined}
                                  className="px-2.5 py-1.5 text-[12px] font-semibold text-red-500 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {deletingId === n.id ? "삭제 중..." : "삭제"}
                                </button>
                              </div>
                            </td>
                          </tr>
                            ))
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>

                  <div className="w-[30%] min-w-0 space-y-3">
                    {selectedNotice ? (
                      <>
                        <NoticeStatusLine
                          noticeId={selectedNotice.id}
                          productName={noticeName(selectedNotice)}
                          status={selectedNotice.status}
                          openedAt={selectedNotice.opened_at}
                          closedAt={selectedNotice.closed_at}
                          pastCloseHint={isPastClose}
                          onChanged={(status, data) =>
                            setNotices((prev) => prev.map((n) => (n.id === selectedNotice.id ? { ...n, status, ...data } : n)))
                          }
                        />
                        <PassEntriesTable noticeId={selectedNotice.id} noticeDate={selectedNotice.notice_date} />
                      </>
                    ) : (
                      <div className="py-16 text-center text-sm text-gray-400 bg-white border border-gray-200 rounded-xl">
                        공지를 선택하면 출고·패스 현황이 표시됩니다.
                      </div>
                    )}
                  </div>
                  </div>}
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden" style={{ height: "85vh" }}>
              {currentSrc && <iframe key={currentSrc} src={currentSrc} className="w-full h-full border-0" title={adminTab} />}
            </div>
          )}
      </div>

      {editingTempNotice && (
        <TempNoticeEditModal
          noticeId={editingTempNotice.id}
          initialName={editingTempNotice.temp_name ?? ""}
          initialImageUrl={editingTempNotice.temp_image_url}
          initialTagline={editingTempNotice.temp_tagline}
          initialExtraImages={editingTempNotice.extra_images}
          initialBadge={editingTempNotice.badge}
          initialPortrait={editingTempNotice.temp_image_portrait ?? false}
          onClose={() => setEditingTempNotice(null)}
          onSaved={(data) => {
            setNotices((prev) => prev.map((n) => (n.id === editingTempNotice.id ? { ...n, ...data } : n)));
            setEditingTempNotice(null);
          }}
        />
      )}

      {/* ── 재등록 모달 ── */}
      {reregisterSource && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setReregisterSource(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white z-10 rounded-t-2xl">
              <h3 className="font-bold text-[16px] text-gray-900">재등록 — {noticeName(reregisterSource)}</h3>
              <button onClick={() => setReregisterSource(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              {reregInfo && <div className="px-4 py-3 bg-blue-50 border border-blue-200 text-blue-600 text-sm rounded-lg">{reregInfo}</div>}
              {reregError && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{reregError}</div>}

              {/* 뱃지 선택 */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">뱃지 <span className="font-normal text-gray-400">(선택)</span></label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <button type="button" onClick={() => { setReregBadge(""); setReregShowCustom(false); }}
                    className={`px-2.5 py-1 text-[12px] font-semibold rounded-full border transition-colors ${reregBadge === "" && !reregShowCustom ? "bg-gray-200 border-gray-400 text-gray-800" : "border-gray-200 text-gray-500 hover:border-gray-400"}`}>없음</button>
                  {PRESET_BADGES.map((b) => (
                    <button key={b} type="button" onClick={() => { setReregBadge(b); setReregShowCustom(false); }}
                      className={`px-2.5 py-1 text-[12px] font-semibold rounded-full border transition-colors ${reregBadge === b && !reregShowCustom ? "bg-orange-100 border-orange-400 text-orange-800" : "border-gray-200 text-gray-500 hover:border-orange-200 hover:text-orange-700"}`}>{b}</button>
                  ))}
                  <button type="button" onClick={() => { setReregShowCustom(true); if (PRESET_BADGES.includes(reregBadge)) setReregBadge(""); }}
                    className={`px-2.5 py-1 text-[12px] font-semibold rounded-full border transition-colors ${reregShowCustom ? "bg-orange-100 border-orange-400 text-orange-800" : "border-gray-200 text-gray-500 hover:border-orange-200 hover:text-orange-700"}`}>직접 입력</button>
                </div>
                {reregShowCustom && (
                  <input value={reregBadge} onChange={(e) => setReregBadge(e.target.value)}
                    placeholder="뱃지 내용 입력 (예: 한정수량)" maxLength={10}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#303236]" />
                )}
              </div>

              {/* 이미지 */}
              <CoverAndDetailImagesField
                cover={reregCover}
                onCoverChange={setReregCover}
                portrait={reregPortrait}
                onPortraitChange={setReregPortrait}
                detailImages={[]}
                onDetailImagesChange={() => {}}
                showDetail={false}
                onError={setReregError}
                onInfo={(t) => { setReregInfo(t); setTimeout(() => setReregInfo(""), 4000); }}
                coverSize={140}
              />

              {/* 상품명 */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">상품명</label>
                <input value={reregName} onChange={(e) => setReregName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#303236]" />
              </div>

              {/* 상품설명(태그라인) */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">상품설명</label>
                <DescriptionField value={reregTagline} onChange={setReregTagline} />
              </div>

              {/* 추가 사진 */}
              <CoverAndDetailImagesField
                showCover={false}
                cover=""
                onCoverChange={() => {}}
                detailImages={reregExtraImages}
                onDetailImagesChange={setReregExtraImages}
                detailLabel="추가 사진 (선택)"
                detailHint="대표 사진 아래에 함께 노출됩니다."
                onError={setReregError}
                onInfo={(t) => { setReregInfo(t); setTimeout(() => setReregInfo(""), 4000); }}
              />

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={reregSaving}
                  onClick={async () => {
                    if (!reregName.trim()) { setReregError("상품명을 입력해 주세요."); return; }
                    setReregError("");
                    setReregSaving(true);
                    try {
                      const badgeFinal = reregBadge.trim() || null;
                      const res = await fetch("/api/admin/notices", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          product_id: reregisterSource.product_id,
                          temp_name: reregisterSource.product_id ? null : reregName.trim(),
                          temp_image_url: reregisterSource.product_id ? null : (reregCover || null),
                          temp_image_portrait: reregPortrait,
                          temp_tagline: reregisterSource.product_id ? null : (reregTagline.trim() || null),
                          description: reregDesc.trim() || null,
                          extra_images: reregExtraImages,
                          badge: badgeFinal,
                          product_name: reregName.trim(),
                        }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setReregisterSource(null);
                        loadNotices();
                        setSelectedNoticeId(data.id);
                      } else {
                        setReregError(data.error ?? "재등록에 실패했습니다.");
                      }
                    } finally {
                      setReregSaving(false);
                    }
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-bold bg-[#E5541B] text-white rounded-xl hover:bg-[#e04500] disabled:opacity-50"
                >
                  {reregSaving ? "등록 중..." : "재등록 완료"}
                </button>
                <button type="button" onClick={() => setReregisterSource(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50">
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showScheduleModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowScheduleModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-gray-900">공지 시간 설정</h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 text-xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">오픈 시각</label>
                <input
                  type="time"
                  value={editOpenTime}
                  onChange={(e) => setEditOpenTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#303236]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">마감 시각</label>
                <input
                  type="time"
                  value={editCloseTime}
                  onChange={(e) => setEditCloseTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#303236]"
                />
              </div>
            </div>

            {scheduleMsg && (
              <p className={`text-sm font-semibold ${scheduleMsg.includes("실패") || scheduleMsg.includes("오류") ? "text-red-500" : "text-emerald-600"}`}>
                {scheduleMsg}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={saveSchedule}
                disabled={savingSchedule}
                className="flex-1 px-4 py-2.5 text-sm font-bold bg-[#303236] text-white rounded-xl hover:bg-[#1f2124] disabled:opacity-50"
              >
                {savingSchedule ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
