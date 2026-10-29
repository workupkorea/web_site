"use client";
import { useEffect, useState } from "react";
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

// 작성자 검색 — 목록엔 이름 마지막 글자가 마스킹(예: 신예*)되어 있어 실제 이름 전체(신예림)를
// 입력해도 찾을 수 있도록, 마스킹되지 않은 앞부분만 일치하면 매치로 본다.
function authorMatches(storedName: string, query: string): boolean {
  const n = storedName.trim();
  const q = query.trim();
  if (!q) return true;
  if (n.toLowerCase().includes(q.toLowerCase())) return true;
  if (n.endsWith("*")) {
    const visible = n.slice(0, -1);
    if (visible && q.toLowerCase().startsWith(visible.toLowerCase())) return true;
  }
  return false;
}

const RENDER_STEP = 60; // 스크롤 시 한 번에 더 그리는 개수

export default function InquiryBoard({ type }: { type?: string }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [visible, setVisible] = useState(RENDER_STEP); // 점진 렌더(무한 스크롤)
  const [viewItem, setViewItem] = useState<FeedItem | null>(null); // 비밀글 열람 대상

  // 검색 — 제목/작성자/작성일자. 더미(가짜) 문의는 검색 대상에서 제외하고 실제 접수 건만 찾는다.
  const [qTitle, setQTitle] = useState("");
  const [qAuthor, setQAuthor] = useState("");
  const [qFrom, setQFrom] = useState("");
  const [qTo, setQTo] = useState("");
  const searching = !!(qTitle.trim() || qAuthor.trim() || qFrom || qTo);
  const [showSearch, setShowSearch] = useState(false); // 검색바 접이식 — 기본은 접힘

  const filtered = !searching ? items : items.filter((it) => {
    if (it.source !== "real") return false;
    if (qTitle.trim() && !it.content.toLowerCase().includes(qTitle.trim().toLowerCase())) return false;
    if (qAuthor.trim() && !authorMatches(it.name, qAuthor)) return false;
    const day = it.created_at.slice(0, 10);
    if (qFrom && day < qFrom) return false;
    if (qTo && day > qTo) return false;
    return true;
  });

  const title = type === "wholesale" ? "워크업 입점/제휴 문의 현황"
    : type === "franchise" ? "워크업 가맹/창업 문의 현황"
    : "워크업 문의 현황";
  const accent = type === "wholesale" ? "#2563eb" : "#E5541B"; // 입점=블루, 가맹=오렌지

  const load = () => {
    setRefreshing(true);
    setVisible(RENDER_STEP);
    fetch(`/api/inquiry-feed${type ? `?type=${type}` : ""}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setItems(Array.isArray(d.items) ? d.items : []);
        setTotal(typeof d.total === "number" ? d.total : 0);
      })
      .catch(() => {})
      .finally(() => { setLoaded(true); setRefreshing(false); });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // 스크롤이 바닥 근처에 오면 더 그린다.
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      setVisible((v) => (v < filtered.length ? Math.min(v + RENDER_STEP, filtered.length) : v));
    }
  };

  // 검색 조건이 바뀌면 렌더 개수를 처음부터 다시 센다.
  useEffect(() => {
    setVisible(RENDER_STEP);
  }, [qTitle, qAuthor, qFrom, qTo]);

  return (
    <div className="bg-white border border-gray-200 h-full flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200 flex-shrink-0">
        <div className="min-w-0">
          <h3 className="text-base md:text-lg font-extrabold tracking-[-0.03em] text-[#303236] truncate">{title}</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            누적 <b className="text-[#303236]">{total.toLocaleString()}</b>건
            <span className="ml-2 inline-flex items-center gap-1" style={{ color: accent }}>
              <span className="w-1.5 h-1.5 animate-pulse" style={{ backgroundColor: accent }} />LIVE
            </span>
          </p>
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

      {/* 컬럼 헤더 */}
      <div className="grid grid-cols-[1fr_72px_84px] px-5 py-2 text-xs font-medium text-gray-500 border-b border-gray-200 flex-shrink-0 bg-[#FAFAF8]">
        <span>제목</span><span className="text-center">작성자</span><span className="text-right">날짜</span>
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
      <div className="flex-1 overflow-y-auto" onScroll={onScroll}>
        {!loaded ? (
          <div className="py-12 text-center text-xs text-gray-300">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-300">검색 결과가 없습니다.</div>
        ) : (
          filtered.slice(0, visible).map((it) => {
            const today = isToday(it.created_at);
            return (
              <div
                key={it.id}
                onClick={it.locked ? () => setViewItem(it) : undefined}
                className={`grid grid-cols-[1fr_72px_84px] px-5 py-3 text-sm items-center border-b border-gray-100 border-l-2 transition-colors hover:bg-[#FAFAF8] ${it.locked ? "cursor-pointer" : ""} ${today ? "bg-[#fff7f1] border-l-[#E5541B]" : "border-l-transparent"}`}
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
                <span className={`text-right whitespace-nowrap text-xs ${today ? "text-[#E5541B] font-medium" : "text-gray-400"}`}>{fmtDate(it.created_at)}</span>
              </div>
            );
          })
        )}
      </div>

      {viewItem && <PostViewModal item={viewItem} onClose={() => setViewItem(null)} />}
    </div>
  );
}
