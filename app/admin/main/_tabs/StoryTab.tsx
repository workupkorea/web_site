"use client";
import { useState, useEffect, type ReactNode, type CSSProperties } from "react";
import AdminImageField from "@/components/admin/AdminImageField";
import StoryHeroView from "@/components/StoryHeroView";
import StorySectionView from "@/components/StorySectionView";
import { ICON_OPTIONS, type IconKey } from "@/components/story-edit/StoryIcons";
import {
  DEFAULT_STORY, DEFAULT_STORY_STYLE, storyStyleVars, STORY_IMAGE_RATIOS,
  emptySection, uid, SECTION_TYPE_LABEL,
  type StoryConfig, type StoryHero, type StorySection, type StorySectionType, type SectionBg,
  type ValueItem, type FeatureItem, type PhotoItem, type TextFx,
  type DeclarationSection, type CategorySection, type ValuesSection,
  type FoundingSection, type CtaSection, type RichTextSection, type PhotosSection,
  type ProblemSection, type Features3Section, type StoreCtaSection,
  type StoryStyle, type StoryImageRatio,
} from "@/data/story";

// 관리자 STORY 편집기 — 화면을 직접 클릭해 고치는 위지윅 방식은 사용성이 떨어져 폐기했다.
// 이 페이지에서 가능한 것은: (1) 문구 내용 수정 (2) 섹션 추가·삭제·순서·배경·레이아웃 구조 편집
// (3) 텍스트 필드별 스타일 조정 — 폰트크기·색상·줄간격·자간 "이 4가지만" (4) 사진 교체.
// 정렬/굵기 등은 과거 위지윅이 남긴 레거시 데이터 필드(TextFx.align/weight)로만 존재, 이 화면엔 없다.

const SECTION_TYPES: StorySectionType[] = [
  "declaration", "problem", "features3", "category", "values", "founding", "storeCta", "cta", "richtext", "photos",
];
const INPUT = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400";
const CTA_PRESETS = [
  { label: "매장 찾기", href: "/store" },
  { label: "제품 보기", href: "/products" },
  { label: "전화", href: "tel:010-0000-0000" },
  { label: "카카오톡", href: "http://pf.kakao.com/" },
];
const pillClass = (active: boolean) =>
  `text-xs px-3 py-1.5 rounded-lg border transition-colors ${active ? "border-blue-400 text-blue-600 bg-blue-50" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`;

function cleanSection(s: StorySection): StorySection {
  if (s.type === "category") {
    const tags = s.tags.map((t) => t.trim()).filter(Boolean);
    return { ...s, tags: tags.length ? tags : [""] };
  }
  if (s.type === "founding") {
    // 뒤쪽 빈 문단만 제거 — 첫 문단(=인용구 앞 슬롯)의 위치를 보존한다.
    const trimmed = s.paragraphs.map((p) => p.trim());
    let end = trimmed.length;
    while (end > 0 && !trimmed[end - 1]) end--;
    const paragraphs = trimmed.slice(0, end);
    return { ...s, paragraphs: paragraphs.length ? paragraphs : [""] };
  }
  return s;
}

