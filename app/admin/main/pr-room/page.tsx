"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  DEFAULT_PR_ROOM, DEFAULT_PR_CATEGORY, PR_CATEGORIES, prCategoryLabel, normalizePrRoom,
  sortPosts, dateToIso, isoToDate,
  type PrRoomConfig, type PrPost, type PrCategory,
} from "@/lib/pr-room";

const INPUT = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400";

function uid() {
  return "pr-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function emptyPost(order: number): PrPost {
  return {
    id: uid(),
    category: DEFAULT_PR_CATEGORY,
    title: "",
    date: isoToDate(new Date().toLocaleDateString("sv-SE")), // 새 글은 오늘 날짜로 시작(캘린더에서 변경)
    image_url: "",
    summary: "",
    body: "",
    link: "",
    is_visible: true,
    sort_order: order,
  };
}

// 업로드 전 자동 리사이징(최장변 1800px 이하, 비율 유지) — editorial 관리와 동일 패턴
async function resizeImage(file: File, maxPx = 1800): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const max = Math.max(img.width, img.height);
      if (max <= maxPx) { resolve(file); return; }
      const ratio = maxPx / max;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(blob
          ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" })
          : file),
        "image/jpeg", 0.92
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(file); };
    img.src = objUrl;
  });
}

// 공용 이미지 업로드 — 성공 시 URL, 실패 시 throw
async function uploadImageFile(file: File): Promise<string> {
  const resized = await resizeImage(file);
  const fd = new FormData();
  fd.append("file", resized);
  const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error ?? "업로드 실패");
  return json.url as string;
}

// 대표 이미지 업로드 필드 (클릭 + 드래그&드롭)
function ImageField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) { setErr("이미지 파일만 업로드 가능합니다."); return; }
    setErr(""); setUploading(true);
    try {
      onChange(await uploadImageFile(file));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "업로드 실패");
    } finally { setUploading(false); }
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
        onClick={() => !uploading && ref.current?.click()}
        className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer aspect-[4/3] ${
          dragging ? "border-[#E5541B] bg-orange-50" :
          value ? "border-gray-200 hover:border-gray-300" :
                  "border-dashed border-gray-300 hover:border-[#303236]"
        }`}
      >
        <input ref={ref} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none">
            <svg className={`w-7 h-7 ${dragging ? "text-[#E5541B]" : "text-gray-300"}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-[11px] text-gray-400 text-center leading-snug px-2">클릭 또는 드래그<br/>(권장 4:3)</p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <span className="w-5 h-5 border-2 border-[#E5541B] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      {value && (
        <button type="button" onClick={() => onChange("")} className="mt-1.5 text-[11px] text-red-400 hover:text-red-600">이미지 제거</button>
      )}
      {err && <p className="text-[11px] text-red-500 mt-1">{err}</p>}
    </div>
  );
}

