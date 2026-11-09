"use client";
import { useState, useEffect, useCallback } from "react";
import { mainCategories as staticMainCategories, subCategoriesByMain as staticSubByMain, type Product } from "@/data/products";
import { DEFAULT_NEW_ARRIVALS as DEFAULT, type NewArrivalsConfig } from "@/lib/new-arrivals";

// 카테고리 분류 (관리자 DB 설정과 동일한 형태)
type CatItem = { name: string; subs: string[] };
const STATIC_CATS: CatItem[] = staticMainCategories.map((name) => ({ name, subs: staticSubByMain[name] ?? [] }));

type SortBy = "latest" | "sales" | "recommended";
type Mode = "auto" | "manual";

const SECTION = "new_arrivals";

export default function AdminNewArrivalsPage() {
  const [cfg, setCfg] = useState<NewArrivalsConfig>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [searchQ, setSearchQ] = useState("");
  const [dbMissing, setDbMissing] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<CatItem[]>(STATIC_CATS);

  const flash = (text: string, type = "ok") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, productsRes, catsRes] = await Promise.all([
        fetch(`/api/admin/site-settings/${SECTION}`),
        fetch("/api/products"),
        fetch("/api/admin/site-settings/categories"),
      ]);
      if (!settingsRes.ok) { setDbMissing(true); setLoading(false); return; }
      const data = await settingsRes.json();
      if (data) setCfg({ ...DEFAULT, ...data });
      const prods = await productsRes.json();
      if (Array.isArray(prods)) setAllProducts(prods);
      const catsData = catsRes.ok ? await catsRes.json() : null;
      if (catsData?.categories && Array.isArray(catsData.categories) && catsData.categories.length > 0) {
        setCats(catsData.categories as CatItem[]);
      }
    } catch {
      setDbMissing(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof NewArrivalsConfig>(key: K, value: NewArrivalsConfig[K]) => {
    setCfg((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/admin/site-settings/${SECTION}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
    setSaving(false);
    if (res.ok) flash("저장됐습니다.");
    else {
      const err = await res.json();
      flash(err.error ?? "저장 실패", "err");
    }
  };

  // 수동 선택용 상품 검색
  const searchResults = searchQ.length >= 1
    ? allProducts
        .filter((p) =>
          p.name.includes(searchQ) ||
          p.id.includes(searchQ) ||
          (p.tagline ?? "").includes(searchQ)
        )
        .slice(0, 8)
    : [];

  const addManual = (id: string) => {
    if (cfg.manual_ids.includes(id)) return;
    set("manual_ids", [...cfg.manual_ids, id]);
    setSearchQ("");
  };

  const removeManual = (id: string) => {
    set("manual_ids", cfg.manual_ids.filter((x) => x !== id));
  };

  const moveManual = (idx: number, dir: -1 | 1) => {
    const arr = [...cfg.manual_ids];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    set("manual_ids", arr);
  };

  const manualProducts = cfg.manual_ids.map((id) => allProducts.find((p) => p.id === id)).filter(Boolean);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-gray-400">
        <span className="w-4 h-4 border-2 border-[#E5541B] border-t-transparent rounded-full animate-spin" />
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">신상품 영역</h1>
          <p className="text-base text-gray-400 mt-1">메인 신상품 캐러셀 섹션 설정</p>
        </div>
        <div className="flex items-center gap-3">
          {/* 섹션 노출 토글 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => set("is_visible", !cfg.is_visible)}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${cfg.is_visible ? "bg-[#303236]" : "bg-gray-300"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${cfg.is_visible ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm text-gray-600">{cfg.is_visible ? "노출 중" : "숨김"}</span>
          </label>
        </div>
      </div>

      {/* DB 미설정 안내 */}
      {dbMissing && (
        <div className="p-5 bg-amber-50 border border-amber-200">
          <p className="text-sm font-semibold text-amber-800 mb-2">⚠ site_settings 테이블이 필요합니다.</p>
          <p className="text-xs text-amber-700 mb-3">Supabase 대시보드 → SQL Editor에서 실행하세요:</p>
          <pre className="text-xs bg-white p-3 border border-amber-200 overflow-x-auto text-gray-700 leading-relaxed">{`CREATE TABLE IF NOT EXISTS site_settings (
  section TEXT PRIMARY KEY,
  config JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON site_settings;
CREATE POLICY "public_read" ON site_settings FOR SELECT USING (true);`}</pre>
        </div>
      )}

      {/* 피드백 */}
      {msg.text && (
        <div className={`px-4 py-3 text-sm border ${msg.type === "err" ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"}`}>
          {msg.text}
        </div>
      )}

      {/* ── 섹션 제목 ── */}
      <Section title="섹션 제목">
        <input
          type="text"
          value={cfg.title}
          onChange={(e) => set("title", e.target.value)}
          className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#303236]"
          placeholder="신상품이 입고 되었어요"
        />
      </Section>

      {/* ── 노출 모드 ── */}
      <Section title="노출 모드">
        <div className="flex gap-3">
          {(["auto", "manual"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => set("mode", m)}
              className={`flex-1 py-2.5 text-sm border transition-colors ${cfg.mode === m ? "bg-[#303236] text-white border-[#303236]" : "border-gray-200 text-gray-600 hover:border-[#303236]"}`}
            >
              {m === "auto" ? "자동 (정렬기준)" : "수동 (직접선택)"}
            </button>
          ))}
        </div>
      </Section>

      {/* ── 자동 모드 설정 ── */}
      {cfg.mode === "auto" && (
        <>
          <Section title="노출 순서">
            <div className="flex gap-2">
              {(["latest", "sales", "recommended"] as SortBy[]).map((s) => (
                <button
                  key={s}
                  onClick={() => set("sort_by", s)}
                  className={`px-4 py-2 text-sm border transition-colors ${cfg.sort_by === s ? "bg-[#303236] text-white border-[#303236]" : "border-gray-200 text-gray-600 hover:border-[#303236]"}`}
                >
                  {s === "latest" ? "최신 등록순" : s === "sales" ? "판매순" : "추천순"}
                </button>
              ))}
            </div>
          </Section>

          <Section title="노출 개수" sub="7 ~ 20개">
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={7}
                max={20}
                value={cfg.count}
                onChange={(e) => set("count", Number(e.target.value))}
                className="flex-1 accent-[#303236]"
              />
              <span className="text-sm font-bold text-[#303236] w-12 text-right">{cfg.count}개</span>
            </div>
          </Section>

          <Section title="카테고리 필터">
            <div className="flex flex-wrap gap-2">
              {["전체", ...cats.map((c) => c.name)].map((cat) => (
                <button
                  key={cat}
                  onClick={() => set("category_filter", cat)}
                  className={`px-3 py-1.5 text-xs border transition-colors ${cfg.category_filter === cat ? "bg-[#303236] text-white border-[#303236]" : "border-gray-200 text-gray-600 hover:border-[#303236]"}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </Section>

          <Section title="신상품 기준 일수" sub="등록 후 N일 이내 상품을 신상품으로 표시">
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={7}
                max={365}
                value={cfg.new_product_days}
                onChange={(e) => set("new_product_days", Number(e.target.value))}
                className="w-24 border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#303236]"
              />
              <span className="text-sm text-gray-500">일 이내</span>
            </div>
          </Section>
        </>
      )}

      {/* ── 수동 모드 ── */}
      {cfg.mode === "manual" && (
        <Section title="상품 직접 선택" sub={`선택됨 ${cfg.manual_ids.length}개`}>
          {/* 검색 */}
          <div className="relative mb-3">
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="상품명 또는 ID로 검색..."
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#303236]"
            />
            {searchResults.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 border-t-0 max-h-52 overflow-y-auto">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addManual(p.id)}
                    disabled={cfg.manual_ids.includes(p.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className={`w-8 h-8 flex-shrink-0 ${p.bg} flex items-center justify-center`}>
                      {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-white/20 text-[6px]">W</span>}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#303236] truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-400">{p.price} · {p.category}</p>
                    </div>
                    {cfg.manual_ids.includes(p.id) && <span className="ml-auto text-[10px] text-green-600 flex-shrink-0">추가됨</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 선택된 상품 목록 */}
          {manualProducts.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center border border-dashed border-gray-200">상품을 검색해서 추가하세요</p>
          ) : (
            <div className="border border-gray-200 divide-y divide-gray-100">
              {manualProducts.map((p, i) => p && (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                  <div className={`w-8 h-8 flex-shrink-0 ${p.bg} flex items-center justify-center`}>
                    {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-white/20 text-[6px]">W</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#303236] truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-400">{p.price}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => moveManual(i, -1)} disabled={i === 0} className="p-1 text-gray-400 hover:text-[#303236] disabled:opacity-30">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button onClick={() => moveManual(i, 1)} disabled={i === manualProducts.length - 1} className="p-1 text-gray-400 hover:text-[#303236] disabled:opacity-30">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <button onClick={() => removeManual(p.id)} className="p-1 text-red-400 hover:text-red-600 ml-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── 추가 설정 ── */}
      <Section title="추가 설정">
        <div className="space-y-3">
          <Toggle label="품절 상품 자동 숨김" sub="재고 없는 상품을 자동으로 제외" checked={cfg.hide_sold_out} onChange={(v) => set("hide_sold_out", v)} />
          <Toggle label="할인 뱃지 표시" sub="할인 중인 상품에 배지 노출" checked={cfg.show_discount_badge} onChange={(v) => set("show_discount_badge", v)} />
          <Toggle label="카테고리 탭 표시" sub="전체 / 카테고리별 필터 탭" checked={cfg.show_category_tabs} onChange={(v) => set("show_category_tabs", v)} />
        </div>
      </Section>

      {/* ── 전체보기 링크 ── */}
      <Section title="전체보기 버튼 링크">
        <input
          type="text"
          value={cfg.view_all_link}
          onChange={(e) => set("view_all_link", e.target.value)}
          className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#303236]"
          placeholder="/products?new=true"
        />
      </Section>

      {/* 저장 */}
      <div className="pt-2 border-t border-gray-100">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-2.5 bg-[#303236] text-white text-sm font-semibold hover:bg-[#243d5e] transition-colors disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}

// ── 서브 컴포넌트 ──

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <p className="text-sm font-semibold text-[#303236]">{title}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-2.5 border-b border-gray-100 cursor-pointer group">
      <div>
        <p className="text-sm text-gray-700 group-hover:text-[#303236]">{label}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? "bg-[#303236]" : "bg-gray-300"}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </div>
    </label>
  );
}
