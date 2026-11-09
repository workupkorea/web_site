"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  HOME_SECTIONS,
  DEFAULT_HOME_LAYOUT,
  normalizeHomeLayout,
  type HomeLayoutConfig,
  type HomeSectionLayout,
  type HomeSectionKey,
  type HomeSectionMeta,
} from "@/lib/home-layout";

const META: Record<HomeSectionKey, HomeSectionMeta> = Object.fromEntries(
  HOME_SECTIONS.map((s) => [s.key, s])
) as Record<HomeSectionKey, HomeSectionMeta>;

export default function AdminHomeSectionsPage() {
  const [sections, setSections] = useState<HomeSectionLayout[]>(DEFAULT_HOME_LAYOUT.sections);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/site-settings/home_layout")
      .then((r) => r.json())
      .then((data) => setSections(normalizeHomeLayout(data).sections))
      .catch(() => setSections(DEFAULT_HOME_LAYOUT.sections))
      .finally(() => setLoading(false));
  }, []);

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2500); };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/site-settings/home_layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections } satisfies HomeLayoutConfig),
      });
      if (r.ok) { setDirty(false); flash("저장됐습니다. 메인 페이지에 바로 반영됩니다."); }
      else flash("저장에 실패했습니다.");
    } catch {
      flash("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= sections.length || from === to) return;
    const next = [...sections];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setSections(next);
    setDirty(true);
  };

  const handleDrop = (target: number) => {
    if (dragIndex !== null) move(dragIndex, target);
    setDragIndex(null);
    setDragOver(null);
  };

  const toggle = (key: HomeSectionKey) => {
    setSections((prev) => prev.map((s) => (s.key === key ? { ...s, visible: !s.visible } : s)));
    setDirty(true);
  };

  if (loading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>;

  const visibleCount = sections.filter((s) => s.visible).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-3xl font-bold text-gray-900">메인 배치</h1>
          <p className="text-sm text-gray-500">
            메인 페이지 섹션의 순서와 노출 여부를 설정합니다. (PC·모바일 공통)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {toast && <span className="text-sm font-medium text-green-600">{toast}</span>}
          {dirty && !toast && <span className="text-sm text-amber-600">저장되지 않은 변경</span>}
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-2xl">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            섹션 순서 <span className="text-slate-400 font-normal">({visibleCount}/{sections.length} 노출)</span>
          </h2>
          <span className="text-xs text-slate-400">드래그 또는 ▲▼ 로 순서 변경</span>
        </div>

        <ul className="divide-y divide-slate-100">
          {sections.map((s, i) => {
            const meta = META[s.key];
            return (
              <li
                key={s.key}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
                onDrop={() => handleDrop(i)}
                onDragEnd={() => { setDragIndex(null); setDragOver(null); }}
                className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
                  dragOver === i && dragIndex !== i
                    ? "bg-orange-50 border-l-2 border-orange-400"
                    : "hover:bg-slate-50"
                } ${!s.visible ? "opacity-55" : ""}`}
              >
                {/* 드래그 핸들 */}
                <span className="cursor-grab active:cursor-grabbing text-slate-300 flex-shrink-0" title="드래그로 이동">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
                    <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
                    <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
                  </svg>
                </span>

                {/* 순서 번호 */}
                <span className="w-6 text-center text-xs font-bold text-slate-400 flex-shrink-0">{i + 1}</span>

                {/* 이름 + 설명 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{meta?.label ?? s.key}</p>
                  <p className="text-xs text-slate-400 truncate">{meta?.description}</p>
                </div>

                {/* 내용 편집 바로가기 */}
                {meta?.editHref && (
                  <Link
                    href={meta.editHref}
                    className="text-xs font-medium text-slate-500 border border-slate-200 px-2.5 py-1 rounded hover:bg-slate-100 transition-colors flex-shrink-0"
                  >
                    편집
                  </Link>
                )}

                {/* 순서 ▲▼ */}
                <div className="flex flex-col flex-shrink-0">
                  <button
                    onClick={() => move(i, i - 1)}
                    disabled={i === 0}
                    className="text-slate-400 hover:text-slate-800 disabled:opacity-25 disabled:hover:text-slate-400"
                    title="위로"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button
                    onClick={() => move(i, i + 1)}
                    disabled={i === sections.length - 1}
                    className="text-slate-400 hover:text-slate-800 disabled:opacity-25 disabled:hover:text-slate-400"
                    title="아래로"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>

                {/* 노출 토글 */}
                <button
                  onClick={() => toggle(s.key)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${s.visible ? "bg-blue-600" : "bg-slate-300"}`}
                  title={s.visible ? "노출 중 (클릭하면 숨김)" : "숨김 (클릭하면 노출)"}
                  aria-pressed={s.visible}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${s.visible ? "translate-x-5" : ""}`} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-4 text-xs text-slate-400 max-w-2xl space-y-1">
        <p>· 각 섹션의 <b className="text-slate-500">내용</b>은 “편집” 버튼이나 해당 메뉴에서 수정합니다. 이 페이지는 순서·노출만 담당합니다.</p>
        <p>· 저장하면 메인 페이지에 즉시 반영됩니다. (팝업 배너는 화면 위 오버레이라 배치 대상이 아닙니다.)</p>
      </div>
    </div>
  );
}
