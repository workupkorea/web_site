"use client";
import { useState, useEffect, useRef } from "react";
import { DEFAULT_LOGO, normalizeLogo, type LogoConfig } from "@/lib/logo";

export default function LogoManagePage() {
  const [cfg, setCfg] = useState<LogoConfig>(DEFAULT_LOGO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/site-settings/logo")
      .then((r) => r.json())
      .then((data) => setCfg(normalizeLogo(data)))
      .catch(() => setCfg(DEFAULT_LOGO))
      .finally(() => setLoading(false));
  }, []);

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2500); };
  const set = <K extends keyof LogoConfig>(k: K, v: LogoConfig[K]) => setCfg((p) => ({ ...p, [k]: v }));

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (r.ok) { const { url } = await r.json(); set("src", url); flash("업로드 완료. ‘저장’을 눌러 반영하세요."); }
      else flash("이미지 업로드 실패");
    } catch { flash("이미지 업로드 실패"); }
    finally { setUploading(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/site-settings/logo", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg),
      });
      flash(r.ok ? "저장됐습니다. 사이트에 바로 반영됩니다." : "저장에 실패했습니다.");
    } catch { flash("저장에 실패했습니다."); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>;

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">로고 관리</h1>
          <p className="mt-1 text-sm text-gray-500">헤더·푸터에 표시되는 사이트 로고 이미지를 교체합니다. (권장: 투명 배경 PNG)</p>
        </div>
        <div className="flex items-center gap-3">
          {toast && <span className="text-sm font-medium text-green-600">{toast}</span>}
          <button onClick={() => setCfg(DEFAULT_LOGO)}
            className="px-4 py-2.5 border border-slate-200 text-slate-500 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            기본 로고
          </button>
          <button onClick={save} disabled={saving}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* 왼쪽: 업로드 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">로고 이미지</p>

          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed border-slate-200 rounded-xl py-10 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors disabled:opacity-50"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium">{uploading ? "업로드 중..." : "클릭하여 로고 이미지 업로드"}</span>
            <span className="text-[11px] text-slate-400">PNG · JPG · SVG · 10MB 이하</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />

          <div>
            <label className="text-xs text-gray-500 block mb-1.5">이미지 경로 (직접 입력 가능)</label>
            <input type="text" value={cfg.src} onChange={(e) => set("src", e.target.value)}
              placeholder="/images/logo_black.png 또는 https://..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400" />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1.5">대체 텍스트 (alt · 접근성/SEO)</label>
            <input type="text" value={cfg.alt} onChange={(e) => set("alt", e.target.value)}
              placeholder="WORKUP"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          </div>
        </div>

        {/* 오른쪽: 미리보기 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">미리보기</p>
          {/* 밝은 배경(헤더) */}
          <div>
            <p className="text-[11px] text-gray-400 mb-1.5">밝은 배경 (헤더)</p>
            <div className="border border-gray-100 rounded-lg bg-white px-5 py-4 flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cfg.src} alt={cfg.alt} className="h-[18px] w-auto" />
            </div>
          </div>
          {/* 어두운 배경 — 검정 로고는 안 보일 수 있음 안내 */}
          <div>
            <p className="text-[11px] text-gray-400 mb-1.5">어두운 배경 (참고)</p>
            <div className="border border-gray-100 rounded-lg bg-[#303236] px-5 py-4 flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cfg.src} alt={cfg.alt} className="h-[18px] w-auto" />
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">※ 검정 로고는 어두운 배경에서 보이지 않을 수 있습니다. 헤더는 흰 배경입니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
