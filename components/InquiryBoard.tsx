"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type FeedItem } from "@/data/inquiryDummy";
import PasswordInput from "@/components/PasswordInput";

// 가맹/제휴 페이지 우측 '문의 현황' 보드.
// 통합 피드(더미 + 마스킹된 실제)를 불러와 누적 전체를 스크롤로 보여준다.

function fmtDate(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  if (diff < 60_000) return "방금 전";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
function isToday(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.toDateString() === new Date().toDateString();
}

// 모바일용 짧은 날짜 — 연도 제거(2026.05.25 → 05.25). "방금 전" 같은 상대 표기는 그대로.
function fmtDateShort(iso: string): string {
  return fmtDate(iso).replace(/^\d{4}\./, "");
}

const STATUS_LABEL: Record<string, string> = { new: "접수", processing: "처리중", done: "답변완료" };

type ViewedPost = {
  status: string; created_at: string; name: string; title: string;
  content: string; reply: string | null; repliedAt: string | null;
};

// 비밀글 열람 모달 — 비밀번호 입력 → 맞으면 본문·답변 표시.
function PostViewModal({ item, onClose }: { item: FeedItem; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [post, setPost] = useState<ViewedPost | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw.trim()) { setError("비밀번호를 입력해주세요."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/inquiries/${item.id}/view`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "확인에 실패했습니다."); return; }
      setPost(d);
    } catch { setError("확인에 실패했습니다. 잠시 후 다시 시도해주세요."); }
    finally { setLoading(false); }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative bg-white w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="닫기" className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#303236]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="min-h-0 overflow-y-auto overscroll-contain flex-1">
          {!post ? (
            <form id="post-view-form" onSubmit={submit} className="px-5 pt-10 pb-6 space-y-4">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 bg-gray-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">작성 시 설정한 <b>비밀번호</b>를 입력하면<br />내용과 답변을 볼 수 있어요.</p>
              </div>
              <PasswordInput mode="mask" inputMode="numeric" pattern="\d*" maxLength={4}
                value={pw} onChange={(e) => setPw(e.target.value.replace(/\D/g, "").slice(0, 4))}
                autoFocus placeholder="숫자 4자리"
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                className="w-full border border-gray-200 px-4 py-2.5 text-sm text-center tracking-[0.3em] focus:outline-none focus:border-[#303236] bg-white" />
              {error && <p className="text-xs text-red-500 text-center">{error}</p>}
            </form>
          ) : (
            <div className="px-5 pt-10 pb-5 space-y-4 text-sm">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{post.name}</span><span>·</span><span>{fmtDate(post.created_at)}</span>
                <span className="ml-auto text-[11px] px-2 py-0.5 bg-gray-100 text-gray-500">{STATUS_LABEL[post.status] ?? post.status}</span>
              </div>
              <div className="text-[#303236] whitespace-pre-line break-words leading-relaxed border border-gray-200 p-3.5 bg-gray-50/40">{post.content || "(내용 없음)"}</div>
              {post.reply ? (
                <div className="border border-[#ffd9c4] bg-[#fff7f1] p-3.5">
                  <p className="text-xs font-bold text-[#E5541B] mb-1.5">답변{post.repliedAt ? ` · ${fmtDate(post.repliedAt)}` : ""}</p>
                  <p className="text-[#303236] whitespace-pre-line break-words leading-relaxed">{post.reply}</p>
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-2">아직 답변이 등록되지 않았습니다.</p>
              )}
            </div>
          )}
        </div>

        {/* 하단 고정 액션 버튼 — 스크롤·키보드와 무관하게 항상 보이도록 분리 */}
        <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-white">
          {!post ? (
            <button type="submit" form="post-view-form" disabled={loading} className="w-full bg-[#303236] text-white text-xs font-semibold tracking-widest py-3 hover:bg-[#E5541B] transition-colors disabled:opacity-50">
              {loading ? "확인 중..." : "확인"}
            </button>
          ) : (
            <button type="button" onClick={onClose} className="w-full border border-gray-200 text-gray-600 text-xs font-semibold py-2.5 hover:bg-gray-50">닫기</button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

const PAGE_SIZE = 30; // 첫 로드·더보기 1회 분량 (서버 페이징)
const SEARCH_DEBOUNCE_MS = 300;

export default function InquiryBoard({ type }: { type?: string }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [viewItem, setViewItem] = useState<FeedItem | null>(null); // 비밀글 열람 대상

  // 검색 — 제목/작성자/작성일자. 더미(가짜) 문의는 검색 대상에서 제외하고 실제 접수 건만 찾는다(서버에서 처리).
  const [qTitle, setQTitle] = useState("");
  const [qAuthor, setQAuthor] = useState("");
  const [qFrom, setQFrom] = useState("");
  const [qTo, setQTo] = useState("");
  const searching = !!(qTitle.trim() || qAuthor.trim() || qFrom || qTo);
  const [showSearch, setShowSearch] = useState(false); // 검색바 접이식 — 기본은 접힘

  const title = type === "wholesale" ? "입점/제휴 문의 현황"
    : type === "franchise" ? "가맹/창업 문의 현황"
    : "문의 현황";
  const accent = type === "wholesale" ? "#2563eb" : "#E5541B"; // 입점=블루, 가맹=오렌지

  // 이전 요청의 늦은 응답이 최신 결과를 덮지 않도록 요청 번호로 구분
  const reqId = useRef(0);

  const buildUrl = useCallback((offset: number) => {
    const p = new URLSearchParams();
    if (type) p.set("type", type);
    p.set("limit", String(PAGE_SIZE));
    p.set("offset", String(offset));
    if (qTitle.trim()) p.set("q", qTitle.trim());
    if (qAuthor.trim()) p.set("author", qAuthor.trim());
    if (qFrom) p.set("from", qFrom);
    if (qTo) p.set("to", qTo);
    return `/api/inquiry-feed?${p.toString()}`;
  }, [type, qTitle, qAuthor, qFrom, qTo]);

  // 처음부터 다시 불러오기(최초·새로고침·검색 변경)
  const load = useCallback(() => {
    const id = ++reqId.current;
    setRefreshing(true);
    fetch(buildUrl(0), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (id !== reqId.current) return;
        setItems(Array.isArray(d.items) ? d.items : []);
        setHasMore(!!d.hasMore);
      })
      .catch(() => {})
      .finally(() => { if (id === reqId.current) { setLoaded(true); setRefreshing(false); } });
  }, [buildUrl]);

  // 더보기 — 현재 개수 이후 분량을 이어서 받는다.
  const loadMore = () => {
    if (loadingMore) return;
    const id = ++reqId.current;
    setLoadingMore(true);
    fetch(buildUrl(items.length), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (id !== reqId.current) return;
        const next: FeedItem[] = Array.isArray(d.items) ? d.items : [];
        setItems((prev) => {
          const seen = new Set(prev.map((x) => x.id));
          return [...prev, ...next.filter((x) => !seen.has(x.id))];
        });
        setHasMore(!!d.hasMore);
      })
      .catch(() => {})
      .finally(() => { if (id === reqId.current) setLoadingMore(false); });
  };

  // 최초 로드 + 검색 조건 변경 시 재조회 (텍스트 입력은 디바운스)
  useEffect(() => {
    const t = setTimeout(load, loaded ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  return (
    <div className="bg-white border border-gray-200/70 h-full flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* 실시간 갱신 중임을 제목 앞에 표기 */}
          <span className="flex items-center gap-1.5 flex-shrink-0 text-xs font-bold tracking-wider" style={{ color: accent }}>
            <span className="w-2 h-2 animate-pulse" style={{ backgroundColor: accent }} />LIVE
          </span>
          <h3 className="text-[20px] md:text-[24px] font-extrabold tracking-[-0.03em] text-[#303236] truncate">{title}</h3>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button type="button" onClick={() => setShowSearch((v) => !v)} aria-expanded={showSearch} aria-label="검색 열기"
            className={`w-11 h-11 flex items-center justify-center border transition-colors ${showSearch || searching ? "border-[#303236] text-[#303236]" : "border-gray-200 text-gray-400 hover:text-[#303236]"}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </button>
          <button type="button" onClick={load} disabled={refreshing} title="새로고침" aria-label="새로고침"
            className="w-11 h-11 flex items-center justify-center border border-gray-200 text-gray-400 hover:text-[#303236] transition-colors disabled:opacity-50">
            <svg className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* 검색바 — 제목/작성자/기간(실제 접수 건만 검색). 검색 버튼으로 펼침 */}
      {(showSearch || searching) && (
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-200 flex-shrink-0 bg-white">
          <input
            type="text" value={qTitle} onChange={(e) => setQTitle(e.target.value)} placeholder="제목 검색"
            className="min-w-0 flex-1 basis-28 h-10 border border-gray-200 px-3 text-sm focus:outline-none focus:border-[#303236]"
          />
          <input
            type="text" value={qAuthor} onChange={(e) => setQAuthor(e.target.value)} placeholder="작성자"
            className="min-w-0 w-24 h-10 border border-gray-200 px-3 text-sm focus:outline-none focus:border-[#303236]"
          />
          <input
            type="date" value={qFrom} onChange={(e) => setQFrom(e.target.value)} max={qTo || undefined} aria-label="시작일"
            className="min-w-0 w-[132px] h-10 border border-gray-200 px-2 text-sm text-gray-500 focus:outline-none focus:border-[#303236]"
          />
          <span className="text-gray-300 text-xs">~</span>
          <input
            type="date" value={qTo} onChange={(e) => setQTo(e.target.value)} min={qFrom || undefined} aria-label="종료일"
            className="min-w-0 w-[132px] h-10 border border-gray-200 px-2 text-sm text-gray-500 focus:outline-none focus:border-[#303236]"
          />
          {searching && (
            <button type="button" onClick={() => { setQTitle(""); setQAuthor(""); setQFrom(""); setQTo(""); }}
              className="h-10 text-xs text-gray-500 hover:text-[#303236] px-2">초기화</button>
          )}
        </div>
      )}

      {/* 목록 (전체 스크롤 — 바닥 근처에서 점진 로드) */}
      <div className="flex-1 overflow-y-auto wu-scroll-light">
        {/* 컬럼 헤더 — 목록 스크롤 영역 안에 고정(sticky)해 스크롤바 유무와 무관하게 행과 열이 정확히 맞는다 */}
        <div className="sticky top-0 z-10 grid grid-cols-[1fr_64px_60px] md:grid-cols-[1fr_72px_96px] px-5 py-2 text-xs font-medium text-gray-500 border-b border-gray-200 border-l-2 border-l-transparent bg-[#FAFAF8]">
          <span>제목</span><span className="text-center">작성자</span><span className="text-center">날짜</span>
        </div>
        {!loaded ? (
          <div className="py-12 text-center text-xs text-gray-300">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-300">검색 결과가 없습니다.</div>
        ) : (
          items.map((it) => {
            const today = isToday(it.created_at);
            return (
              <div
                key={it.id}
                onClick={it.locked ? () => setViewItem(it) : undefined}
                className={`grid grid-cols-[1fr_64px_60px] md:grid-cols-[1fr_72px_96px] px-5 py-3 text-sm items-center border-b border-gray-100 border-l-2 transition-colors hover:bg-[#FAFAF8] ${it.locked ? "cursor-pointer" : ""} ${today ? "bg-[#fff7f1] border-l-[#E5541B]" : "border-l-transparent"}`}
              >
                <span className="text-[#303236] truncate flex items-center gap-1.5 min-w-0">
                  {today && <span className="flex-shrink-0 text-[10px] font-bold tracking-[0.08em] text-[#E5541B]">NEW</span>}
                  {it.locked && (
                    <svg className="w-3 h-3 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-label="비밀글">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                  <span className="truncate">{it.content}</span>
                </span>
                <span className="text-center text-gray-500 truncate">{it.name}</span>
                <span className={`text-center whitespace-nowrap text-xs ${today ? "text-[#E5541B] font-medium" : "text-gray-400"}`}>
                  <span className="md:hidden">{fmtDateShort(it.created_at)}</span>
                  <span className="hidden md:inline">{fmtDate(it.created_at)}</span>
                </span>
              </div>
            );
          })
        )}
        {loaded && hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center justify-center w-full min-h-[52px] border-b border-gray-100 text-sm font-semibold text-[#303236] hover:bg-[#FAFAF8] transition-colors disabled:opacity-50"
          >
            {loadingMore ? "불러오는 중..." : "더보기"}
          </button>
        )}
      </div>

      {viewItem && <PostViewModal item={viewItem} onClose={() => setViewItem(null)} />}
    </div>
  );
}
