"use client";
import { useState, useEffect, Fragment } from "react";
import { Oxanium } from "next/font/google";
import TopbarIcon from "@/components/TopbarIcon";
import {
  DEFAULT_TOPBAR,
  ICON_OPTIONS,
  normalizeTopbar,
  type TopbarConfig,
  type TopbarItem,
  type TopbarIconName,
} from "@/lib/topbar";

const oxanium = Oxanium({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

const COLOR_PRESETS = ["#E5541B", "#303236", "#0f172a", "#111827", "#2d4f72", "#16a34a", "#dc2626", "#ffffff"];

function uid() {
  return (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `item-${Math.random().toString(36).slice(2)}`;
}

// ── 아이콘 선택 ──
function IconSelect({ value, onChange }: { value: TopbarIconName; onChange: (v: TopbarIconName) => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center bg-slate-50 flex-shrink-0 text-slate-600">
        {value === "none" ? <span className="text-[9px] text-gray-300">없음</span> : <TopbarIcon name={value} className="w-4 h-4" />}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TopbarIconName)}
        className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:border-blue-400"
      >
        {ICON_OPTIONS.map((o) => (
          <option key={o.name} value={o.name}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── 색상 입력(색상 피커 + hex + 프리셋) ──
function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-10 h-9 rounded border border-gray-200 cursor-pointer p-0.5 flex-shrink-0" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400" />
        <div className="flex gap-1">
          {COLOR_PRESETS.map((c) => (
            <button key={c} type="button" title={c} onClick={() => onChange(c)}
              className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

const FONT_WEIGHT_OPTIONS = [
  { value: 400, label: "보통 (400)" },
  { value: 500, label: "중간 (500)" },
  { value: 600, label: "세미볼드 (600)" },
  { value: 700, label: "볼드 (700)" },
  { value: 800, label: "굵게 (800)" },
];

// ── 미리보기 바 ──
function TopbarPreview({ cfg, narrow }: { cfg: TopbarConfig; narrow?: boolean }) {
  const iconPx = Math.max(11, Math.round(cfg.height * 0.4));
  const textStyle = { fontSize: cfg.font_size, fontWeight: cfg.font_weight, letterSpacing: `${cfg.letter_spacing}em` };
  return (
    <div className="flex items-center w-full overflow-hidden" style={{ height: cfg.height, backgroundColor: cfg.bg_color, color: cfg.text_color }}>
      <div className={`${narrow ? "px-3" : "px-6"} w-full flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-1.5 min-w-0">
          {cfg.left_icon !== "none" && <TopbarIcon name={cfg.left_icon} style={{ width: iconPx, height: iconPx }} className="flex-shrink-0" />}
          <span className={`${oxanium.className} whitespace-nowrap truncate`} style={textStyle}>
            {cfg.left_text || "(좌측 문구)"}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {cfg.items.map((it, idx) => (
            <Fragment key={it.id}>
              {idx > 0 && <span className="text-[10px] opacity-40">|</span>}
              <span className="flex items-center gap-1 whitespace-nowrap" style={textStyle}>
                {it.icon !== "none" && <TopbarIcon name={it.icon} style={{ width: iconPx, height: iconPx }} />}
                {it.label || "(텍스트)"}
              </span>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TopbarManagePage() {
  const [cfg, setCfg] = useState<TopbarConfig>(DEFAULT_TOPBAR);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  // 마지막으로 서버에 저장된 설정 — ON/OFF 스위치는 이 값에 enabled만 바꿔 즉시 저장한다(편집 중인 미저장 내용은 섞지 않음)
  const [savedCfg, setSavedCfg] = useState<TopbarConfig>(DEFAULT_TOPBAR);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetch("/api/admin/site-settings/topbar")
      .then((r) => r.json())
      .then((data) => { const c = normalizeTopbar(data); setCfg(c); setSavedCfg(c); })
      .catch(() => setCfg(DEFAULT_TOPBAR))
      .finally(() => setLoading(false));
  }, []);

  const flash = (text: string) => { setToast(text); setTimeout(() => setToast(""), 2500); };
  const set = <K extends keyof TopbarConfig>(key: K, val: TopbarConfig[K]) => setCfg((p) => ({ ...p, [key]: val }));

  const updateItem = (id: string, patch: Partial<TopbarItem>) =>
    setCfg((p) => ({ ...p, items: p.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  const removeItem = (id: string) => setCfg((p) => ({ ...p, items: p.items.filter((it) => it.id !== id) }));
  const addItem = () =>
    setCfg((p) => ({ ...p, items: [...p.items, { id: uid(), label: "새 링크", href: "/", icon: "none", newTab: false }] }));
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
      const r = await fetch("/api/admin/site-settings/topbar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      if (r.ok) setSavedCfg(cfg);
      flash(r.ok ? "저장됐습니다. 사이트에 바로 반영됩니다." : "저장에 실패했습니다.");
    } catch {
      flash("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // 탑바 ON/OFF — 누르는 즉시 사이트에 반영
  const toggleEnabled = async () => {
    const enabled = !cfg.enabled;
    setToggling(true);
    try {
      const next = { ...savedCfg, enabled };
      const r = await fetch("/api/admin/site-settings/topbar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!r.ok) { flash("변경에 실패했습니다."); return; }
      setSavedCfg(next);
      set("enabled", enabled);
      flash(enabled ? "탑바를 켰습니다." : "탑바를 껐습니다.");
    } catch {
      flash("변경에 실패했습니다.");
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>;

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">상단 탑바 관리</h1>
          <p className="mt-1 text-sm text-gray-500">사이트 최상단 띠 배너의 높이·색상·문구·아이콘·링크를 관리합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          {toast && <span className="text-sm font-medium text-green-600">{toast}</span>}
          {/* ON/OFF 스위치 — 저장 버튼 없이 즉시 반영 */}
          <button type="button" role="switch" aria-checked={cfg.enabled} aria-label="탑바 표시"
            onClick={toggleEnabled} disabled={toggling}
            title={cfg.enabled ? "누르면 탑바를 끕니다 (즉시 반영)" : "누르면 탑바를 켭니다 (즉시 반영)"}
            className={`flex items-center gap-2.5 pl-3 pr-2 min-h-[44px] rounded-lg border text-sm font-semibold transition-colors disabled:opacity-50 ${cfg.enabled ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
            탑바 {cfg.enabled ? "ON" : "OFF"}
            <span className={`relative inline-flex items-center rounded-full transition-colors ${cfg.enabled ? "bg-blue-600" : "bg-slate-300"}`} style={{ width: 40, height: 22 }}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${cfg.enabled ? "translate-x-[21px]" : "translate-x-[3px]"}`} />
            </span>
          </button>
          <button onClick={() => setCfg((p) => ({ ...DEFAULT_TOPBAR, enabled: p.enabled }))}
            className="px-4 py-2.5 border border-slate-200 text-slate-500 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            기본값
          </button>
          <button onClick={save} disabled={saving}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      {/* 미리보기 (상단 고정) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">미리보기</p>
          {!cfg.enabled && <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded">탑바 꺼짐 — 사이트에 표시되지 않고 헤더가 맨 위로 붙습니다</span>}
        </div>
        <div className={cfg.enabled ? "" : "opacity-40"}>
          <p className="text-[11px] text-gray-400 mb-1.5">PC <span className="text-slate-400">({cfg.height}px · {cfg.font_size}px)</span></p>
          <div className="rounded-lg overflow-hidden border border-gray-100 shadow-sm"><TopbarPreview cfg={cfg} /></div>
          <p className="text-[11px] text-gray-400 mt-4 mb-1.5">모바일 <span className="text-slate-400">({cfg.mobile_height}px · {cfg.mobile_font_size}px)</span></p>
          <div className="rounded-lg overflow-hidden border border-gray-100 shadow-sm mx-auto" style={{ maxWidth: 380 }}>
            <TopbarPreview cfg={{ ...cfg, height: cfg.mobile_height, font_size: cfg.mobile_font_size }} narrow />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* 왼쪽: 기본/디자인 */}
        <div className="space-y-6">
          {/* 표시 + 크기 (PC / 모바일 분리) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">표시 · 크기</p>

            {/* 높이 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-700">PC 높이</label>
                  <span className="text-sm font-mono text-slate-500">{cfg.height}px</span>
                </div>
                <input type="range" min={40} max={80} value={cfg.height}
                  onChange={(e) => set("height", Number(e.target.value))}
                  className="w-full accent-blue-600 h-1.5" />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>40px</span><span>80px</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-700">모바일 높이</label>
                  <span className="text-sm font-mono text-slate-500">{cfg.mobile_height}px</span>
                </div>
                <input type="range" min={28} max={56} value={cfg.mobile_height}
                  onChange={(e) => set("mobile_height", Number(e.target.value))}
                  className="w-full accent-blue-600 h-1.5" />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>28px</span><span>56px</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 -mt-2">높이를 바꾸면 헤더 위치와 카탈로그 뷰어 높이가 자동으로 따라갑니다.</p>
          </div>

          {/* 색상 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">색상</p>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">배경색</label>
              <ColorInput value={cfg.bg_color} onChange={(v) => set("bg_color", v)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">글자 · 아이콘 색</label>
              <ColorInput value={cfg.text_color} onChange={(v) => set("text_color", v)} />
            </div>
          </div>

          {/* 텍스트 스타일 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">텍스트</p>

            {/* 글자 크기 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-700">PC 글자 크기</label>
                  <span className="text-sm font-mono text-slate-500">{cfg.font_size}px</span>
                </div>
                <input type="range" min={9} max={24} value={cfg.font_size}
                  onChange={(e) => set("font_size", Number(e.target.value))}
                  className="w-full accent-blue-600 h-1.5" />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>9px</span><span>24px</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-700">모바일 글자 크기</label>
                  <span className="text-sm font-mono text-slate-500">{cfg.mobile_font_size}px</span>
                </div>
                <input type="range" min={8} max={14} value={cfg.mobile_font_size}
                  onChange={(e) => set("mobile_font_size", Number(e.target.value))}
                  className="w-full accent-blue-600 h-1.5" />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>8px</span><span>14px</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">굵기</label>
              <div className="flex flex-wrap gap-1.5">
                {FONT_WEIGHT_OPTIONS.map((o) => (
                  <button key={o.value} type="button"
                    onClick={() => set("font_weight", o.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors border ${cfg.font_weight === o.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"}`}
                    style={{ fontWeight: o.value }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">자간 (Letter Spacing)</label>
                <span className="text-sm font-mono text-slate-500">{cfg.letter_spacing.toFixed(2)}em</span>
              </div>
              <input type="range" min={0} max={0.5} step={0.01} value={cfg.letter_spacing}
                onChange={(e) => set("letter_spacing", parseFloat(e.target.value))}
                className="w-full accent-blue-600 h-1.5" />
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                <span>0em (좁게)</span><span>0.5em (넓게)</span>
              </div>
            </div>
          </div>

          {/* 좌측 문구 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">좌측 문구</p>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">문구</label>
              <input type="text" value={cfg.left_text} onChange={(e) => set("left_text", e.target.value)}
                placeholder="EVERY WORKER EVERY WEAR"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">아이콘</label>
                <IconSelect value={cfg.left_icon} onChange={(v) => set("left_icon", v)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">링크 (선택)</label>
                <input type="text" value={cfg.left_link} onChange={(e) => set("left_link", e.target.value)}
                  placeholder="/ (비우면 링크 없음)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽: 우측 링크들 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">우측 링크 ({cfg.items.length})</p>
            <button onClick={addItem}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-700 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              링크 추가
            </button>
          </div>

          {cfg.items.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">우측 링크가 없습니다. ‘링크 추가’로 만들어 보세요.</div>
          ) : (
            <div className="space-y-3">
              {cfg.items.map((it, i) => (
                <div key={it.id} className="border border-slate-200 rounded-xl p-3.5 space-y-3 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-400">#{i + 1}</span>
                    <div className="flex items-center gap-1">
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
                      <label className="text-[11px] text-gray-500 block mb-1">텍스트</label>
                      <input type="text" value={it.label} onChange={(e) => updateItem(it.id, { label: e.target.value })}
                        placeholder="카탈로그"
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500 block mb-1">아이콘</label>
                      <IconSelect value={it.icon} onChange={(v) => updateItem(it.id, { icon: v })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-1">링크</label>
                    <input type="text" value={it.href} onChange={(e) => updateItem(it.id, { href: e.target.value })}
                      placeholder="/catalog · tel:0212345678 · https://..."
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white" />
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
            전화 연결은 <span className="font-mono">tel:0212345678</span>, 카카오/외부는 <span className="font-mono">https://…</span> 형태로 입력하세요. 내부 페이지는 <span className="font-mono">/catalog</span> 처럼 / 로 시작합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
