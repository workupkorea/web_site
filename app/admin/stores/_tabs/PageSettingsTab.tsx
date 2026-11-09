"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { DEFAULT_STORE_PAGE, normalizeStorePage, type StorePageConfig } from "@/lib/store-page";

export default function PageSettingsTab() {
  const [cfg, setCfg] = useState<StorePageConfig>(DEFAULT_STORE_PAGE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetch("/api/admin/site-settings/store_page")
      .then((r) => r.json())
      .then((d) => setCfg(normalizeStorePage(d)))
      .catch(() => setCfg(DEFAULT_STORE_PAGE))
      .finally(() => setLoading(false));
  }, []);

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2500); };
  const set = <K extends keyof StorePageConfig>(k: K, v: StorePageConfig[K]) => setCfg((p) => ({ ...p, [k]: v }));

  const setBullet = (i: number, v: string) =>
    setCfg((p) => ({ ...p, bullets: p.bullets.map((b, idx) => (idx === i ? v : b)) }));
  const addBullet = () => setCfg((p) => ({ ...p, bullets: [...p.bullets, ""] }));
  const removeBullet = (i: number) =>
    setCfg((p) => ({ ...p, bullets: p.bullets.filter((_, idx) => idx !== i) }));

  const save = async () => {
    setSaving(true);
    try {
      const clean = { ...cfg, bullets: cfg.bullets.map((b) => b.trim()).filter(Boolean) };
      const r = await fetch("/api/admin/site-settings/store_page", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clean),
      });
      flash(r.ok ? "저장됐습니다. /store 페이지에 바로 반영됩니다." : "저장에 실패했습니다.");
    } catch {
      flash("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
        <Link href="/admin/stores" className="hover:text-gray-900">스토어 관리</Link>
        <span>/</span>
        <span className="text-gray-900 font-semibold">상단 편집</span>
      </div>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">매장 찾기 상단 편집</h1>
          <p className="mt-1 text-sm text-gray-500">고객용 매장 찾기(/store) 페이지 맨 위의 제목·설명·안내 문구를 수정합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          {toast && <span className="text-sm font-medium text-green-600">{toast}</span>}
          <Link href="/store" target="_blank" className="px-4 py-2.5 border border-slate-200 text-slate-500 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            페이지 열기 ↗
          </Link>
          <button onClick={() => setCfg(DEFAULT_STORE_PAGE)} className="px-4 py-2.5 border border-slate-200 text-slate-500 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            기본값
          </button>
          <button onClick={save} disabled={saving} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* 편집 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">문구</p>

          <div>
            <label className="text-xs text-gray-500 block mb-1.5">제목</label>
            <input
              type="text"
              value={cfg.title}
              onChange={(e) => set("title", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1.5">
              설명 <span className="text-gray-400">— <code className="bg-gray-100 px-1 rounded">{"{count}"}</code> 는 매장 수로 자동 치환</span>
            </label>
            <textarea
              rows={3}
              value={cfg.description}
              onChange={(e) => set("description", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-gray-500">방문 안내 (체크 문구)</label>
              <button onClick={addBullet} className="text-xs font-semibold text-blue-600 hover:underline">+ 항목 추가</button>
            </div>
            <div className="space-y-2">
              {cfg.bullets.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[#E5541B] font-bold flex-shrink-0">✓</span>
                  <input
                    type="text"
                    value={b}
                    onChange={(e) => setBullet(i, e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                  <button onClick={() => removeBullet(i)} className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" aria-label="삭제">
                    ✕
                  </button>
                </div>
              ))}
              {cfg.bullets.length === 0 && <p className="text-xs text-gray-400">안내 항목이 없습니다. "+ 항목 추가"로 넣으세요.</p>}
            </div>
          </div>
        </div>

        {/* 미리보기 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">미리보기</p>
          <div className="border border-gray-100 rounded-xl bg-white px-6 py-8">
            <h2 className="text-[26px] font-bold text-[#303236] leading-tight mb-3">{cfg.title || "(제목 없음)"}</h2>
            {cfg.description && (
              <p className="text-[13px] text-gray-500 leading-relaxed mb-6 whitespace-pre-line">
                {cfg.description.replace(/\{count\}/g, "153")}
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {cfg.bullets.filter((b) => b.trim()).map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-gray-500">
                  <span className="text-[#E5541B] font-bold flex-shrink-0 mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">※ 미리보기의 매장 수(153)는 예시입니다. 실제로는 등록된 매장 수로 표시됩니다.</p>
        </div>
      </div>
    </div>
  );
}