export default function AdminStoryPage() {
  const [hero, setHero] = useState<StoryHero>(DEFAULT_STORY.hero);
  const [sections, setSections] = useState<StorySection[]>([]);
  const [style, setStyle] = useState<StoryStyle>(DEFAULT_STORY_STYLE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ text: "", type: "" });
  const [editing, setEditing] = useState<StorySection | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/site-settings/story_page")
      .then((r) => r.json())
      .then((data: StoryConfig | null) => {
        setHero(data?.hero ?? DEFAULT_STORY.hero);
        setSections(data?.sections?.length ? data.sections : DEFAULT_STORY.sections);
        setStyle({ ...DEFAULT_STORY_STYLE, ...(data?.style ?? {}) });
      })
      .catch(() => {
        setHero(DEFAULT_STORY.hero);
        setSections(DEFAULT_STORY.sections);
      })
      .finally(() => setLoading(false));
  }, []);

  const flash = (text: string, type = "ok") => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: "", type: "" }), 3000);
  };

  const saveAll = async (nextHero: StoryHero, nextSections: StorySection[], nextStyle: StoryStyle = style) => {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/site-settings/story_page", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hero: nextHero, sections: nextSections, style: nextStyle }),
      });
      flash(r.ok ? "저장됐습니다." : "저장에 실패했습니다.", r.ok ? "ok" : "err");
    } catch {
      flash("저장에 실패했습니다.", "err");
    } finally {
      setSaving(false);
    }
  };

  // ── 히어로 ──
  const setHeroField = <K extends keyof StoryHero>(k: K, v: StoryHero[K]) =>
    setHero((prev) => ({ ...prev, [k]: v }));
  const setHeroFx = (key: string, patch: Partial<TextFx>) =>
    setHero((prev) => ({ ...prev, fx: { ...(prev.fx ?? {}), [key]: { ...(prev.fx?.[key] ?? {}), ...patch } } }));
  const resetHeroFx = (key: string) =>
    setHero((prev) => { const rest = { ...(prev.fx ?? {}) }; delete rest[key]; return { ...prev, fx: rest }; });
  const handleSaveHero = () => saveAll(hero, sections);

  // ── 전체 디자인(전역 스타일) ──
  const patchStyle = <K extends keyof StoryStyle>(k: K, v: StoryStyle[K]) => setStyle((s) => ({ ...s, [k]: v }));
  const handleSaveStyle = () => saveAll(hero, sections, style);
  const resetStyle = () => setStyle(DEFAULT_STORY_STYLE);

  // ── 섹션 목록(구조 편집 — 즉시 저장) ──
  const addSection = (type: StorySectionType) => { setEditing(emptySection(type)); setIsNew(true); setPickerOpen(false); };
  const openEdit = (s: StorySection) => { setEditing(JSON.parse(JSON.stringify(s))); setIsNew(false); setPickerOpen(false); };

  const handleSaveSection = async () => {
    if (!editing) return;
    const cleaned = cleanSection(editing);
    const updated = isNew ? [...sections, cleaned] : sections.map((s) => (s.id === cleaned.id ? cleaned : s));
    setSections(updated);
    setEditing(null);
    await saveAll(hero, updated);
  };

  const handleDuplicate = async (s: StorySection) => {
    const copy: StorySection = { ...JSON.parse(JSON.stringify(s)), id: uid() };
    const idx = sections.findIndex((x) => x.id === s.id);
    const next = [...sections];
    next.splice(idx + 1, 0, copy);
    setSections(next);
    await saveAll(hero, next);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 섹션을 삭제할까요?")) return;
    const updated = sections.filter((s) => s.id !== id);
    setSections(updated);
    if (editing?.id === id) setEditing(null);
    await saveAll(hero, updated);
  };

  const toggleVisible = async (s: StorySection) => {
    const updated = sections.map((x) => (x.id === s.id ? { ...x, visible: !x.visible } : x));
    setSections(updated);
    await saveAll(hero, updated);
  };

  const moveInList = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    setSections(next);
    await saveAll(hero, next);
  };

  const handleDrop = async (target: number) => {
    if (dragIndex === null || dragIndex === target) { setDragIndex(null); setDragOver(null); return; }
    const next = [...sections];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(target, 0, moved);
    setSections(next);
    setDragIndex(null); setDragOver(null);
    await saveAll(hero, next);
  };

  // ── 편집 폼(draft) — "저장" 누르기 전까지는 로컬에만 반영 ──
  const setCommon = (patch: { visible?: boolean; bg?: SectionBg }) =>
    setEditing((p) => (p ? ({ ...p, ...patch } as StorySection) : p));
  const setDecl = (patch: Partial<DeclarationSection>) => setEditing((p) => (p && p.type === "declaration" ? { ...p, ...patch } : p));
  const setCat = (patch: Partial<CategorySection>) => setEditing((p) => (p && p.type === "category" ? { ...p, ...patch } : p));
  const setVal = (patch: Partial<ValuesSection>) => setEditing((p) => (p && p.type === "values" ? { ...p, ...patch } : p));
  const setFound = (patch: Partial<FoundingSection>) => setEditing((p) => (p && p.type === "founding" ? { ...p, ...patch } : p));
  const setCta = (patch: Partial<CtaSection>) => setEditing((p) => (p && p.type === "cta" ? { ...p, ...patch } : p));
  const setRich = (patch: Partial<RichTextSection>) => setEditing((p) => (p && p.type === "richtext" ? { ...p, ...patch } : p));
  const setPhotos = (patch: Partial<PhotosSection>) => setEditing((p) => (p && p.type === "photos" ? { ...p, ...patch } : p));
  const setProblem = (patch: Partial<ProblemSection>) => setEditing((p) => (p && p.type === "problem" ? { ...p, ...patch } : p));
  const setFeatures = (patch: Partial<Features3Section>) => setEditing((p) => (p && p.type === "features3" ? { ...p, ...patch } : p));
  const setStoreCta = (patch: Partial<StoreCtaSection>) => setEditing((p) => (p && p.type === "storeCta" ? { ...p, ...patch } : p));

  const updTags = (fn: (a: string[]) => string[]) => setEditing((p) => (p && p.type === "category" ? { ...p, tags: fn(p.tags) } : p));
  const updParas = (fn: (a: string[]) => string[]) => setEditing((p) => (p && p.type === "founding" ? { ...p, paragraphs: fn(p.paragraphs) } : p));
  const updValueItems = (fn: (a: ValueItem[]) => ValueItem[]) => setEditing((p) => (p && p.type === "values" ? { ...p, items: fn(p.items) } : p));
  const updFeatureItems = (fn: (a: FeatureItem[]) => FeatureItem[]) => setEditing((p) => (p && p.type === "features3" ? { ...p, items: fn(p.items) } : p));
  const updPhotoImages = (fn: (a: PhotoItem[]) => PhotoItem[]) =>
    setEditing((p) => (p && (p.type === "photos" || p.type === "storeCta") ? { ...p, images: fn(p.images) } : p));

  // 필드별 서식(fx) — 폰트크기·색상·줄간격·자간 4가지만 여기서 다룬다.
  const setFx = (key: string, patch: Partial<TextFx>) =>
    setEditing((p) => (p ? ({ ...p, fx: { ...(p.fx ?? {}), [key]: { ...(p.fx?.[key] ?? {}), ...patch } } } as StorySection) : p));
  const resetFx = (key: string) =>
    setEditing((p) => {
      if (!p) return p;
      const rest = { ...(p.fx ?? {}) };
      delete rest[key];
      return { ...p, fx: rest } as StorySection;
    });
  const fxProps = (key: string) => ({
    fx: editing?.fx?.[key],
    onFxChange: (patch: Partial<TextFx>) => setFx(key, patch),
    onFxReset: () => resetFx(key),
  });

  if (loading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>;

  const visibleCount = sections.filter((s) => s.visible).length;
  const previewVars = storyStyleVars(style) as CSSProperties;

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">STORY 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            문구·구조는 자유롭게, 스타일은 폰트크기·색상·줄간격·자간·사진만 조정할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {toast.text && (
            <span className={`text-sm font-medium ${toast.type === "err" ? "text-red-500" : "text-green-600"}`}>{toast.text}</span>
          )}
          <a href="/story" target="_blank"
            className="px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            STORY 미리보기 ↗
          </a>
        </div>
      </div>

      {/* ── 전체 디자인(전역) ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="px-6 py-3.5 bg-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">전체 디자인 <span className="text-slate-400 font-normal">· 모든 섹션에 일괄 적용</span></h2>
          <div className="flex items-center gap-2">
            <button onClick={resetStyle} className="px-3 py-1.5 border border-slate-500 text-slate-200 text-xs font-medium rounded-lg hover:bg-slate-700">기본값</button>
            <button onClick={handleSaveStyle} disabled={saving}
              className="px-4 py-1.5 bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
              {saving ? "저장 중..." : "디자인 저장"}
            </button>
          </div>
        </div>
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
          <RangeField label="폰트 크기" value={style.fontScale} min={0.8} max={1.4} step={0.05} display={`${Math.round(style.fontScale * 100)}%`} onChange={(v) => patchStyle("fontScale", v)} />
          <RangeField label="줄간격" value={style.lineHeight} min={1.4} max={2.2} step={0.05} display={style.lineHeight.toFixed(2)} onChange={(v) => patchStyle("lineHeight", v)} />
          <RangeField label="섹션 여백" value={style.sectionSpacing} min={0.6} max={1.6} step={0.05} display={`${Math.round(style.sectionSpacing * 100)}%`} onChange={(v) => patchStyle("sectionSpacing", v)} />
          <RangeField label="이미지 너비" value={style.imageWidth} min={35} max={60} step={1} display={`${style.imageWidth}%`} onChange={(v) => patchStyle("imageWidth", v)} />
          <div className="col-span-2 md:col-span-4 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 mr-1">이미지 비율</span>
            {STORY_IMAGE_RATIOS.map((r) => (
              <button key={r.value} onClick={() => patchStyle("imageRatio", r.value as StoryImageRatio)}
                className={pillClass(style.imageRatio === r.value)}>{r.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 상단 히어로 ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="px-6 py-3.5 bg-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">상단 히어로</h2>
          <button onClick={handleSaveHero} disabled={saving}
            className="px-4 py-1.5 bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
            {saving ? "저장 중..." : "히어로 저장"}
          </button>
        </div>
        <div className="p-6 flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0 space-y-4">
            <AdminImageField
              value={hero.image_url}
              onChange={(url) => setHeroField("image_url", url)}
              promptType="person"
              promptSeed="브랜드 스토리 히어로, 현장, 와이드"
              label="배경 사진"
              recommendedSize={`1920 × ${hero.height}px`}
            />
            <StyledField label="헤드라인" value={hero.heading} onChange={(v) => setHeroField("heading", v)} multiline rows={2}
              placeholder="일하는 사람 편에서&#10;만든 브랜드"
              fx={hero.fx?.heading} onFxChange={(p) => setHeroFx("heading", p)} onFxReset={() => resetHeroFx("heading")} />
            <StyledField label="서브 문구" value={hero.sub} onChange={(v) => setHeroField("sub", v)} multiline={false}
              placeholder="워크업이 왜 존재하는가"
              fx={hero.fx?.sub} onFxChange={(p) => setHeroFx("sub", p)} onFxReset={() => resetHeroFx("sub")} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="높이(px)"><input type="number" value={hero.height} onChange={(e) => setHeroField("height", Number(e.target.value) || 0)} className={INPUT} /></Field>
              <Field label="배경색(사진 없을 때)"><input type="color" value={hero.bg || "#303236"} onChange={(e) => setHeroField("bg", e.target.value)} className="w-full h-[38px] rounded-lg border border-gray-200 cursor-pointer" /></Field>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input type="checkbox" checked={hero.showWatermark} onChange={(e) => setHeroField("showWatermark", e.target.checked)} className="w-4 h-4 accent-[#303236]" />
              WU 워터마크 표시(사진 없을 때만 보임)
            </label>
          </div>
          <div className="w-full lg:w-[300px] flex-shrink-0">
            <p className="text-xs font-semibold text-slate-500 mb-2">미리보기</p>
            <div className="rounded-lg overflow-hidden border border-slate-200" style={previewVars}>
              <StoryHeroView hero={{ ...hero, height: 240 }} />
            </div>
          </div>
        </div>
      </div>

      {visibleCount === 0 && (
        <div className="mb-5 px-4 py-3 text-sm rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
          노출 중인 섹션이 없습니다. 현재 상단 히어로만 표시됩니다.
        </div>
      )}

      {/* ── 섹션 관리 ── */}
      <div className="flex gap-6 items-start">
        <div className="w-[340px] flex-shrink-0 sticky top-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">섹션 ({sections.length})</h2>
              <button onClick={() => setPickerOpen((v) => !v)} className="text-xs font-semibold text-blue-600 hover:text-blue-800">+ 섹션 추가</button>
            </div>
            {pickerOpen && (
              <div className="p-3 border-b border-slate-100 bg-slate-50 grid grid-cols-3 gap-1.5">
                {SECTION_TYPES.map((t) => (
                  <button key={t} onClick={() => addSection(t)}
                    className="text-[11px] font-medium text-slate-600 border border-slate-200 bg-white px-2 py-1.5 rounded hover:border-blue-400 hover:text-blue-600 transition-colors">
                    {SECTION_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            )}
            {sections.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">등록된 섹션이 없습니다.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {sections.map((s, i) => (
                  <li key={s.id} draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
                    onDrop={() => handleDrop(i)}
                    onDragEnd={() => { setDragIndex(null); setDragOver(null); }}
                    className={`flex items-start gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing transition-colors ${editing?.id === s.id ? "bg-blue-50" : "hover:bg-slate-50"} ${dragOver === i && dragIndex !== i ? "bg-orange-50 border-l-2 border-orange-400" : ""}`}>
                    <svg className="w-3 h-3 text-slate-300 flex-shrink-0 mt-1.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 6a1 1 0 100-2 1 1 0 000 2zM16 6a1 1 0 100-2 1 1 0 000 2zM8 12a1 1 0 100-2 1 1 0 000 2zM16 12a1 1 0 100-2 1 1 0 000 2zM8 18a1 1 0 100-2 1 1 0 000 2zM16 18a1 1 0 100-2 1 1 0 000 2z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">{SECTION_TYPE_LABEL[s.type]}</span>
                        <p className="flex-1 min-w-0 text-xs font-semibold text-slate-800 truncate">{sectionSummary(s)}</p>
                        <button onClick={() => toggleVisible(s)} title={s.visible ? "노출 중" : "숨김"}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${s.visible ? "bg-blue-500" : "bg-slate-200"}`}>
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${s.visible ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <button onClick={() => openEdit(s)} className="text-[11px] font-medium text-slate-600 border border-slate-200 px-2 py-0.5 hover:bg-slate-100 rounded">수정</button>
                        <button onClick={() => moveInList(i, -1)} disabled={i === 0} className="text-[11px] font-medium text-slate-500 border border-slate-200 px-2 py-0.5 hover:bg-slate-100 rounded disabled:opacity-30">↑</button>
                        <button onClick={() => moveInList(i, 1)} disabled={i === sections.length - 1} className="text-[11px] font-medium text-slate-500 border border-slate-200 px-2 py-0.5 hover:bg-slate-100 rounded disabled:opacity-30">↓</button>
                        <button onClick={() => handleDuplicate(s)} className="text-[11px] font-medium text-blue-500 border border-blue-200 px-2 py-0.5 hover:bg-blue-50 rounded">복제</button>
                        <button onClick={() => handleDelete(s.id)} className="text-[11px] font-medium text-red-400 border border-red-200 px-2 py-0.5 hover:bg-red-50 rounded">삭제</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 편집 폼 */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-slate-800 flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">
                  {isNew ? "새 섹션 추가" : "섹션 수정"} <span className="text-slate-400 text-sm font-normal">· {SECTION_TYPE_LABEL[editing.type]}</span>
                </h2>
                <div className="flex items-center gap-3">
                  <button onClick={handleSaveSection} disabled={saving}
                    className="px-4 py-1.5 bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                    {saving ? "저장 중..." : "저장"}
                  </button>
                  <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              <div className="p-6 flex gap-6">
                <div className="flex-1 min-w-0 space-y-5">
                  {/* 공통: 노출 + 배경 */}
                  <div className="flex items-center gap-6 pb-4 border-b border-gray-100">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editing.visible} onChange={(e) => setCommon({ visible: e.target.checked })} className="w-4 h-4 accent-[#303236]" />
                      <span className="text-sm text-gray-700">이 섹션 노출</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">배경</span>
                      {(["white", "beige"] as SectionBg[]).map((b) => (
                        <button key={b} onClick={() => setCommon({ bg: b })} className={pillClass(editing.bg === b)}>
                          {b === "white" ? "흰색" : "베이지"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── 선언문 ── */}
                  {editing.type === "declaration" && (
                    <>
                      <Field label="상단 라벨(eyebrow)" hint="현재 화면에는 표시되지 않는 필드입니다.">
                        <input type="text" value={editing.eyebrow} onChange={(e) => setDecl({ eyebrow: e.target.value })} className={INPUT} />
                      </Field>
                      <StyledField label="제목" value={editing.heading} onChange={(v) => setDecl({ heading: v })} multiline rows={2} placeholder="대한민국에는&#10;수많은 사람이 일합니다." {...fxProps("heading")} />
                      <StyledField label="리드 문장" value={editing.lead} onChange={(v) => setDecl({ lead: v })} multiline rows={2} {...fxProps("lead")} />
                      <StyledField label="본문" value={editing.emphasis} onChange={(v) => setDecl({ emphasis: v })} multiline rows={2} {...fxProps("emphasis")} />
                      <StyledField label="굵은 마무리(선택)" value={editing.emphasisStrong} onChange={(v) => setDecl({ emphasisStrong: v })} multiline={false} {...fxProps("emphasisStrong")} />
                      <AdminImageField value={editing.image_url} onChange={(url) => setDecl({ image_url: url })} promptType="person" promptSeed={`브랜드 선언, ${editing.heading}`} label="우측 이미지" recommendedSize="1200 × 800px (3:2)" />
                    </>
                  )}

                  {/* ── 카테고리 ── */}
                  {editing.type === "category" && (
                    <>
                      <StyledField label="상단 라벨" value={editing.eyebrow} onChange={(v) => setCat({ eyebrow: v })} multiline={false} {...fxProps("eyebrow")} />
                      <StyledField label="큰 제목" value={editing.heading} onChange={(v) => setCat({ heading: v })} multiline={false} placeholder="Work Life Wear" {...fxProps("heading")} />
                      <StyledField label="리드 문장" value={editing.lead} onChange={(v) => setCat({ lead: v })} multiline rows={2} {...fxProps("lead")} />
                      <ArrayField label="태그 칩" onAdd={() => updTags((a) => [...a, ""])}>
                        {editing.tags.map((t, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <div className="flex-1"><StyledField label={`태그 ${i + 1}`} value={t} onChange={(v) => updTags((a) => a.map((x, idx) => (idx === i ? v : x)))} multiline={false} placeholder="Workwear" {...fxProps(`tags.${i}`)} /></div>
                            {editing.tags.length > 1 && <RemoveBtn onClick={() => updTags((a) => a.filter((_, idx) => idx !== i))} />}
                          </div>
                        ))}
                      </ArrayField>
                      <StyledField label="하단 본문" value={editing.body} onChange={(v) => setCat({ body: v })} multiline rows={2} {...fxProps("body")} />
                      <AdminImageField value={editing.image_url} onChange={(url) => setCat({ image_url: url })} promptType="product" promptSeed="Work Life Wear" label="좌측 이미지" recommendedSize="1200 × 800px (3:2)" />
                    </>
                  )}

                  {/* ── 핵심가치 ── */}
                  {editing.type === "values" && (
                    <>
                      <StyledField label="상단 라벨" value={editing.eyebrow} onChange={(v) => setVal({ eyebrow: v })} multiline={false} {...fxProps("eyebrow")} />
                      <StyledField label="제목" value={editing.heading} onChange={(v) => setVal({ heading: v })} multiline rows={2} {...fxProps("heading")} />
                      <Field label="레이아웃">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setVal({ layout: "number" })} className={pillClass(editing.layout === "number")}>숫자형</button>
                          <button type="button" onClick={() => setVal({ layout: "icon" })} className={pillClass(editing.layout === "icon")}>아이콘형</button>
                        </div>
                      </Field>
                      <ArrayField label="가치 항목" onAdd={() => updValueItems((a) => { const next = a.reduce((m, x) => Math.max(m, parseInt(x.num, 10) || 0), 0) + 1; return [...a, { num: String(next).padStart(2, "0"), en: "", title: "새 항목", desc: "", icon: "check" }]; })}>
                        {editing.items.map((it, i) => (
                          <div key={i} className="p-3 border border-slate-200 rounded-lg space-y-3 bg-slate-50">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-slate-500">항목 {i + 1}</span>
                              {editing.items.length > 1 && <RemoveBtn onClick={() => updValueItems((a) => a.filter((_, idx) => idx !== i))} />}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Field label="번호"><input type="text" value={it.num} onChange={(e) => updValueItems((a) => a.map((x, idx) => (idx === i ? { ...x, num: e.target.value } : x)))} className={INPUT} placeholder="01" /></Field>
                              <Field label="영문(숫자형에만 표시)"><input type="text" value={it.en} onChange={(e) => updValueItems((a) => a.map((x, idx) => (idx === i ? { ...x, en: e.target.value } : x)))} className={INPUT} placeholder="Function" /></Field>
                            </div>
                            <StyledField label="제목" value={it.title} onChange={(v) => updValueItems((a) => a.map((x, idx) => (idx === i ? { ...x, title: v } : x)))} multiline={false} {...fxProps(`items.${i}.title`)} />
                            <StyledField label="설명" value={it.desc} onChange={(v) => updValueItems((a) => a.map((x, idx) => (idx === i ? { ...x, desc: v } : x)))} multiline rows={2} {...fxProps(`items.${i}.desc`)} />
                            <IconSelect value={it.icon} onChange={(ic) => updValueItems((a) => a.map((x, idx) => (idx === i ? { ...x, icon: ic } : x)))} />
                            <AdminImageField value={it.iconImage} onChange={(url) => updValueItems((a) => a.map((x, idx) => (idx === i ? { ...x, iconImage: url } : x)))} promptType="product" promptSeed="아이콘" label="커스텀 아이콘 이미지(선택, 있으면 우선 적용)" showPrompt={false} recommendedSize="흑백 라인 아이콘 PNG" />
                          </div>
                        ))}
                      </ArrayField>
                    </>
                  )}

                  {/* ── 창업 스토리 ── */}
                  {editing.type === "founding" && (
                    <>
                      <StyledField label="상단 라벨" value={editing.eyebrow} onChange={(v) => setFound({ eyebrow: v })} multiline={false} {...fxProps("eyebrow")} />
                      <StyledField label="제목" value={editing.heading} onChange={(v) => setFound({ heading: v })} multiline rows={2} {...fxProps("heading")} />
                      <ArrayField label="본문 문단(인용구 앞 1개 + 뒤 나머지)" onAdd={() => updParas((a) => [...a, ""])}>
                        {editing.paragraphs.map((para, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <div className="flex-1"><StyledField label={`문단 ${i + 1}`} value={para} onChange={(v) => updParas((a) => a.map((x, idx) => (idx === i ? v : x)))} multiline rows={2} {...fxProps(`paragraphs.${i}`)} /></div>
                            {editing.paragraphs.length > 1 && <RemoveBtn onClick={() => updParas((a) => a.filter((_, idx) => idx !== i))} />}
                          </div>
                        ))}
                      </ArrayField>
                      <StyledField label="인용구(첫 문단 다음에 표시)" value={editing.emphasis} onChange={(v) => setFound({ emphasis: v })} multiline={false} placeholder='"왜 일하는 사람은 좋은 옷을 포기해야 할까?"' {...fxProps("emphasis")} />
                      <StyledField label="마무리 문장" value={editing.closing} onChange={(v) => setFound({ closing: v })} multiline rows={2} {...fxProps("closing")} />
                      <Field label="이미지 위치">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setFound({ imageSide: "left" })} className={pillClass(editing.imageSide === "left")}>왼쪽</button>
                          <button type="button" onClick={() => setFound({ imageSide: "right" })} className={pillClass(editing.imageSide === "right")}>오른쪽</button>
                        </div>
                      </Field>
                      <AdminImageField value={editing.image_url} onChange={(url) => setFound({ image_url: url })} promptType="product" promptSeed={`창업 스토리, ${editing.heading}`} label="이미지" recommendedSize="1200 × 800px (3:2)" />
                    </>
                  )}

                  {/* ── CTA ── */}
                  {editing.type === "cta" && (
                    <>
                      <StyledField label="상단 라벨" value={editing.eyebrow} onChange={(v) => setCta({ eyebrow: v })} multiline={false} {...fxProps("eyebrow")} />
                      <StyledField label="제목" value={editing.heading} onChange={(v) => setCta({ heading: v })} multiline={false} {...fxProps("heading")} />
                      <StyledField label="본문" value={editing.body} onChange={(v) => setCta({ body: v })} multiline rows={2} {...fxProps("body")} />
                      <StyledField label="버튼 문구" value={editing.ctaLabel} onChange={(v) => setCta({ ctaLabel: v })} multiline={false} placeholder="가까운 매장 찾기 →" {...fxProps("ctaLabel")} />
                      <Field label="버튼 링크" hint="오프라인 전환: 매장 찾기·전화·카카오톡 권장">
                        <input type="text" value={editing.ctaHref} onChange={(e) => setCta({ ctaHref: e.target.value })} className={INPUT} placeholder="/store" />
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {CTA_PRESETS.map((p) => (
                            <button key={p.href} onClick={() => setCta({ ctaHref: p.href })} className="text-[11px] px-2.5 py-1 rounded-full border border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors">{p.label}</button>
                          ))}
                        </div>
                      </Field>
                    </>
                  )}

                  {/* ── 자유 텍스트 ── */}
                  {editing.type === "richtext" && (
                    <>
                      <StyledField label="상단 라벨" value={editing.eyebrow} onChange={(v) => setRich({ eyebrow: v })} multiline={false} {...fxProps("eyebrow")} />
                      <StyledField label="제목" value={editing.heading} onChange={(v) => setRich({ heading: v })} multiline rows={2} {...fxProps("heading")} />
                      <StyledField label="본문" value={editing.body} onChange={(v) => setRich({ body: v })} multiline rows={4} {...fxProps("body")} />
                    </>
                  )}

                  {/* ── 사진 갤러리 ── */}
                  {editing.type === "photos" && (
                    <>
                      <Field label="열 수(columns)">
                        <div className="flex gap-2">
                          {([2, 3, 4] as const).map((n) => (
                            <button key={n} onClick={() => setPhotos({ columns: n })} className={pillClass(editing.columns === n)}>{n}열</button>
                          ))}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1.5">권장 사이즈: <span className="font-mono font-semibold text-gray-500">{Math.floor(1920 / editing.columns)} × {Math.floor(1920 / editing.columns)}px</span> · 1:1 정사각형</p>
                      </Field>
                      <ArrayField label={`이미지 목록 (${editing.images.length}장)`} onAdd={() => updPhotoImages((a) => [...a, { url: undefined, alt: "" }])}>
                        {editing.images.map((img, i) => (
                          <div key={i} className="p-3 border border-slate-200 rounded-lg space-y-2 bg-slate-50">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-slate-500">사진 {i + 1}</span>
                              {editing.images.length > 1 && <RemoveBtn onClick={() => updPhotoImages((a) => a.filter((_, idx) => idx !== i))} />}
                            </div>
                            <AdminImageField value={img.url} onChange={(url) => updPhotoImages((a) => a.map((x, idx) => (idx === i ? { ...x, url } : x)))} promptType="product" promptSeed="브랜드 스토리" label="" showPrompt={false} recommendedSize={`${Math.floor(1920 / editing.columns)} × ${Math.floor(1920 / editing.columns)}px`} />
                            <input type="text" value={img.alt || ""} onChange={(e) => updPhotoImages((a) => a.map((x, idx) => (idx === i ? { ...x, alt: e.target.value } : x)))} className={INPUT} placeholder="이미지 설명(alt, 선택)" />
                          </div>
                        ))}
                      </ArrayField>
                    </>
                  )}

                  {/* ── 문제제기 ── */}
                  {editing.type === "problem" && (
                    <>
                      <StyledField label="상단 라벨" value={editing.eyebrow} onChange={(v) => setProblem({ eyebrow: v })} multiline={false} {...fxProps("eyebrow")} />
                      <StyledField label="제목" value={editing.heading} onChange={(v) => setProblem({ heading: v })} multiline rows={2} {...fxProps("heading")} />
                      <StyledField label="본문" value={editing.body} onChange={(v) => setProblem({ body: v })} multiline rows={2} {...fxProps("body")} />
                      <Field label="이미지 위치">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setProblem({ imageSide: "left" })} className={pillClass(editing.imageSide === "left")}>왼쪽</button>
                          <button type="button" onClick={() => setProblem({ imageSide: "right" })} className={pillClass(editing.imageSide === "right")}>오른쪽</button>
                        </div>
                      </Field>
                      <AdminImageField value={editing.image_url} onChange={(url) => setProblem({ image_url: url })} promptType="person" promptSeed="문제 제기, 인물" label="이미지 (자동 흑백 처리됨)" recommendedSize="1200 × 800px (3:2)" />
                    </>
                  )}

                  {/* ── 특징 3아이콘 ── */}
                  {editing.type === "features3" && (
                    <>
                      <StyledField label="상단 라벨" value={editing.eyebrow} onChange={(v) => setFeatures({ eyebrow: v })} multiline={false} {...fxProps("eyebrow")} />
                      <StyledField label="제목" value={editing.heading} onChange={(v) => setFeatures({ heading: v })} multiline rows={2} {...fxProps("heading")} />
                      <StyledField label="리드 문장" value={editing.lead} onChange={(v) => setFeatures({ lead: v })} multiline rows={2} {...fxProps("lead")} />
                      <ArrayField label="항목(보통 3개)" onAdd={() => updFeatureItems((a) => [...a, { icon: "check", label: "NEW", desc: "" }])}>
                        {editing.items.map((it, i) => (
                          <div key={i} className="p-3 border border-slate-200 rounded-lg space-y-3 bg-slate-50">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-slate-500">항목 {i + 1}</span>
                              {editing.items.length > 1 && <RemoveBtn onClick={() => updFeatureItems((a) => a.filter((_, idx) => idx !== i))} />}
                            </div>
                            <StyledField label="라벨(WORK/LIFE/WEAR)" value={it.label} onChange={(v) => updFeatureItems((a) => a.map((x, idx) => (idx === i ? { ...x, label: v } : x)))} multiline={false} {...fxProps(`items.${i}.label`)} />
                            <StyledField label="설명" value={it.desc} onChange={(v) => updFeatureItems((a) => a.map((x, idx) => (idx === i ? { ...x, desc: v } : x)))} multiline rows={2} {...fxProps(`items.${i}.desc`)} />
                            <IconSelect value={it.icon} onChange={(ic) => updFeatureItems((a) => a.map((x, idx) => (idx === i ? { ...x, icon: ic } : x)))} />
                            <AdminImageField value={it.iconImage} onChange={(url) => updFeatureItems((a) => a.map((x, idx) => (idx === i ? { ...x, iconImage: url } : x)))} promptType="product" promptSeed="아이콘" label="커스텀 아이콘 이미지(선택, 있으면 우선 적용)" showPrompt={false} recommendedSize="흑백 라인 아이콘 PNG" />
                          </div>
                        ))}
                      </ArrayField>
                    </>
                  )}

                  {/* ── 매장체험 CTA ── */}
                  {editing.type === "storeCta" && (
                    <>
                      <StyledField label="상단 라벨" value={editing.eyebrow} onChange={(v) => setStoreCta({ eyebrow: v })} multiline={false} {...fxProps("eyebrow")} />
                      <StyledField label="제목" value={editing.heading} onChange={(v) => setStoreCta({ heading: v })} multiline rows={2} {...fxProps("heading")} />
                      <StyledField label="본문" value={editing.body} onChange={(v) => setStoreCta({ body: v })} multiline rows={2} {...fxProps("body")} />
                      <StyledField label="버튼 문구" value={editing.ctaLabel} onChange={(v) => setStoreCta({ ctaLabel: v })} multiline={false} {...fxProps("ctaLabel")} />
                      <Field label="버튼 링크">
                        <input type="text" value={editing.ctaHref} onChange={(e) => setStoreCta({ ctaHref: e.target.value })} className={INPUT} placeholder="/store" />
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {CTA_PRESETS.map((p) => (
                            <button key={p.href} onClick={() => setStoreCta({ ctaHref: p.href })} className="text-[11px] px-2.5 py-1 rounded-full border border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors">{p.label}</button>
                          ))}
                        </div>
                      </Field>
                      <ArrayField label="배경 사진 콜라주" onAdd={() => updPhotoImages((a) => [...a, { url: undefined, alt: "" }])}>
                        {editing.images.map((img, i) => (
                          <div key={i} className="p-3 border border-slate-200 rounded-lg space-y-2 bg-slate-50">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-slate-500">사진 {i + 1}</span>
                              <RemoveBtn onClick={() => updPhotoImages((a) => a.filter((_, idx) => idx !== i))} />
                            </div>
                            <AdminImageField value={img.url} onChange={(url) => updPhotoImages((a) => a.map((x, idx) => (idx === i ? { ...x, url } : x)))} promptType="product" promptSeed="매장 체험" label="" showPrompt={false} recommendedSize="1200 × 1200px" />
                          </div>
                        ))}
                      </ArrayField>
                    </>
                  )}
                </div>

                {/* 섹션 미리보기 */}
                <div className="w-[280px] flex-shrink-0">
                  <p className="text-xs font-semibold text-slate-500 mb-2">미리보기</p>
                  <div className="rounded-lg overflow-auto border border-slate-200 bg-white max-h-[520px]">
                    <div style={{ zoom: 0.5, ...previewVars }}>
                      <StorySectionView section={editing} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm gap-3">
              <p>목록에서 섹션을 선택하거나 "+ 섹션 추가"로 새 섹션을 만드세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 텍스트 + 스타일 조정(폰트크기·색상·줄간격·자간) 필드 ──
function StyledField({
  label, value, onChange, fx, onFxChange, onFxReset, multiline = true, rows = 2, placeholder, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  fx?: TextFx;
  onFxChange: (patch: Partial<TextFx>) => void;
  onFxReset: () => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const hasFx = !!fx && (fx.size !== undefined || !!fx.color || fx.lineHeight !== undefined || fx.letterSpacing !== undefined);
  const numField = (v: number | undefined, onChangeNum: (n: number | undefined) => void, step = 1, ph = "기본") => (
    <input type="number" step={step} value={v ?? ""} placeholder={ph}
      onChange={(e) => onChangeNum(e.target.value === "" ? undefined : Number(e.target.value))}
      className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400" />
  );
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-gray-500">{label}</label>
        <button type="button" onClick={() => setOpen((v) => !v)}
          className={`text-[11px] font-medium ${hasFx ? "text-blue-600" : "text-gray-400"} hover:text-blue-700`}>
          {hasFx ? "● " : ""}스타일{open ? " 접기" : " 조정"}
        </button>
      </div>
      {hint && <p className="text-[11px] text-gray-400 mb-1.5">{hint}</p>}
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={`${INPUT} resize-none`} placeholder={placeholder} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={INPUT} placeholder={placeholder} />
      )}
      {open && (
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">폰트크기(px)</label>
            {numField(fx?.size, (n) => onFxChange({ size: n }))}
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">색상</label>
            <div className="flex items-center gap-1.5">
              <input type="color" value={fx?.color || "#303236"} onChange={(e) => onFxChange({ color: e.target.value })}
                className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5" />
              {fx?.color && <button type="button" onClick={() => onFxChange({ color: undefined })} className="text-[10px] text-gray-400 hover:text-red-500">기본</button>}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">줄간격</label>
            {numField(fx?.lineHeight, (n) => onFxChange({ lineHeight: n }), 0.05)}
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">자간(em)</label>
            {numField(fx?.letterSpacing, (n) => onFxChange({ letterSpacing: n }), 0.01)}
          </div>
          <button type="button" onClick={onFxReset} className="col-span-2 sm:col-span-4 text-[11px] text-amber-600 hover:text-amber-700 text-left mt-1">
            이 항목 스타일 초기화
          </button>
        </div>
      )}
    </div>
  );
}

function IconSelect({ value, onChange }: { value?: IconKey; onChange: (v: IconKey) => void }) {
  return (
    <Field label="프리셋 아이콘" hint="커스텀 아이콘 이미지가 없을 때 사용됩니다.">
      <select value={value ?? "check"} onChange={(e) => onChange(e.target.value as IconKey)} className={INPUT}>
        {ICON_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </Field>
  );
}

function RangeField({ label, value, min, max, step, display, onChange }: {
  label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold text-gray-500">{label}</label>
        <span className="text-xs font-mono font-semibold text-blue-600">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-blue-500 cursor-pointer" />
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">{label}</label>
      {hint && <p className="text-[11px] text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function ArrayField({ label, onAdd, children }: { label: string; onAdd: () => void; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-gray-500">{label}</label>
        <button type="button" onClick={onAdd} className="text-xs text-blue-600 hover:text-blue-800">+ 추가</button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="text-red-400 hover:text-red-600 text-sm px-1 flex-shrink-0 mt-6">✕</button>;
}

function sectionSummary(s: StorySection): string {
  switch (s.type) {
    case "declaration": return s.heading || s.eyebrow || "(선언문)";
    case "category": return s.heading || s.eyebrow || "(카테고리)";
    case "values": return s.heading || s.eyebrow || "(핵심가치)";
    case "founding": return s.heading || s.eyebrow || "(창업스토리)";
    case "cta": return s.heading || s.eyebrow || "(CTA)";
    case "richtext": return s.heading || s.eyebrow || "(자유텍스트)";
    case "photos": return `사진 ${s.images.length}장 · ${s.columns}열`;
    case "problem": return s.heading || s.eyebrow || "(문제제기)";
    case "features3": return s.heading || s.eyebrow || "(특징 3아이콘)";
    case "storeCta": return s.heading || s.eyebrow || "(매장체험 CTA)";
    default: return "(섹션)";
  }
}
