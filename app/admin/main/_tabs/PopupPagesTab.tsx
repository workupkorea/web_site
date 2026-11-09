"use client";
import { useState, useEffect, useRef } from "react";

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type PopupPage = {
  id: string;
  admin_title: string;
  is_visible: boolean;
  label: string;
  label_color: string;
  title: string;
  description: string;
  hero_image_url: string;
  page_bg: string;
  product_section_title: string;
  product_ids: string[];
  cta_text: string;
  cta_link: string;
  sort_order: number;
};

const EMPTY: Omit<PopupPage, "id"> = {
  admin_title: "",
  is_visible: true,
  label: "",
  label_color: "#E5541B",
  title: "",
  description: "",
  hero_image_url: "",
  page_bg: "#FAFAF8",
  product_section_title: "이 기획전의 제품",
  product_ids: [],
  cta_text: "가까운 매장 찾기",
  cta_link: "/store",
  sort_order: 0,
};

type ProductRow = { id: string; name: string; thumbnail_url?: string };

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors shrink-0"
    >
      {copied ? "복사됨" : "복사"}
    </button>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function PopupPagesAdmin() {
  const [pages, setPages]   = useState<PopupPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState("");
  const [editing, setEditing] = useState<PopupPage | null>(null);
  const [isNew, setIsNew]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 로드
  useEffect(() => {
    fetch("/api/admin/site-settings/popup_pages")
      .then(r => r.json())
      .then((data: { pages?: PopupPage[] } | null) => {
        if (data?.pages && Array.isArray(data.pages))
          setPages(data.pages.map(p => ({ ...EMPTY, ...p })));
      })
      .finally(() => setLoading(false));
  }, []);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const saveAll = async (list: PopupPage[]) => {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/site-settings/popup_pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: list }),
      });
      if (r.ok) flash("저장됐습니다."); else flash("저장 실패");
    } finally { setSaving(false); }
  };

  const set = <K extends keyof PopupPage>(key: K, val: PopupPage[K]) =>
    setEditing(prev => prev ? { ...prev, [key]: val } : prev);

  const openNew = () => {
    setEditing({ id: crypto.randomUUID(), ...EMPTY, sort_order: pages.length });
    setIsNew(true);
  };

  const openEdit = (p: PopupPage) => {
    setEditing({ ...EMPTY, ...p });
    setIsNew(false);
  };

  const handleSave = async () => {
    if (!editing) return;
    const updated = isNew
      ? [...pages, editing].map((p, i) => ({ ...p, sort_order: i }))
      : pages.map(p => p.id === editing.id ? editing : p);
    setPages(updated);
    setEditing(null);
    await saveAll(updated);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 페이지를 삭제할까요?")) return;
    const updated = pages.filter(p => p.id !== id).map((p, i) => ({ ...p, sort_order: i }));
    setPages(updated);
    await saveAll(updated);
  };

  const handleToggleVisible = async (id: string) => {
    const updated = pages.map(p => p.id === id ? { ...p, is_visible: !p.is_visible } : p);
    setPages(updated);
    await saveAll(updated);
  };

  const uploadHeroImage = async (file: File) => {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: form });
    setUploading(false);
    if (res.ok) {
      const { url } = await res.json();
      set("hero_image_url", url);
    } else {
      flash("이미지 업로드 실패");
    }
  };

  if (loading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>;

  const publicOrigin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">팝업 랜딩 페이지</h1>
          <p className="mt-1 text-sm text-gray-500">
            팝업 클릭 시 이동할 전용 랜딩 페이지를 만들고 관리합니다.
            URL: <span className="font-mono text-blue-600">/p/[페이지ID]</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {toast && <span className="text-sm font-medium text-green-600">{toast}</span>}
          <button onClick={openNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            페이지 추가
          </button>
        </div>
      </div>

      <div className="flex gap-6 items-start">

        {/* ── 왼쪽: 페이지 목록 ── */}
        <div className="w-[280px] flex-shrink-0 sticky top-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">페이지 목록 ({pages.length})</h2>
            </div>

            {pages.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                <svg className="w-9 h-9 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                등록된 페이지가 없습니다.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pages.map(p => (
                  <li key={p.id}
                    className={`px-4 py-3 transition-colors ${editing?.id === p.id ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {p.admin_title || p.title || "(제목 없음)"}
                        </p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 inline-block ${
                          p.is_visible ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                        }`}>{p.is_visible ? "공개" : "비공개"}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEdit(p)}
                          className="text-[11px] font-medium text-slate-600 border border-slate-200 px-1.5 py-0.5 hover:bg-slate-100 rounded transition-colors">
                          수정
                        </button>
                        <button onClick={() => handleToggleVisible(p.id)}
                          className="text-[11px] font-medium text-blue-500 border border-blue-200 px-1.5 py-0.5 hover:bg-blue-50 rounded transition-colors">
                          {p.is_visible ? "숨김" : "공개"}
                        </button>
                        <button onClick={() => handleDelete(p.id)}
                          className="text-[11px] font-medium text-red-400 border border-red-200 px-1.5 py-0.5 hover:bg-red-50 rounded transition-colors">
                          삭제
                        </button>
                      </div>
                    </div>
                    {/* URL 복사 */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] font-mono text-slate-400 truncate flex-1">/p/{p.id}</span>
                      <CopyBtn text={`${publicOrigin}/p/${p.id}`} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 사용 안내 */}
          <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <p className="text-[11px] font-semibold text-blue-700 mb-1">팝업에서 연결하는 방법</p>
            <p className="text-[10px] text-blue-500 leading-relaxed">
              팝업 배너 관리 → 링크 설정 → <strong>페이지</strong> 선택 후
              원하는 페이지를 고르면 자동으로 URL이 설정됩니다.
            </p>
          </div>
        </div>

        {/* ── 오른쪽: 편집 폼 ── */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {/* 폼 헤더 */}
              <div className="px-6 py-4 bg-slate-800 flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">
                  {isNew ? "새 페이지 추가" : "페이지 수정"}
                </h2>
                <div className="flex items-center gap-3">
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                    {saving ? "저장 중..." : "저장"}
                  </button>
                  <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">

                {/* 1. 기본 설정 */}
                <div className="grid grid-cols-2 gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">관리 제목</label>
                    <input type="text" value={editing.admin_title}
                      onChange={e => set("admin_title", e.target.value)}
                      placeholder="예: 여름 신제품 프로모션"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div className="flex items-end pb-1 gap-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={editing.is_visible}
                        onChange={e => set("is_visible", e.target.checked)}
                        className="w-4 h-4 accent-blue-600" />
                      <span className="text-sm font-medium text-gray-700">페이지 공개</span>
                    </label>
                    {/* 페이지 URL */}
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-mono">/p/{editing.id.slice(0, 8)}…</span>
                      <CopyBtn text={`${publicOrigin}/p/${editing.id}`} />
                    </div>
                  </div>
                </div>

                {/* 2. 히어로 | 콘텐츠 (2열) */}
                <div className="pb-5 border-b border-slate-100">
                  <div className="grid grid-cols-2 gap-6 items-start">

                    {/* 왼쪽: 히어로 이미지 */}
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">히어로 이미지</p>
                      <p className="text-[11px] text-slate-400">우측 이미지 영역 (440:495 비율 권장)</p>

                      {/* 이미지 프리뷰 */}
                      <div
                        className={`relative w-full overflow-hidden rounded-xl bg-slate-100 ${
                          editing.hero_image_url
                            ? "border-2 border-slate-200"
                            : "border-2 border-dashed border-slate-300 cursor-pointer"
                        }`}
                        style={{ aspectRatio: "440 / 495" }}
                        onClick={!editing.hero_image_url ? () => fileRef.current?.click() : undefined}
                      >
                        {editing.hero_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={editing.hero_image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                            </svg>
                            <span className="text-xs">클릭하여 이미지 업로드</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50">
                          {uploading ? "업로드 중..." : "이미지 업로드"}
                        </button>
                        {editing.hero_image_url && (
                          <button type="button" onClick={() => set("hero_image_url", "")}
                            className="px-3 py-1.5 text-xs font-medium border border-red-200 rounded-lg hover:bg-red-50 text-red-400 transition-colors">
                            이미지 제거
                          </button>
                        )}
                      </div>

                      <input ref={fileRef} type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadHeroImage(f); e.target.value = ""; }} />

                      {/* 페이지 배경색 */}
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">페이지 배경색</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={editing.page_bg}
                            onChange={e => set("page_bg", e.target.value)}
                            className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 flex-shrink-0" />
                          <input type="text" value={editing.page_bg}
                            onChange={e => set("page_bg", e.target.value)}
                            className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400" />
                          <button type="button" onClick={() => set("page_bg", "#FAFAF8")}
                            className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500">기본</button>
                          <div className="w-8 h-8 rounded border border-gray-200 flex-shrink-0" style={{ background: editing.page_bg }} />
                        </div>
                      </div>
                    </div>

                    {/* 오른쪽: 텍스트 콘텐츠 */}
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">텍스트 콘텐츠</p>

                      {/* 라벨 + 라벨 색상 */}
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">라벨 (소문자 강조 텍스트)</label>
                        <div className="flex items-center gap-2">
                          <input type="text" value={editing.label}
                            onChange={e => set("label", e.target.value)}
                            placeholder="예: -11도 리얼인가?"
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                          <input type="color" value={editing.label_color}
                            onChange={e => set("label_color", e.target.value)}
                            title="라벨 색상"
                            className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 flex-shrink-0" />
                        </div>
                      </div>

                      {/* 제목 */}
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">제목</label>
                        <textarea value={editing.title}
                          onChange={e => set("title", e.target.value)}
                          rows={2}
                          placeholder={"여름을 이기는\n단 한 벌"}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
                      </div>

                      {/* 설명 */}
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">설명</label>
                        <textarea value={editing.description}
                          onChange={e => set("description", e.target.value)}
                          rows={3}
                          placeholder="땀이 날수록 더욱 시원하게, 뜨거운 햇볕 아래서도 쾌적함을 유지할 수 있는..."
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
                      </div>

                      {/* 실시간 히어로 미리보기 */}
                      <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm" style={{ background: editing.page_bg }}>
                        <div className="flex" style={{ minHeight: 100 }}>
                          <div className="flex-1 bg-white px-4 py-5 flex flex-col justify-center">
                            {editing.label && (
                              <p className="text-[9px] tracking-widest uppercase mb-2" style={{ color: editing.label_color }}>{editing.label}</p>
                            )}
                            <p className="text-sm font-bold text-[#303236] leading-snug whitespace-pre-line">
                              {editing.title || "제목"}
                            </p>
                            {editing.description && (
                              <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed line-clamp-2">{editing.description}</p>
                            )}
                          </div>
                          <div className="w-[90px] bg-gray-100 flex items-center justify-center flex-shrink-0">
                            {editing.hero_image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={editing.hero_image_url} alt="" className="w-full h-full object-cover" style={{ aspectRatio: "440/495" }} />
                            ) : (
                              <span className="text-gray-300 text-lg font-black">WU</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. 제품 선택 */}
                <div className="pb-5 border-b border-slate-100 space-y-4">
                  <div className="flex items-center gap-4">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest shrink-0">제품 선택</p>
                    <input type="text" value={editing.product_section_title}
                      onChange={e => set("product_section_title", e.target.value)}
                      placeholder="이 기획전의 제품"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                    <span className="text-xs text-slate-400 shrink-0">섹션 제목</span>
                  </div>

                  <ProductPicker
                    selectedIds={editing.product_ids}
                    onChange={ids => set("product_ids", ids)}
                  />
                </div>

                {/* 4. CTA 버튼 */}
                <div className="pb-5 border-b border-slate-100 space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">하단 CTA 버튼</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">버튼 텍스트</label>
                      <input type="text" value={editing.cta_text}
                        onChange={e => set("cta_text", e.target.value)}
                        placeholder="가까운 매장 찾기"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">버튼 링크</label>
                      <input type="text" value={editing.cta_link}
                        onChange={e => set("cta_link", e.target.value)}
                        placeholder="/store"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                    </div>
                  </div>
                </div>

                {/* 저장/취소 */}
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={handleSave} disabled={saving}
                    className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                    {saving ? "저장 중..." : "저장"}
                  </button>
                  <button onClick={() => setEditing(null)}
                    className="px-6 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
                    취소
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm gap-3">
              <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p>목록에서 페이지를 선택하거나 새 페이지를 추가하세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 제품 선택 컴포넌트 ────────────────────────────────────────────────────────

function ProductPicker({ selectedIds, onChange }: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [all, setAll]         = useState<ProductRow[]>([]);
  const [query, setQuery]     = useState("");
  const [open, setOpen]       = useState(false);
  const [fetched, setFetched] = useState(false);
  const containerRef          = useRef<HTMLDivElement>(null);

  const fetchProducts = async () => {
    if (fetched) return;
    try {
      const r = await fetch("/api/admin/products");
      const data = await r.json();
      const items = Array.isArray(data) ? data : (data.items ?? []);
      setAll(items.map((p: ProductRow) => ({ id: p.id, name: p.name, thumbnail_url: p.thumbnail_url })));
      setFetched(true);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.trim()
    ? all.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.id.toLowerCase().includes(query.toLowerCase()))
    : all.slice(0, 8);

  const addProduct = (id: string) => {
    if (!selectedIds.includes(id)) onChange([...selectedIds, id]);
    setQuery(""); setOpen(false);
  };

  const removeProduct = (id: string) => onChange(selectedIds.filter(s => s !== id));

  const selectedProducts = selectedIds.map(id => all.find(p => p.id === id)).filter(Boolean) as ProductRow[];

  return (
    <div className="space-y-3">
      {/* 선택된 제품 칩 */}
      {selectedProducts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedProducts.map(p => (
            <div key={p.id} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5">
              {p.thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumbnail_url} alt="" className="w-6 h-6 object-contain rounded" />
              )}
              <span className="text-xs font-medium text-blue-700 max-w-[120px] truncate">{p.name}</span>
              <button type="button" onClick={() => removeProduct(p.id)}
                className="text-blue-400 hover:text-red-500 transition-colors ml-0.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 검색 박스 */}
      <div ref={containerRef} className="relative">
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { fetchProducts(); setOpen(true); }}
          placeholder="제품명으로 검색해서 추가..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        />
        {open && (
          <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto mt-1">
            {!fetched ? (
              <div className="p-3 text-xs text-gray-400 text-center">로딩 중...</div>
            ) : filtered.length === 0 ? (
              <div className="p-3 text-xs text-gray-400 text-center">검색 결과 없음</div>
            ) : (
              filtered.map(p => (
                <button key={p.id} type="button"
                  onClick={() => addProduct(p.id)}
                  disabled={selectedIds.includes(p.id)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    selectedIds.includes(p.id)
                      ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                      : "hover:bg-blue-50 hover:text-blue-700 text-gray-700"
                  }`}>
                  {p.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbnail_url} alt="" className="w-7 h-7 object-contain rounded bg-gray-50 flex-shrink-0" />
                  )}
                  <span className="font-medium flex-1 truncate">{p.name}</span>
                  {selectedIds.includes(p.id) && <span className="text-[10px] text-slate-400 shrink-0">추가됨</span>}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <p className="text-[11px] text-slate-400">{selectedIds.length}개 제품 선택됨 · 드래그 순서 지원 예정</p>
      )}
    </div>
  );
}
