"use client";
import { useState, useEffect } from "react";
import { Oxanium } from "next/font/google";
import {
  DEFAULT_HEADER_NAV,
  normalizeHeaderNav,
  type HeaderNavConfig,
  type NavMenuItem,
} from "@/lib/header-nav";

const oxanium = Oxanium({ subsets: ["latin"], weight: ["600"] });

function uid() {
  return (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `nav-${Math.random().toString(36).slice(2)}`;
}

// ── PC 헤더 미리보기 (가로 메뉴) ──
function DesktopPreview({ items }: { items: NavMenuItem[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-5 py-3 flex items-center gap-6 overflow-x-auto">
      <span className="text-[15px] font-black tracking-tight text-[#303236] flex-shrink-0">WORKUP</span>
      <div className="flex items-center gap-5">
        {items.length === 0 ? (
          <span className="text-xs text-gray-300">메뉴 없음</span>
        ) : (
          items.filter((it) => it.isVisible !== false).map((it) => (
            // 실제 PC 헤더와 동일: 한글 메뉴명만 표시, 없으면 영문으로 폴백
            it.labelKo ? (
              <span key={it.id} className="text-[13px] text-[#303236] whitespace-nowrap" style={{ fontWeight: 700 }}>
                {it.labelKo}
              </span>
            ) : (
              <span key={it.id} className={`${oxanium.className} text-[14px] text-[#303236] whitespace-nowrap`} style={{ fontWeight: 650 }}>
                {it.label || "(빈 메뉴)"}
              </span>
            )
          ))
        )}
      </div>
    </div>
  );
}

// ── 모바일 메뉴 시트 미리보기 (세로 리스트) ──
function MobilePreview({ items }: { items: NavMenuItem[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden" style={{ maxWidth: 300 }}>
      <div className="flex justify-center pt-3 pb-1.5"><div className="w-9 h-1 bg-gray-300 rounded-full" /></div>
      <div className="px-5 py-2 border-b border-gray-100">
        <span className="text-[11px] font-bold text-[#303236] tracking-[0.2em]">MENU</span>
      </div>
      <div className="px-5 pb-3">
        {items.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-300">메뉴 없음</div>
        ) : (
          items.filter((it) => it.isVisible !== false).map((it) => (
            <div key={it.id} className="flex items-center justify-between py-3 text-[13px] font-semibold text-[#303236] tracking-[0.15em] border-b border-gray-100 last:border-0">
              <span className="flex items-baseline gap-2">
                <span>{it.label || "(빈 메뉴)"}</span>
                {it.labelKo && <span className="text-[11px] font-normal tracking-normal text-gray-400">/ {it.labelKo}</span>}
              </span>
              <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
              </svg>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function HeaderMenuManagePage() {
  const [cfg, setCfg] = useState<HeaderNavConfig>(DEFAULT_HEADER_NAV);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetch("/api/admin/site-settings/header-nav")
      .then((r) => r.json())
      .then((data) => setCfg(normalizeHeaderNav(data)))
      .catch(() => setCfg(DEFAULT_HEADER_NAV))
      .finally(() => setLoading(false));
  }, []);

  const flash = (text: string) => { setToast(text); setTimeout(() => setToast(""), 2500); };

  const updateItem = (id: string, patch: Partial<NavMenuItem>) =>
    setCfg((p) => ({ ...p, items: p.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  const removeItem = (id: string) =>
    setCfg((p) => ({ ...p, items: p.items.filter((it) => it.id !== id) }));
  const addItem = () =>
    setCfg((p) => ({ ...p, items: [...p.items, { id: uid(), label: "새 메뉴", href: "/", newTab: false, isVisible: true }] }));
  const moveItem = (id: string, dir: -1 | 1) =>
    setCfg((p) => {
      const i = p.items.findIndex((it) => it.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.items.length) return p;
      const next = [...p.items];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...p, items: next };
    });

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/site-settings/header-nav", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      flash(r.ok ? "저장됐습니다. 사이트에 바로 반영됩니다." : "저장에 실패했습니다.");
    } catch {
      flash("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>;

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">헤더 메뉴 관리</h1>
          <p className="mt-1 text-sm text-gray-500">탑바 아래 헤더 내비게이션(PC 가로 메뉴 · 모바일 메뉴 시트)의 항목·순서·링크를 관리합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          {toast && <span className="text-sm font-medium text-green-600">{toast}</span>}
          <button onClick={() => setCfg(DEFAULT_HEADER_NAV)}
            className="px-4 py-2.5 border border-slate-200 text-slate-500 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            기본값
          </button>
          <button onClick={save} disabled={saving}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      {/* 본문: 좌(미리보기) + 우(항목 편집) */}
      <div className="flex gap-6 items-start">

        {/* 좌: 미리보기 */}
        <div className="w-[380px] flex-shrink-0 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">미리보기</p>
            <div>
              <p className="text-[11px] text-gray-400 mb-1.5">PC 헤더</p>
              <DesktopPreview items={cfg.items} />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 mb-1.5">모바일 메뉴 시트</p>
              <MobilePreview items={cfg.items} />
            </div>
          </div>
        </div>

        {/* 우: 메뉴 항목 편집 */}
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">메뉴 항목 ({cfg.items.length})</p>
          <button onClick={addItem}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-700 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            메뉴 추가
          </button>
        </div>

        {cfg.items.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">메뉴가 없습니다. ‘메뉴 추가’로 만들어 보세요.</div>
        ) : (
          <div className="space-y-3">
            {cfg.items.map((it, i) => (
              <div key={it.id} className={`border border-slate-200 rounded-xl p-3.5 space-y-3 bg-slate-50/50 ${it.isVisible === false ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-400">#{i + 1}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full flex-shrink-0 ${it.isVisible !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {it.isVisible !== false ? "노출" : "숨김"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateItem(it.id, { isVisible: it.isVisible === false })}
                      title={it.isVisible !== false ? "숨기기" : "노출하기"}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors mr-1 ${it.isVisible !== false ? "bg-[#303236]" : "bg-gray-300"}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${it.isVisible !== false ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                    <button onClick={() => moveItem(it.id, -1)} disabled={i === 0} title="위로"
                      className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-30">↑</button>
                    <button onClick={() => moveItem(it.id, 1)} disabled={i === cfg.items.length - 1} title="아래로"
                      className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-30">↓</button>
                    <button onClick={() => removeItem(it.id)} title="삭제"
                      className="w-6 h-6 flex items-center justify-center rounded border border-red-200 text-red-400 hover:bg-red-50">✕</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-1">메뉴 텍스트 (영문 · 모바일 메뉴)</label>
                    <input type="text" value={it.label} onChange={(e) => updateItem(it.id, { label: e.target.value })}
                      placeholder="PRODUCTS"
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-1">한글 메뉴명 (PC 표시 · 모바일 병기)</label>
                    <input type="text" value={it.labelKo ?? ""} onChange={(e) => updateItem(it.id, { labelKo: e.target.value })}
                      placeholder="전체 제품"
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-1">링크</label>
                    <input type="text" value={it.href} onChange={(e) => updateItem(it.id, { href: e.target.value })}
                      placeholder="/products · https://..."
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={!!it.newTab} onChange={(e) => updateItem(it.id, { newTab: e.target.checked })} className="w-3.5 h-3.5 accent-blue-600" />
                  <span className="text-xs text-gray-600">새 탭으로 열기</span>
                </label>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-gray-400 leading-relaxed">
          내부 페이지는 <span className="font-mono">/products</span> 처럼 / 로 시작하고, 외부 링크는 <span className="font-mono">https://…</span> 형태로 입력하세요.
          메뉴를 모두 삭제하면 사이트에는 기본 메뉴가 표시됩니다.
        </p>
        </div>{/* 우 끝 */}
      </div>{/* 2열 끝 */}
    </div>
  );
}
