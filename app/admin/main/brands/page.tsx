"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { DEFAULT_BRAND_MARQUEE_CONFIG, type BrandMarqueeConfig } from "@/lib/brand-marquee";

const SECTION = "brand_marquee";

type BrandRow = { id: string | number; name: string; logo_url?: string | null; is_visible?: boolean };

export default function AdminBrandMarqueePage() {
  const [cfg, setCfg] = useState<BrandMarqueeConfig>(DEFAULT_BRAND_MARQUEE_CONFIG);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dbMissing, setDbMissing] = useState(false);
  const [msg, setMsg] = useState("");

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 2500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, brandsRes] = await Promise.all([
        fetch(`/api/admin/site-settings/${SECTION}`),
        fetch("/api/admin/brands"),
      ]);
      if (!settingsRes.ok) { setDbMissing(true); setLoading(false); return; }
      const data = await settingsRes.json();
      if (data) setCfg({ ...DEFAULT_BRAND_MARQUEE_CONFIG, ...data });
      const brandsData = brandsRes.ok ? await brandsRes.json() : [];
      if (Array.isArray(brandsData)) setBrands(brandsData);
    } catch {
      setDbMissing(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/site-settings/${SECTION}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      flash(res.ok ? "저장됐습니다." : "저장에 실패했습니다.");
    } catch {
      flash("저장에 실패했습니다.");
    }
    setSaving(false);
  };

  const byId = new Map(brands.map((b) => [String(b.id), b]));
  const included = cfg.brandIds.map((id) => byId.get(String(id))).filter((b): b is BrandRow => !!b);
  const includedIds = new Set(cfg.brandIds.map(String));
  const selectable = brands.filter((b) => !!b.logo_url && !includedIds.has(String(b.id)));
  const noLogoCount = brands.filter((b) => !b.logo_url && !includedIds.has(String(b.id))).length;

  const addBrand = (id: string | number) => {
    setCfg((prev) => ({ ...prev, brandIds: [...prev.brandIds, String(id)] }));
  };
  const removeBrand = (id: string) => {
    setCfg((prev) => ({ ...prev, brandIds: prev.brandIds.filter((b) => b !== id) }));
  };
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= cfg.brandIds.length) return;
    const next = [...cfg.brandIds];
    [next[index], next[target]] = [next[target], next[index]];
    setCfg((prev) => ({ ...prev, brandIds: next }));
  };

  if (loading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>;

  if (dbMissing) {
    return (
      <div className="p-6 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg max-w-xl">
        저장 기능을 사용하려면 <code className="bg-amber-100 px-1 rounded">site_settings</code> 테이블이 필요합니다.
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">브랜드 로고 영역</h1>
          <p className="mt-1 text-sm text-gray-500">
            매장검색 바로 아래, 브랜드 로고가 무한 마퀴로 흐르는 영역입니다. 여기서는 어떤 브랜드를 어떤 순서로 보여줄지만 정합니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-sm font-medium text-green-600">{msg}</span>}
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
        <label className="block text-sm font-semibold text-slate-700 mb-2">섹션 제목</label>
        <input
          type="text"
          value={cfg.title}
          onChange={(e) => setCfg((prev) => ({ ...prev, title: e.target.value }))}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          placeholder="워크업에서 만나는 브랜드"
        />
      </div>

      <div className="mb-4 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
        브랜드명·로고 이미지 자체는 <Link href="/admin/catalog/brands" className="text-blue-600 hover:underline font-medium">브랜드 관리</Link>에서 등록·수정합니다.
        로고가 없는 브랜드는 아래 목록에 나타나지 않습니다{noLogoCount > 0 ? ` (로고 없음 ${noLogoCount}개 제외됨)` : ""}.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 노출 중 (순서 조정) */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">마퀴에 노출 중 ({included.length})</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {included.length === 0 && (
              <li className="px-4 py-6 text-xs text-slate-400 text-center">오른쪽에서 브랜드를 추가하세요.</li>
            )}
            {included.map((b, i) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.logo_url ?? ""} alt="" className="h-8 w-8 object-contain flex-shrink-0 bg-slate-50 rounded" />
                <span className="flex-1 min-w-0 text-sm text-slate-800 truncate">{b.name}</span>
                <div className="flex flex-col flex-shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-800 disabled:opacity-25" title="위로">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === included.length - 1} className="text-slate-400 hover:text-slate-800 disabled:opacity-25" title="아래로">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
                <button onClick={() => removeBrand(String(b.id))} className="text-slate-300 hover:text-red-500 flex-shrink-0 text-lg leading-none px-1" title="제외">×</button>
              </li>
            ))}
          </ul>
        </div>

        {/* 추가 가능 목록 */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">추가 가능 ({selectable.length})</h2>
          </div>
          <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            {selectable.length === 0 && (
              <li className="px-4 py-6 text-xs text-slate-400 text-center">추가할 수 있는 브랜드가 없습니다.</li>
            )}
            {selectable.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.logo_url ?? ""} alt="" className="h-8 w-8 object-contain flex-shrink-0 bg-slate-50 rounded" />
                <span className="flex-1 min-w-0 text-sm text-slate-800 truncate">{b.name}</span>
                <button
                  onClick={() => addBrand(b.id)}
                  className="text-xs font-medium text-blue-600 border border-blue-200 px-2.5 py-1 rounded hover:bg-blue-50 transition-colors flex-shrink-0"
                >
                  추가
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