// ── 리치 텍스트 에디터 (contentEditable 기반, 외부 라이브러리 없음) ──
function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // 마운트 시 한 번만 초기값 주입(이후 JSX로 innerHTML 을 다루면 캐럿이 튐).
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange(ref.current?.innerHTML ?? "");
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };

  const addLink = () => {
    const url = window.prompt("링크 URL 을 입력하세요", "https://");
    if (!url) return;
    const safe = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    ref.current?.focus();
    const sel = window.getSelection();
    if (sel && sel.toString()) {
      document.execCommand("createLink", false, safe);
    } else {
      document.execCommand("insertHTML", false,
        `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`);
    }
    emit();
  };

  const addImage = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const url = await uploadImageFile(file);
      ref.current?.focus();
      document.execCommand("insertHTML", false, `<img src="${url}" alt="" />`);
      emit();
    } catch {
      alert("이미지 업로드에 실패했습니다.");
    } finally { setUploading(false); }
  };

  const Btn = ({ onClick, label, title }: { onClick: () => void; label: React.ReactNode; title: string }) => (
    <button type="button" title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className="px-2.5 h-8 min-w-8 flex items-center justify-center text-[13px] text-gray-600 rounded hover:bg-white hover:text-[#303236] border border-transparent hover:border-gray-200 transition-colors">
      {label}
    </button>
  );

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden focus-within:border-blue-400">
      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-0.5 bg-gray-50 border-b border-gray-200 px-1.5 py-1">
        <Btn onClick={() => exec("bold")} label={<b>가</b>} title="굵게" />
        <Btn onClick={() => exec("underline")} label={<u>가</u>} title="밑줄" />
        <Btn onClick={() => exec("italic")} label={<i>가</i>} title="기울임" />
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <Btn onClick={() => exec("formatBlock", "H2")} label="큰제목" title="큰 제목" />
        <Btn onClick={() => exec("formatBlock", "H3")} label="소제목" title="소제목" />
        <Btn onClick={() => exec("formatBlock", "P")} label="본문" title="본문" />
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <Btn onClick={() => exec("insertUnorderedList")} label="• 목록" title="글머리 목록" />
        <Btn onClick={() => exec("insertOrderedList")} label="1. 목록" title="번호 목록" />
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <Btn onClick={addLink} label="링크" title="링크 삽입" />
        <Btn onClick={() => fileRef.current?.click()} label={uploading ? "업로드…" : "사진"} title="사진 삽입" />
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <Btn onClick={() => { exec("removeFormat"); exec("unlink"); }} label="서식지움" title="서식 지우기" />
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) addImage(f); e.target.value = ""; }} />
      </div>
      {/* 입력 영역 */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        data-placeholder="상세 내용을 입력하세요. 위 도구로 제목·목록·링크·사진을 넣을 수 있습니다."
        className="pr-editor min-h-[240px] px-4 py-3 text-[14px] text-gray-800 leading-[1.9] focus:outline-none
          [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#303236] [&_h2]:my-2
          [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-[#303236] [&_h3]:my-2
          [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-0.5
          [&_a]:text-blue-600 [&_a]:underline [&_img]:rounded-lg [&_img]:my-2 [&_img]:max-w-full [&_img]:h-auto"
      />
      <style>{`.pr-editor:empty:before{content:attr(data-placeholder);color:#9ca3af;}`}</style>
    </div>
  );
}

export default function PrRoomManagePage() {
  const [config, setConfig] = useState<PrRoomConfig>(DEFAULT_PR_ROOM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [view, setView] = useState<"list" | "edit">("list");
  const [draft, setDraft] = useState<PrPost | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    fetch("/api/admin/site-settings/pr_room")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setConfig(normalizePrRoom(data)))
      .catch(() => setConfig(DEFAULT_PR_ROOM))
      .finally(() => setLoading(false));
  }, []);

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2500); };

  // 전체 config 를 서버에 저장(순서대로 sort_order 재부여). 성공 여부 반환.
  const persist = async (next: PrRoomConfig, okMsg: string): Promise<boolean> => {
    // 날짜순 모드면 저장 시점에 날짜 최신순으로 재정렬(새 글·날짜 수정이 즉시 제자리를 찾음)
    const payload: PrRoomConfig = {
      ...next,
      posts: sortPosts(next.posts, next.order_mode).map((post, idx) => ({ ...post, sort_order: idx })),
    };
    setConfig(payload);
    setSaving(true);
    try {
      const r = await fetch("/api/admin/site-settings/pr_room", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      flash(r.ok ? okMsg : "저장에 실패했습니다.");
      return r.ok;
    } catch {
      flash("저장에 실패했습니다.");
      return false;
    } finally { setSaving(false); }
  };

  const setDraftField = (patch: Partial<PrPost>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  // ── 목록 액션 (즉시 저장) ──
  const toggleVisible = (i: number) => {
    const posts = [...config.posts];
    posts[i] = { ...posts[i], is_visible: !posts[i].is_visible };
    persist({ ...config, posts }, posts[i].is_visible ? "공개로 변경했습니다." : "숨김으로 변경했습니다.");
  };
  const movePost = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= config.posts.length) return;
    const posts = [...config.posts];
    [posts[i], posts[j]] = [posts[j], posts[i]];
    // 직접 순서를 바꾸면 수동 모드로 전환 — 이후 날짜와 무관하게 이 순서를 유지
    persist({ ...config, order_mode: "manual", posts }, "순서를 변경했습니다. (수동 순서)");
  };
  const resetToDateOrder = () => persist({ ...config, order_mode: "date" }, "날짜 최신순으로 정렬했습니다.");
  const removePost = (i: number) => {
    if (!window.confirm("이 소식을 삭제할까요? 되돌릴 수 없습니다.")) return;
    persist({ ...config, posts: config.posts.filter((_, idx) => idx !== i) }, "삭제했습니다.");
  };
  const saveHeader = () => persist(config, "상단 문구를 저장했습니다.");

  // ── 편집 화면 진입/저장 ──
  const openNew = () => { setDraft(emptyPost(config.posts.length)); setIsNew(true); setView("edit"); };
  const openEdit = (post: PrPost) => { setDraft({ ...post }); setIsNew(false); setView("edit"); };
  const cancelEdit = () => { setView("list"); setDraft(null); };
  const saveDraft = async () => {
    if (!draft) return;
    const posts = isNew
      ? [draft, ...config.posts]
      : config.posts.map((p) => (p.id === draft.id ? draft : p));
    const ok = await persist({ ...config, posts }, "저장했습니다.");
    if (ok) { setView("list"); setDraft(null); }   // 저장 성공 시 목록으로 이동
  };

  if (loading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>;

  // ══════════════ 편집 화면 ══════════════
  if (view === "edit" && draft) {
    return (
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-5">
          <button onClick={cancelEdit} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#303236]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            목록으로
          </button>
          {toast && <span className="text-sm font-medium text-green-600">{toast}</span>}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-5">{isNew ? "새 소식 작성" : "소식 수정"}</h1>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">대표 이미지</label>
              <ImageField value={draft.image_url} onChange={(url) => setDraftField({ image_url: url })} />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">분류 (공개 페이지 탭)</label>
                <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                  {PR_CATEGORIES.map((c) => (
                    <button key={c.value} type="button"
                      onClick={() => setDraftField({ category: c.value as PrCategory })}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        draft.category === c.value ? "bg-[#303236] text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                      }`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">제목</label>
                  <input className={INPUT} value={draft.title} placeholder="소식 제목"
                    onChange={(e) => setDraftField({ title: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">날짜</label>
                  <div className="flex gap-1.5">
                    {/* 캘린더 선택 — 저장 형식은 기존과 같은 "YYYY.MM.DD" */}
                    <input type="date" className={INPUT} value={dateToIso(draft.date)}
                      onChange={(e) => setDraftField({ date: isoToDate(e.target.value) })} />
                    <button type="button"
                      onClick={() => {
                        const d = new Date();
                        const s = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
                        setDraftField({ date: s });
                      }}
                      className="flex-shrink-0 px-2.5 text-[11px] border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">오늘</button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">요약 (카드·목록 표시)</label>
                <input className={INPUT} value={draft.summary} placeholder="한 줄 요약"
                  onChange={(e) => setDraftField({ summary: e.target.value })} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">본문 (상세 페이지)</label>
            <RichTextEditor value={draft.body} onChange={(html) => setDraftField({ body: html })} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">외부 링크 (선택)</label>
            <input className={INPUT + " font-mono"} value={draft.link} placeholder="https://instagram.com/..."
              onChange={(e) => setDraftField({ link: e.target.value })} />
            <p className="text-[11px] text-gray-400 mt-1">
              입력 시 카드 클릭하면 이 링크로 이동(새 탭). 비우면 사이트 내 상세 페이지로 이동합니다.
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
            <input type="checkbox" checked={draft.is_visible}
              onChange={(e) => setDraftField({ is_visible: e.target.checked })} className="w-4 h-4 accent-blue-600" />
            <span className="text-sm text-gray-600">저장 시 공개 (체크 해제 시 숨김)</span>
          </label>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button onClick={saveDraft} disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? "저장 중..." : "저장하고 목록으로"}
          </button>
          <button onClick={cancelEdit} className="px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700">취소</button>
        </div>
      </div>
    );
  }

  // ══════════════ 목록 화면 ══════════════
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">공지사항 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            공지사항을 이미지형 게시판으로 등록합니다. 공개 페이지:{" "}
            <Link href="/pr" target="_blank" className="text-blue-600 hover:underline font-mono">/pr</Link>
          </p>
        </div>
        <div className="flex items-center gap-4">
          {toast && <span className="text-sm font-medium text-green-600">{toast}</span>}
          <button onClick={openNew}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            소식 추가
          </button>
        </div>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* 페이지 헤더 설정 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">페이지 상단 문구</p>
            <button onClick={saveHeader} disabled={saving}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50">문구 저장</button>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">제목</label>
            <input className={INPUT} value={config.title} onChange={(e) => setConfig((p) => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">부제 (줄바꿈 가능)</label>
            <textarea rows={2} className={INPUT + " resize-none"} value={config.subtitle}
              onChange={(e) => setConfig((p) => ({ ...p, subtitle: e.target.value }))} />
          </div>
        </div>

        {/* 게시글 목록 */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">소식 ({config.posts.length})</p>
          <span className="text-[11px] text-gray-400">공개 {config.posts.filter((p) => p.is_visible).length} · 숨김 {config.posts.filter((p) => !p.is_visible).length}</span>
        </div>
        <div className="flex items-center justify-between -mt-3 text-[11px]">
          <span className="text-gray-400">
            {config.order_mode === "date"
              ? "정렬: 날짜 최신순 자동 (↑↓로 순서를 바꾸면 수동 순서로 전환됩니다)"
              : "정렬: 수동 순서 (날짜와 무관하게 아래 순서를 유지합니다)"}
          </span>
          {config.order_mode === "manual" && (
            <button onClick={resetToDateOrder} disabled={saving}
              className="font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50">날짜순으로 되돌리기</button>
          )}
        </div>

        {config.posts.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
            <p className="text-sm text-slate-400">등록된 소식이 없습니다. 우측 상단 [+ 소식 추가]를 눌러 시작하세요.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {config.posts.map((post, i) => (
              <div key={post.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
                {/* 썸네일 */}
                <div className="w-20 aspect-[4/3] flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-100">
                  {post.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 3l18 18" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* 제목·날짜 */}
                <button onClick={() => openEdit(post)} className="flex-1 min-w-0 text-left group">
                  <p className={`text-sm font-semibold truncate group-hover:text-blue-600 transition-colors ${post.is_visible ? "text-gray-800" : "text-gray-400"}`}>
                    {post.title || "(제목 없음)"}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    <span className={`inline-block mr-1.5 px-1.5 py-px rounded text-[10px] font-semibold ${
                      post.category === "press" ? "bg-orange-50 text-[#E5541B]" : "bg-slate-100 text-slate-500"
                    }`}>{prCategoryLabel(post.category)}</span>
                    {post.date || "날짜 미입력"}{post.link && " · 외부링크"}
                  </p>
                </button>

                {/* 노출 토글 */}
                <button onClick={() => toggleVisible(i)} disabled={saving} title="공개/숨김 전환"
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    post.is_visible
                      ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                      : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${post.is_visible ? "bg-green-500" : "bg-gray-300"}`} />
                  {post.is_visible ? "공개" : "숨김"}
                </button>

                {/* 순서/수정/삭제 */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => movePost(i, -1)} disabled={i === 0 || saving} title="위로"
                    className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30">↑</button>
                  <button onClick={() => movePost(i, 1)} disabled={i === config.posts.length - 1 || saving} title="아래로"
                    className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30">↓</button>
                  <button onClick={() => openEdit(post)} title="수정"
                    className="px-2.5 h-7 flex items-center justify-center rounded border border-slate-200 text-xs text-slate-600 hover:bg-slate-50">수정</button>
                  <button onClick={() => removePost(i)} disabled={saving} title="삭제"
                    className="w-7 h-7 flex items-center justify-center rounded border border-red-200 text-red-400 hover:bg-red-50 disabled:opacity-30">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
