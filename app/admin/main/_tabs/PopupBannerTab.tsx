"use client";
import { useState, useEffect, useRef } from "react";

// ── 타입 ────────────────────────────────────────────────────────────────────

type BgType = "solid" | "gradient" | "image";
type LinkType = "url" | "product" | "category" | "page";

type PopupItem = {
  id: string;
  is_active: boolean;
  admin_title: string;
  subtitle: string;
  title: string;
  link_type: LinkType;
  link: string;
  link_text: string;
  bg_type: BgType;
  bg_solid: string;
  bg_gradient_from: string;
  bg_gradient_to: string;
  bg_gradient_angle: number;
  bg_image_url: string;
  bg_image_url_mobile: string;
  bg_image_position: string;         // "50% 50%"
  bg_image_position_mobile: string;  // "" = PC 위치 사용
  bg_image_scale: number;            // 1 = 원본, >1 = 확대
  bg_image_scale_mobile: number;
  text_color: string;                // 팝업 텍스트 색상
  text_align: "left" | "center" | "right";
  text_position: "split" | "top" | "center" | "bottom";
  text_scale: number;                // 1 = 기본 크기
  scheduled_start: string | null;
  scheduled_end: string | null;
  sort_order: number;
};

// ── 상수 ────────────────────────────────────────────────────────────────────

const ANGLE_ARROWS = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"];
const ANGLE_DEGS   = [0, 45, 90, 135, 180, 225, 270, 315];

// 텍스트 배치 매핑 (flex)
const TEXT_V_JUSTIFY: Record<string, string> = { split: "space-between", top: "flex-start", center: "center", bottom: "flex-end" };
const TEXT_H_ALIGN:   Record<string, string> = { left: "flex-start", center: "center", right: "flex-end" };

const GRADIENT_PRESETS = [
  { label: "여름 바다",      from: "#7eb8d4", to: "#a8d8b8", angle: 135 },
  { label: "새벽 노을",      from: "#ff9a44", to: "#fc6076", angle: 135 },
  { label: "딥 네이비",      from: "#303236", to: "#2d4a7a", angle: 135 },
  { label: "민트 그린",      from: "#43b89c", to: "#2b6cb0", angle: 135 },
  { label: "핑크 드림",      from: "#f093fb", to: "#f5576c", angle: 135 },
  { label: "워크업 오렌지",  from: "#E5541B", to: "#ff9a44", angle: 135 },
];

const EMPTY: Omit<PopupItem, "id"> = {
  is_active: true,
  admin_title: "",
  subtitle: "",
  title: "",
  link_type: "product",
  link: "/products",
  link_text: "상품 보러가기",
  bg_type: "gradient",
  bg_solid: "#303236",
  bg_gradient_from: "#7eb8d4",
  bg_gradient_to: "#a8d8b8",
  bg_gradient_angle: 135,
  bg_image_url: "",
  bg_image_url_mobile: "",
  bg_image_position: "50% 50%",
  bg_image_position_mobile: "",
  bg_image_scale: 1,
  bg_image_scale_mobile: 1,
  text_color: "#ffffff",
  text_align: "left",
  text_position: "split",
  text_scale: 1,
  scheduled_start: null,
  scheduled_end: null,
  sort_order: 0,
};

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

function computeBg(item: Omit<PopupItem, "id"> | PopupItem, device: "pc" | "mobile" = "pc"): string {
  if (item.bg_type === "solid") return item.bg_solid || "#303236";
  if (item.bg_type === "gradient")
    return `linear-gradient(${item.bg_gradient_angle}deg, ${item.bg_gradient_from}, ${item.bg_gradient_to})`;
  if (item.bg_type === "image") {
    const url = (device === "mobile" && item.bg_image_url_mobile)
      ? item.bg_image_url_mobile
      : item.bg_image_url;
    if (url) return `url('${url}') center/cover no-repeat`;
  }
  return item.bg_solid || "#303236";
}

function getStatusBadge(item: PopupItem): { label: string; cls: string } {
  if (!item.is_active) return { label: "비활성", cls: "bg-gray-100 text-gray-500" };
  const now = new Date().toISOString();
  if (item.scheduled_start && item.scheduled_start > now)
    return { label: "예약중", cls: "bg-blue-100 text-blue-600" };
  if (item.scheduled_end && item.scheduled_end < now)
    return { label: "종료됨", cls: "bg-orange-100 text-orange-600" };
  return { label: "노출중", cls: "bg-green-100 text-green-600" };
}

function toIsoOrNull(v: string): string | null {
  if (!v) return null;
  try { return new Date(v).toISOString(); } catch { return null; }
}

// ── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function PopupManagePage() {
  const [popups, setPopups]     = useState<PopupItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState("");
  const [editing, setEditing]   = useState<PopupItem | null>(null);
  const [isNew, setIsNew]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileRefMobile = useRef<HTMLInputElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOver,  setDragOver]  = useState<number | null>(null);
  const [separateImg, setSeparateImg] = useState(false);  // PC·모바일 이미지 분리 등록 여부 (false = 공동 사용)

  // 로드
  useEffect(() => {
    fetch("/api/admin/site-settings/popup_banner")
      .then(r => r.json())
      .then((data: { popups?: PopupItem[] } | Record<string, unknown> | null) => {
        if (data && "popups" in data && Array.isArray(data.popups)) {
          // 기존 저장 데이터에 신규 필드가 없을 수 있으므로 기본값으로 채운다.
          setPopups((data.popups as PopupItem[]).map(p => ({ ...EMPTY, ...p })));
        } else if (data && typeof data === "object" && ("title" in data || "subtitle" in data)) {
          // 이전 단일 팝업 포맷 → 마이그레이션
          const d = data as Record<string, unknown>;
          setPopups([{
            ...EMPTY,
            id: crypto.randomUUID(),
            is_active: (d.is_active as boolean) ?? true,
            admin_title: "기존 팝업",
            subtitle: (d.subtitle as string) || "",
            title: (d.title as string) || "",
            link_type: "url",
            link: (d.link as string) || "/products",
            link_text: (d.link_text as string) || "상품 보러가기",
          }]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const flash = (text: string) => { setToast(text); setTimeout(() => setToast(""), 2500); };

  const saveAll = async (list: PopupItem[]) => {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/site-settings/popup_banner", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ popups: list }),
      });
      if (r.ok) flash("저장됐습니다.");
      else flash("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const openNew = () => {
    setEditing({ id: crypto.randomUUID(), ...EMPTY, sort_order: popups.length });
    setSeparateImg(false);
    setIsNew(true);
  };

  const openEdit = (item: PopupItem) => {
    setEditing({ ...EMPTY, ...item });          // 신규 필드 기본값 보강
    setSeparateImg(!!item.bg_image_url_mobile); // 모바일 이미지가 있으면 분리 모드
    setIsNew(false);
  };

  const handleSave = async () => {
    if (!editing) return;
    const updated = isNew
      ? [...popups, editing].map((p, i) => ({ ...p, sort_order: i }))
      : popups.map(p => p.id === editing.id ? editing : p);
    setPopups(updated);
    setEditing(null);
    await saveAll(updated);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 팝업을 삭제할까요?")) return;
    const updated = popups.filter(p => p.id !== id).map((p, i) => ({ ...p, sort_order: i }));
    setPopups(updated);
    await saveAll(updated);
  };

  const handleDuplicate = async (item: PopupItem) => {
    const copy: PopupItem = {
      ...item,
      id: crypto.randomUUID(),
      admin_title: `${item.admin_title || item.title || "팝업"} (복사본)`,
    };
    const idx = popups.findIndex(p => p.id === item.id);
    const next = [...popups];
    next.splice(idx + 1, 0, copy);           // 원본 바로 뒤에 삽입
    const updated = next.map((p, i) => ({ ...p, sort_order: i }));
    setPopups(updated);
    await saveAll(updated);
  };

  const handleDrop = async (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null); setDragOver(null); return;
    }
    const next = [...popups];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    const updated = next.map((p, i) => ({ ...p, sort_order: i }));
    setPopups(updated);
    setDragIndex(null); setDragOver(null);
    await saveAll(updated);
  };

  const set = <K extends keyof PopupItem,>(key: K, val: PopupItem[K]) =>
    setEditing(prev => prev ? { ...prev, [key]: val } : prev);

  const uploadBgImage = async (file: File) => {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: form });
    setUploading(false);
    if (res.ok) {
      const { url } = await res.json();
      set("bg_image_url", url);
    } else {
      flash("이미지 업로드 실패");
    }
  };

  const uploadBgImageMobile = async (file: File) => {
    setUploadingMobile(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: form });
    setUploadingMobile(false);
    if (res.ok) {
      const { url } = await res.json();
      set("bg_image_url_mobile", url);
    } else {
      flash("모바일 이미지 업로드 실패");
    }
  };

  if (loading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>;

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">팝업 배너 관리</h1>
          <p className="mt-1 text-sm text-gray-500">메인 페이지에 표시되는 팝업 배너를 관리합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          {toast && <span className="text-sm font-medium text-green-600">{toast}</span>}
          <button onClick={openNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            팝업 추가
          </button>
        </div>
      </div>

      {/* ── 본문 2열 레이아웃 ── */}
      <div className="flex gap-6 items-start">

        {/* ── 왼쪽: 팝업 목록 ── */}
        <div className="w-[280px] flex-shrink-0 sticky top-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">팝업 목록 ({popups.length})</h2>
              <span className="text-xs text-slate-400">드래그로 순서 변경</span>
            </div>

            {popups.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                <svg className="w-9 h-9 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <rect x="3" y="5" width="18" height="14" rx="2" /><path strokeLinecap="round" d="M3 9h18" />
                </svg>
                등록된 팝업이 없습니다.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {popups.map((item, i) => {
                  const { label, cls } = getStatusBadge(item);
                  return (
                    <li
                      key={item.id}
                      draggable
                      onDragStart={() => setDragIndex(i)}
                      onDragOver={e => { e.preventDefault(); setDragOver(i); }}
                      onDrop={() => handleDrop(i)}
                      onDragEnd={() => { setDragIndex(null); setDragOver(null); }}
                      className={`flex items-center gap-2.5 px-3 py-2.5 cursor-grab active:cursor-grabbing transition-colors ${
                        editing?.id === item.id ? "bg-blue-50" : "hover:bg-slate-50"
                      } ${dragOver === i && dragIndex !== i ? "bg-orange-50 border-l-2 border-orange-400" : ""}`}
                    >
                      <svg className="w-3 h-3 text-slate-300 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 6a1 1 0 100-2 1 1 0 000 2zM16 6a1 1 0 100-2 1 1 0 000 2zM8 12a1 1 0 100-2 1 1 0 000 2zM16 12a1 1 0 100-2 1 1 0 000 2zM8 18a1 1 0 100-2 1 1 0 000 2zM16 18a1 1 0 100-2 1 1 0 000 2z" />
                      </svg>

                      {/* 배경 미리보기 */}
                      <div className="w-11 h-7 rounded flex-shrink-0 border border-gray-100"
                        style={{ background: computeBg(item, "pc") }} />

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate leading-tight">
                          {item.admin_title || item.title || "(제목 없음)"}
                        </p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>{label}</span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openEdit(item)}
                          className="text-[11px] font-medium text-slate-600 border border-slate-200 px-1.5 py-0.5 hover:bg-slate-100 transition-colors rounded">
                          수정
                        </button>
                        <button onClick={() => handleDuplicate(item)} title="복제"
                          className="text-[11px] font-medium text-blue-500 border border-blue-200 px-1.5 py-0.5 hover:bg-blue-50 transition-colors rounded">
                          복제
                        </button>
                        <button onClick={() => handleDelete(item.id)}
                          className="text-[11px] font-medium text-red-400 border border-red-200 px-1.5 py-0.5 hover:bg-red-50 transition-colors rounded">
                          삭제
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {popups.length > 1 && (
            <p className="mt-2.5 text-xs text-slate-400 px-1 leading-relaxed">
              여러 팝업이 활성화된 경우 순서대로 슬라이드로 표시됩니다.
            </p>
          )}
        </div>

        {/* ── 오른쪽: 편집 폼 ── */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {/* 폼 헤더 */}
              <div className="px-6 py-4 bg-slate-800 flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">
                  {isNew ? "새 팝업 추가" : "팝업 수정"}
                </h2>
                <div className="flex items-center gap-3">
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                    {saving
                      ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />저장 중...</>
                      : "저장"}
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
                      placeholder="예: 여름 프로모션"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={editing.is_active}
                        onChange={e => set("is_active", e.target.checked)}
                        className="w-4 h-4 accent-blue-600" />
                      <span className="text-sm font-medium text-gray-700">팝업 활성화</span>
                    </label>
                  </div>
                </div>

                {/* 2. 배경 설정 | 팝업 콘텐츠 + 텍스트 스타일 (2열 나란히) */}
                <div className="pb-5 border-b border-slate-100">
                  <div className="grid grid-cols-2 gap-6 items-start">

                    {/* ── 왼쪽: 배경 설정 ── */}
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">배경 설정</p>

                      {/* 배경 타입 탭 */}
                      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
                        {(["solid", "gradient", "image"] as BgType[]).map(type => (
                          <button key={type} type="button" onClick={() => set("bg_type", type)}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                              editing.bg_type === type
                                ? "bg-white text-slate-800 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                            }`}>
                            {type === "solid" ? "단색" : type === "gradient" ? "그라디언트" : "이미지"}
                          </button>
                        ))}
                      </div>

                      {/* 단색 */}
                      {editing.bg_type === "solid" && (
                        <div className="flex items-center gap-3">
                          <input type="color" value={editing.bg_solid}
                            onChange={e => set("bg_solid", e.target.value)}
                            className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5 flex-shrink-0" />
                          <input type="text" value={editing.bg_solid}
                            onChange={e => set("bg_solid", e.target.value)}
                            placeholder="#303236"
                            className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400" />
                          <div className="w-20 h-10 rounded-lg border border-gray-100 flex-shrink-0"
                            style={{ background: editing.bg_solid }} />
                        </div>
                      )}

                      {/* 그라디언트 */}
                      {editing.bg_type === "gradient" && (
                        <div className="space-y-4">
                          {/* 프리셋 */}
                          <div>
                            <p className="text-xs text-gray-400 mb-2">빠른 선택</p>
                            <div className="flex flex-wrap gap-2">
                              {GRADIENT_PRESETS.map(preset => (
                                <button key={preset.label} type="button"
                                  onClick={() => {
                                    set("bg_gradient_from",  preset.from);
                                    set("bg_gradient_to",    preset.to);
                                    set("bg_gradient_angle", preset.angle);
                                  }}
                                  className="group relative flex-shrink-0">
                                  <div className="w-10 h-10 rounded-lg border-2 border-transparent group-hover:border-blue-400 transition-colors"
                                    style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }} />
                                  <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-gray-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    {preset.label}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 색상 피커 */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs text-gray-500 mb-1.5 block">시작 색상</label>
                              <div className="flex items-center gap-2">
                                <input type="color" value={editing.bg_gradient_from}
                                  onChange={e => set("bg_gradient_from", e.target.value)}
                                  className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 flex-shrink-0" />
                                <input type="text" value={editing.bg_gradient_from}
                                  onChange={e => set("bg_gradient_from", e.target.value)}
                                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400" />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1.5 block">끝 색상</label>
                              <div className="flex items-center gap-2">
                                <input type="color" value={editing.bg_gradient_to}
                                  onChange={e => set("bg_gradient_to", e.target.value)}
                                  className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 flex-shrink-0" />
                                <input type="text" value={editing.bg_gradient_to}
                                  onChange={e => set("bg_gradient_to", e.target.value)}
                                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400" />
                              </div>
                            </div>
                          </div>

                          {/* 방향 */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-xs text-gray-500">방향 ({editing.bg_gradient_angle}°)</label>
                              <div className="flex gap-1">
                                {ANGLE_DEGS.map((deg, idx) => (
                                  <button key={deg} type="button"
                                    onClick={() => set("bg_gradient_angle", deg)}
                                    title={`${deg}°`}
                                    className={`w-7 h-7 text-xs flex items-center justify-center rounded border transition-colors ${
                                      editing.bg_gradient_angle === deg
                                        ? "bg-slate-800 text-white border-slate-800"
                                        : "border-slate-200 text-slate-500 hover:border-slate-400 bg-white"
                                    }`}>
                                    {ANGLE_ARROWS[idx]}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <input type="range" min={0} max={360} value={editing.bg_gradient_angle}
                              onChange={e => set("bg_gradient_angle", Number(e.target.value))}
                              className="w-full accent-slate-700 h-1.5" />
                          </div>

                          {/* 그라디언트 미리보기 */}
                          <div className="h-10 rounded-lg border border-gray-100"
                            style={{ background: `linear-gradient(${editing.bg_gradient_angle}deg, ${editing.bg_gradient_from}, ${editing.bg_gradient_to})` }} />
                        </div>
                      )}

                      {/* 이미지 */}
                      {editing.bg_type === "image" && (
                        <div className="space-y-4">
                          {/* PC·모바일 공동 사용 토글 (기본 체크) */}
                          <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                            <input type="checkbox" checked={!separateImg}
                              onChange={e => {
                                const shared = e.target.checked;
                                setSeparateImg(!shared);
                                if (shared) {
                                  set("bg_image_url_mobile", "");
                                  set("bg_image_position_mobile", "");
                                  set("bg_image_scale_mobile", 1);
                                }
                              }}
                              className="w-4 h-4 accent-blue-600" />
                            <span className="text-sm font-medium text-gray-700">PC·모바일 이미지 공동 사용</span>
                            <span className="text-[11px] text-slate-400">체크 해제 시 분리 등록</span>
                          </label>

                          {/* 이미지 피커 — 공용: 단일 / 분리: 세로 2개 */}
                          {!separateImg ? (
                            <PopupImagePicker
                              label="이미지 (PC·모바일 공용)"
                              sizeHint="권장: 760 × 560px"
                              sizeColor="blue"
                              imageUrl={editing.bg_image_url}
                              position={editing.bg_image_position || "50% 50%"}
                              scale={editing.bg_image_scale ?? 1}
                              onImageChange={(url) => set("bg_image_url", url)}
                              onPositionChange={(pos) => set("bg_image_position", pos)}
                              onScaleChange={(s) => set("bg_image_scale", s)}
                              uploading={uploading}
                              onUpload={uploadBgImage}
                              aspect="pc"
                            />
                          ) : (
                            <div className="space-y-4">
                              <PopupImagePicker
                                label="PC 이미지"
                                sizeHint="권장: 760 × 560px"
                                sizeColor="blue"
                                imageUrl={editing.bg_image_url}
                                position={editing.bg_image_position || "50% 50%"}
                                scale={editing.bg_image_scale ?? 1}
                                onImageChange={(url) => set("bg_image_url", url)}
                                onPositionChange={(pos) => set("bg_image_position", pos)}
                                onScaleChange={(s) => set("bg_image_scale", s)}
                                uploading={uploading}
                                onUpload={uploadBgImage}
                                aspect="pc"
                              />
                              <PopupImagePicker
                                label="모바일 이미지"
                                sizeHint="권장: 750 × 440px"
                                sizeColor="orange"
                                imageUrl={editing.bg_image_url_mobile}
                                position={editing.bg_image_position_mobile || editing.bg_image_position || "50% 50%"}
                                scale={editing.bg_image_scale_mobile ?? 1}
                                onImageChange={(url) => set("bg_image_url_mobile", url)}
                                onPositionChange={(pos) => set("bg_image_position_mobile", pos)}
                                onScaleChange={(s) => set("bg_image_scale_mobile", s)}
                                uploading={uploadingMobile}
                                onUpload={uploadBgImageMobile}
                                aspect="mobile"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ── 오른쪽: 팝업 콘텐츠 + 텍스트 스타일 ── */}
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">팝업 콘텐츠</p>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">서브 문구</label>
                        <input type="text" value={editing.subtitle}
                          onChange={e => set("subtitle", e.target.value)}
                          placeholder="예: 안는 순간, 시원해지는"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">메인 제목</label>
                        <textarea value={editing.title}
                          onChange={e => set("title", e.target.value)}
                          rows={2}
                          placeholder={"여름을 위한\n냉감 멀티쿠션"}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
                      </div>

                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest pt-2">텍스트 스타일</p>
                      <div className="grid grid-cols-2 gap-4 items-start">
                        {/* 텍스트 색상 */}
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1.5">텍스트 색상</label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={editing.text_color || "#ffffff"}
                              onChange={e => set("text_color", e.target.value)}
                              className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 flex-shrink-0" />
                            <input type="text" value={editing.text_color || "#ffffff"}
                              onChange={e => set("text_color", e.target.value)}
                              className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400" />
                            <button type="button" onClick={() => set("text_color", "#ffffff")}
                              title="흰색" className="w-8 h-8 rounded border border-gray-200 bg-white shrink-0" />
                            <button type="button" onClick={() => set("text_color", "#303236")}
                              title="남색" className="w-8 h-8 rounded border border-gray-200 shrink-0" style={{ background: "#303236" }} />
                          </div>
                        </div>
                        {/* 텍스트 크기 */}
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1.5">
                            텍스트 크기 <span className="font-mono text-gray-400">{Math.round((editing.text_scale ?? 1) * 100)}%</span>
                          </label>
                          <input type="range" min={0.7} max={1.6} step={0.05} value={editing.text_scale ?? 1}
                            onChange={e => set("text_scale", Number(e.target.value))}
                            className="w-full accent-slate-700 h-1.5 mt-2.5" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 items-start">
                        {/* 가로 정렬 */}
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1.5">가로 정렬</label>
                          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
                            {([["left", "왼쪽"], ["center", "가운데"], ["right", "오른쪽"]] as const).map(([v, l]) => (
                              <button key={v} type="button" onClick={() => set("text_align", v)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                                  (editing.text_align ?? "left") === v ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                }`}>{l}</button>
                            ))}
                          </div>
                        </div>
                        {/* 세로 위치 */}
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1.5">세로 위치</label>
                          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
                            {([["split", "상하 분리"], ["top", "상단"], ["center", "중앙"], ["bottom", "하단"]] as const).map(([v, l]) => (
                              <button key={v} type="button" onClick={() => set("text_position", v)}
                                className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                                  (editing.text_position ?? "split") === v ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                }`}>{l}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* 4. 링크 설정 */}
                <div className="pb-5 border-b border-slate-100 space-y-3">
                  {/* 섹션 라벨 + 라디오 버튼 한 줄 */}
                  <div className="flex items-center gap-5">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest shrink-0">링크 설정</p>
                    {(["product", "category", "page", "url"] as LinkType[]).map(t => (
                      <label key={t} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={editing.link_type === t}
                          onChange={() => set("link_type", t)}
                          className="accent-blue-600" />
                        <span className="text-sm text-gray-700">
                          {t === "product" ? "제품 선택" : t === "category" ? "카테고리" : t === "page" ? "페이지" : "URL"}
                        </span>
                      </label>
                    ))}
                  </div>
                  {/* 링크 입력 | 버튼 텍스트 */}
                  <div className="grid grid-cols-2 gap-4 items-start">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">
                        {editing.link_type === "url" ? "URL 주소"
                          : editing.link_type === "category" ? "카테고리 선택"
                          : editing.link_type === "page" ? "페이지 선택"
                          : "제품 선택"}
                      </label>
                      {editing.link_type === "url" ? (
                        <input type="text" value={editing.link}
                          onChange={e => set("link", e.target.value)}
                          placeholder="/products"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                      ) : editing.link_type === "category" ? (
                        <CategorySelect
                          currentLink={editing.link}
                          onSelect={(link, label) => {
                            set("link", link);
                            if (!editing.link_text || editing.link_text === "상품 보러가기")
                              set("link_text", `${label} 보러가기`);
                          }}
                        />
                      ) : editing.link_type === "page" ? (
                        <PageSelect
                          currentLink={editing.link}
                          onSelect={(link, title) => {
                            set("link", link);
                            if (!editing.link_text || editing.link_text === "상품 보러가기")
                              set("link_text", title || "자세히 보기");
                          }}
                        />
                      ) : (
                        <ProductSearch
                          currentLink={editing.link}
                          onSelect={(id, name) => {
                            set("link", `/products/${id}`);
                            if (!editing.link_text || editing.link_text === "상품 보러가기")
                              set("link_text", name);
                          }}
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">버튼 텍스트</label>
                      <input type="text" value={editing.link_text}
                        onChange={e => set("link_text", e.target.value)}
                        placeholder="상품 보러가기"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                    </div>
                  </div>
                </div>

                {/* 5. 노출 기간 */}
                <div className="pb-5 border-b border-slate-100">
                  <div className="flex items-start gap-5">
                    {/* 왼쪽: 라벨 */}
                    <div className="w-28 shrink-0">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">노출 기간</p>
                      <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">미설정 시 상시 노출</p>
                    </div>
                    {/* 오른쪽: 시작 / 종료 */}
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">시작 일시</label>
                        <input type="datetime-local"
                          value={editing.scheduled_start ? editing.scheduled_start.slice(0, 16) : ""}
                          onChange={e => set("scheduled_start", toIsoOrNull(e.target.value))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">종료 일시</label>
                        <input type="datetime-local"
                          value={editing.scheduled_end ? editing.scheduled_end.slice(0, 16) : ""}
                          onChange={e => set("scheduled_end", toIsoOrNull(e.target.value))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                      </div>
                    </div>
                    {/* 기간 초기화 */}
                    {(editing.scheduled_start || editing.scheduled_end) && (
                      <button type="button"
                        onClick={() => { set("scheduled_start", null); set("scheduled_end", null); }}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors shrink-0 pt-6">
                        기간 초기화
                      </button>
                    )}
                  </div>
                </div>

                {/* 6. 미리보기 */}
                <div className="space-y-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">미리보기</p>
                  <div className="flex flex-wrap gap-8 items-start">
                    {/* PC */}
                    <div>
                      <p className="text-xs font-medium text-gray-400 mb-2">PC 팝업 <span className="text-gray-300 font-mono text-[10px]">380 × 280px</span></p>
                      <div className="shadow-xl overflow-hidden" style={{ width: 280 }}>
                        <div className="relative flex flex-col p-5 overflow-hidden"
                          style={{
                            height: 200,
                            background: editing.bg_type === "image" ? (editing.bg_image_url ? undefined : (editing.bg_solid || "#303236")) : computeBg(editing, "pc"),
                            justifyContent: TEXT_V_JUSTIFY[editing.text_position ?? "split"],
                            alignItems: TEXT_H_ALIGN[editing.text_align ?? "left"],
                            textAlign: editing.text_align ?? "left",
                            color: editing.text_color || "#ffffff",
                          }}>
                          {editing.bg_type === "image" && editing.bg_image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={editing.bg_image_url} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                              style={{ objectPosition: editing.bg_image_position || "50% 50%", transform: (editing.bg_image_scale ?? 1) !== 1 ? `scale(${editing.bg_image_scale})` : undefined, transformOrigin: editing.bg_image_position || "50% 50%" }} />
                          )}
                          <div className="relative z-10">
                            <p className="leading-snug opacity-80" style={{ fontSize: `${0.75 * (editing.text_scale ?? 1)}rem` }}>{editing.subtitle || "서브 문구"}</p>
                            <p className="mt-1 font-bold leading-tight whitespace-pre-line" style={{ fontSize: `${1.125 * (editing.text_scale ?? 1)}rem` }}>
                              {editing.title || "메인 제목"}
                            </p>
                          </div>
                          <p className="relative z-10 opacity-90 mt-2" style={{ fontSize: `${0.75 * (editing.text_scale ?? 1)}rem` }}>{editing.link_text || "링크 텍스트"} &gt;</p>
                        </div>
                        <div className="flex items-center justify-between bg-white px-4 py-3 border-t border-gray-100">
                          <span className="text-xs text-gray-500">오늘 하루 보지않기</span>
                          <button className="text-xs font-medium text-gray-700">닫기</button>
                        </div>
                      </div>
                    </div>

                    {/* 모바일 */}
                    <div>
                      <p className="text-xs font-medium text-gray-400 mb-2">모바일 바텀시트 <span className="text-gray-300 font-mono text-[10px]">풀스크린 × 220px</span></p>
                      <div className="bg-white rounded-t-3xl shadow-xl overflow-hidden" style={{ width: 260 }}>
                        <div className="flex justify-center pt-3 pb-1">
                          <div className="w-8 h-1 bg-gray-300 rounded-full" />
                        </div>
                        <div className="px-3 pt-1">
                          {(() => {
                            const mUrl = editing.bg_image_url_mobile || editing.bg_image_url;
                            const mPos = editing.bg_image_url_mobile
                              ? (editing.bg_image_position_mobile || editing.bg_image_position || "50% 50%")
                              : (editing.bg_image_position || "50% 50%");
                            const mScale = editing.bg_image_url_mobile
                              ? (editing.bg_image_scale_mobile ?? 1)
                              : (editing.bg_image_scale ?? 1);
                            return (
                              <div className="relative flex flex-col p-4 rounded-xl overflow-hidden"
                                style={{
                                  height: 150,
                                  background: editing.bg_type === "image" ? (mUrl ? undefined : (editing.bg_solid || "#303236")) : computeBg(editing, "mobile"),
                                  justifyContent: TEXT_V_JUSTIFY[editing.text_position ?? "split"],
                                  alignItems: TEXT_H_ALIGN[editing.text_align ?? "left"],
                                  textAlign: editing.text_align ?? "left",
                                  color: editing.text_color || "#ffffff",
                                }}>
                                {editing.bg_type === "image" && mUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={mUrl} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                                    style={{ objectPosition: mPos, transform: mScale !== 1 ? `scale(${mScale})` : undefined, transformOrigin: mPos }} />
                                )}
                                <div className="relative z-10">
                                  <p className="leading-snug opacity-80" style={{ fontSize: `${0.75 * (editing.text_scale ?? 1)}rem` }}>{editing.subtitle || "서브 문구"}</p>
                                  <p className="mt-1 font-bold leading-tight whitespace-pre-line" style={{ fontSize: `${1 * (editing.text_scale ?? 1)}rem` }}>
                                    {editing.title || "메인 제목"}
                                  </p>
                                </div>
                                <p className="relative z-10 opacity-90 mt-2" style={{ fontSize: `${0.75 * (editing.text_scale ?? 1)}rem` }}>{editing.link_text || "링크 텍스트"} &gt;</p>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 mt-1">
                          <span className="text-xs text-gray-500">오늘 하루 보지않기</span>
                          <button className="text-xs font-medium text-gray-700">닫기</button>
                        </div>
                        <div className="h-3" />
                      </div>
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
                <rect x="3" y="5" width="18" height="14" rx="2" /><path strokeLinecap="round" d="M3 9h18" />
              </svg>
              <p>목록에서 팝업을 선택하거나 새 팝업을 추가하세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 팝업 이미지 피커 (위치 드래그 조정) ──────────────────────────────────────

type PopupImagePickerProps = {
  label: string;
  subLabel?: string;
  sizeHint: string;
  sizeColor: "blue" | "orange";
  imageUrl: string;
  position: string;
  scale: number;
  onImageChange: (url: string) => void;
  onPositionChange: (pos: string) => void;
  onScaleChange: (s: number) => void;
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
  aspect: "pc" | "mobile";
  placeholder?: string;
};

function PopupImagePicker({
  label, subLabel, sizeHint, sizeColor,
  imageUrl, position, scale,
  onImageChange, onPositionChange, onScaleChange,
  uploading, onUpload, aspect, placeholder,
}: PopupImagePickerProps) {
  const fileRef    = useRef<HTMLInputElement>(null);
  const boxRef     = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // PC popup: 380×280 → 73.7%  /  Mobile: 750×440 → 58.7%
  const paddingBottom = aspect === "pc" ? "73.7%" : "58.7%";

  const parsePct = (s: string): [number, number] => {
    const parts = (s || "50% 50%").split(" ");
    const x = parseFloat(parts[0] ?? "50");
    const y = parseFloat(parts[1] ?? "50");
    return [isNaN(x) ? 50 : x, isNaN(y) ? 50 : y];
  };

  const pctFromEvent = (e: { clientX: number; clientY: number }): [number, number] => {
    const box = boxRef.current;
    if (!box) return [50, 50];
    const r = box.getBoundingClientRect();
    return [
      Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width)  * 100)),
      Math.max(0, Math.min(100, ((e.clientY - r.top)  / r.height) * 100)),
    ];
  };

  const handleMouseDown = (e: { clientX: number; clientY: number; preventDefault: () => void }) => {
    if (!imageUrl) return;
    e.preventDefault();
    isDragging.current = true;
    const [x, y] = pctFromEvent(e);
    onPositionChange(`${x.toFixed(1)}% ${y.toFixed(1)}%`);

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const [mx, my] = pctFromEvent(ev);
      onPositionChange(`${mx.toFixed(1)}% ${my.toFixed(1)}%`);
    };
    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const [posX, posY] = parsePct(position);
  const accentCls = sizeColor === "blue"
    ? "bg-blue-50 text-blue-600 border-blue-200"
    : "bg-orange-50 text-orange-600 border-orange-200";

  return (
    <div className="space-y-2.5">
      {/* 라벨 */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        {subLabel && <span className="text-[11px] text-slate-400">{subLabel}</span>}
        <span className={`ml-auto text-[10px] font-mono px-2 py-0.5 rounded border ${accentCls}`}>{sizeHint}</span>
      </div>

      {/* 프리뷰 박스 */}
      <div
        ref={boxRef}
        className={`relative w-full overflow-hidden rounded-xl select-none ${
          imageUrl
            ? "cursor-crosshair border-2 border-slate-200"
            : "border-2 border-dashed border-slate-300 cursor-pointer"
        } bg-slate-100`}
        style={{ paddingBottom }}
        onMouseDown={imageUrl ? handleMouseDown : undefined}
        onClick={!imageUrl ? () => fileRef.current?.click() : undefined}
      >
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{ objectPosition: position, transform: (scale ?? 1) !== 1 ? `scale(${scale})` : undefined, transformOrigin: position }}
            />
            <div className="absolute inset-0 bg-black/5 pointer-events-none" />
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
              <span className="text-[10px] bg-black/50 text-white px-2 py-0.5 rounded-full backdrop-blur-sm whitespace-nowrap">
                클릭·드래그로 위치 조정
              </span>
            </div>
            {/* 위치 핀 */}
            <div
              className="absolute pointer-events-none"
              style={{ left: `${posX}%`, top: `${posY}%`, transform: "translate(-50%, -50%)" }}
            >
              <div className="w-5 h-5 rounded-full border-[2.5px] border-white shadow-[0_0_0_1px_rgba(0,0,0,.4)] bg-white/20" />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <span className="text-xs text-center px-4 leading-relaxed">
              {placeholder ?? "클릭하여 이미지 업로드"}
            </span>
          </div>
        )}
      </div>

      {/* 확대 슬라이더 */}
      {imageUrl && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 shrink-0">확대</span>
          <input type="range" min={1} max={2.5} step={0.05} value={scale ?? 1}
            onChange={e => onScaleChange(Number(e.target.value))}
            className="flex-1 accent-slate-700 h-1.5" />
          <span className="text-[10px] font-mono text-slate-400 w-9 text-right shrink-0">{Math.round((scale ?? 1) * 100)}%</span>
        </div>
      )}

      {/* 버튼 행 */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          )}
          {uploading ? "업로드 중..." : "이미지 업로드"}
        </button>

        {imageUrl && (
          <>
            <button
              type="button"
              onClick={() => { onPositionChange("50% 50%"); onScaleChange(1); }}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors"
            >
              위치·확대 초기화
            </button>
            <button
              type="button"
              onClick={() => onImageChange("")}
              className="px-3 py-1.5 text-xs font-medium border border-red-200 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
            >
              이미지 제거
            </button>
            <span className="ml-auto font-mono text-[10px] text-slate-400">{position}</span>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ── 카테고리 선택 컴포넌트 ───────────────────────────────────────────────────

type CatItem = { name: string; subs: string[] };

const DEFAULT_CAT_LIST: CatItem[] = [
  { name: "현장", subs: ["상의", "하의", "계절·기능", "안전용품"] },
  { name: "일상", subs: ["데일리웨어", "아우터", "팬츠"] },
  { name: "공용", subs: ["공용 상의", "공용 하의", "공용 아우터"] },
  { name: "남성", subs: ["남성 상의", "남성 하의", "남성 아우터", "신발"] },
  { name: "여성", subs: ["여성 상의", "여성 하의", "여성 아우터"] },
  { name: "소품", subs: ["가방", "모자", "장갑", "양말", "벨트", "기타"] },
];

function CategorySelect({ currentLink, onSelect }: {
  currentLink: string;
  onSelect: (link: string, label: string) => void;
}) {
  const [cats, setCats] = useState<CatItem[]>(DEFAULT_CAT_LIST);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/site-settings/categories")
      .then(r => r.json())
      .then((data: { categories?: CatItem[] } | null) => {
        if (data?.categories?.length) setCats(data.categories);
      })
      .catch(() => {});
  }, []);

  const parseLink = (link: string) => {
    try {
      const u = new URL(link, "http://x");
      return { main: u.searchParams.get("category") ?? "", sub: u.searchParams.get("sub") ?? "" };
    } catch { return { main: "", sub: "" }; }
  };
  const { main: selMain, sub: selSub } = parseLink(currentLink);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden text-sm max-h-52 overflow-y-auto">
      {/* 전체 상품 */}
      <button type="button"
        onClick={() => onSelect("/products", "전체 상품")}
        className={`w-full text-left px-3 py-2 border-b border-gray-100 font-medium transition-colors ${
          currentLink === "/products" ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-gray-700"
        }`}>
        전체 상품
      </button>

      {cats.map(cat => (
        <div key={cat.name}>
          {/* 대카테고리 행 */}
          <div className="flex items-center border-b border-gray-100">
            <button type="button"
              onClick={() => onSelect(`/products?category=${cat.name}`, cat.name)}
              className={`flex-1 text-left px-3 py-2 font-medium transition-colors ${
                selMain === cat.name && !selSub ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-gray-700"
              }`}>
              {cat.name}
            </button>
            {cat.subs.length > 0 && (
              <button type="button"
                onClick={() => setExpanded(prev => prev === cat.name ? null : cat.name)}
                className="px-3 text-slate-400 hover:text-slate-600 text-xs shrink-0">
                {expanded === cat.name ? "▲" : "▼"}
              </button>
            )}
          </div>

          {/* 소카테고리 목록 (펼침) */}
          {expanded === cat.name && cat.subs.map(sub => (
            <button key={sub} type="button"
              onClick={() => onSelect(`/products?category=${cat.name}&sub=${sub}`, `${cat.name} · ${sub}`)}
              className={`w-full text-left pl-7 pr-3 py-1.5 text-xs border-b border-gray-100 transition-colors ${
                selMain === cat.name && selSub === sub ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-gray-500"
              }`}>
              └ {sub}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── 제품 검색 컴포넌트 ────────────────────────────────────────────────────────

type ProductRow = { id: string; name: string };

function ProductSearch({ currentLink, onSelect }: {
  currentLink: string;
  onSelect: (id: string, name: string) => void;
}) {
  const [all, setAll]         = useState<ProductRow[]>([]);
  const [query, setQuery]     = useState("");
  const [open, setOpen]       = useState(false);
  const [fetched, setFetched] = useState(false);
  const containerRef          = useRef<HTMLDivElement>(null);

  const currentId = currentLink.startsWith("/products/")
    ? currentLink.replace("/products/", "")
    : "";

  const fetchProducts = async () => {
    if (fetched) return;
    try {
      const r = await fetch("/api/admin/products");
      const data = await r.json();
      const items = Array.isArray(data) ? data : (data.items ?? []);
      setAll(items.map((p: ProductRow) => ({ id: p.id, name: p.name })));
      setFetched(true);
    } catch { /* ignore */ }
  };

  const filtered = query.trim()
    ? all.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.id.toLowerCase().includes(query.toLowerCase()))
    : all.slice(0, 8);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { fetchProducts(); setOpen(true); }}
        placeholder="제품명 검색..."
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
                onClick={() => { onSelect(p.id, p.name); setQuery(p.name); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors ${
                  currentId === p.id ? "bg-blue-50 text-blue-700" : "text-gray-700"
                }`}>
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-gray-400 ml-2">{p.id}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── PageSelect ────────────────────────────────────────────────────────────────

type PopupPageItem = { id: string; admin_title: string; title: string; is_visible: boolean };

function PageSelect({
  currentLink,
  onSelect,
}: {
  currentLink: string;
  onSelect: (link: string, title: string) => void;
}) {
  const [pages, setPages] = useState<PopupPageItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/site-settings/popup_pages")
      .then(r => r.json())
      .then(data => {
        const list = (data?.pages as PopupPageItem[] | undefined) ?? [];
        setPages(list);
      })
      .catch(() => setPages([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-xs text-gray-400 py-2">페이지 목록 로딩 중...</p>;
  }

  if (pages.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 rounded-lg p-4 text-center">
        <p className="text-xs text-gray-400 mb-2">생성된 팝업 랜딩 페이지가 없습니다</p>
        <a
          href="/admin/main/popups?tab=pages"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-blue-600 underline hover:text-blue-800"
        >
          팝업 랜딩 페이지 만들기 →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
      {pages.map(p => {
        const link = `/p/${p.id}`;
        const label = p.admin_title || p.title || "(제목 없음)";
        const selected = currentLink === link;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(link, label)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
              selected
                ? "bg-blue-50 border-blue-400 text-blue-700 font-medium"
                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
            }`}
          >
            <span>{label}</span>
            {!p.is_visible && (
              <span className="ml-2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">비공개</span>
            )}
            <span className="block text-[10px] text-gray-400 mt-0.5">{link}</span>
          </button>
        );
      })}
    </div>
  );
}
