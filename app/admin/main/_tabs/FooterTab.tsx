"use client";
import { useState, useEffect, useRef } from "react";
import {
  DEFAULT_FOOTER, normalizeFooter, type FooterConfig, type FooterNavLink,
  type FooterSocialLink, FOOTER_SOCIAL_PLATFORMS,
  DEFAULT_SUPPORT, normalizeSupport, type SupportConfig,
  DEFAULT_TERMS, DEFAULT_PRIVACY, normalizeLegal,
} from "@/lib/site-content";

type Tab = "footer" | "support" | "terms" | "privacy";

const TABS: { key: Tab; label: string }[] = [
  { key: "footer", label: "푸터" },
  { key: "support", label: "고객센터·1:1" },
  { key: "terms", label: "이용약관" },
  { key: "privacy", label: "개인정보처리방침" },
];

function Labeled({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

const INPUT = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400";

export default function FooterManagePage() {
  const [tab, setTab] = useState<Tab>("footer");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [uploading, setUploading] = useState(false);
  const [socialUploadId, setSocialUploadId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [footer, setFooter] = useState<FooterConfig>(DEFAULT_FOOTER);
  const [support, setSupport] = useState<SupportConfig>(DEFAULT_SUPPORT);
  const [terms, setTerms] = useState("");
  const [privacy, setPrivacy] = useState("");

  useEffect(() => {
    const get = (s: string) => fetch(`/api/admin/site-settings/${s}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    Promise.all([get("footer"), get("support_page"), get("terms_page"), get("privacy_page")])
      .then(([f, sp, t, p]) => {
        setFooter(normalizeFooter(f));
        setSupport(normalizeSupport(sp));
        setTerms(normalizeLegal(t, DEFAULT_TERMS).content);
        setPrivacy(normalizeLegal(p, DEFAULT_PRIVACY).content);
      })
      .finally(() => setLoading(false));
  }, []);

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2500); };

  const saveSection = async (section: string, config: unknown, okMsg: string) => {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/site-settings/${section}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      flash(r.ok ? okMsg : "저장에 실패했습니다.");
    } catch {
      flash("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // 공용 이미지 업로드 — 성공 시 URL, 실패 시 null
  const uploadImage = async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
    if (!r.ok) { flash("이미지 업로드 실패"); return null; }
    const { url } = await r.json();
    return url as string;
  };

  const uploadGuide = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(file);
      if (url) setSupport((s) => ({ ...s, guide_image_url: url }));
    } finally { setUploading(false); }
  };

  const setF = <K extends keyof FooterConfig>(k: K, v: FooterConfig[K]) => setFooter((p) => ({ ...p, [k]: v }));

  // ── 소셜 링크 목록 조작 ──
  const addSocial = () => setFooter((p) => ({
    ...p,
    socialLinks: [...p.socialLinks, { id: `soc-${Date.now()}`, platform: "instagram", label: "", href: "", iconUrl: "" }],
  }));
  const updateSocial = (i: number, patch: Partial<FooterSocialLink>) => setFooter((p) => {
    const next = [...p.socialLinks];
    next[i] = { ...next[i], ...patch };
    return { ...p, socialLinks: next };
  });
  const removeSocial = (i: number) => setFooter((p) => ({ ...p, socialLinks: p.socialLinks.filter((_, idx) => idx !== i) }));
  const moveSocial = (i: number, dir: -1 | 1) => setFooter((p) => {
    const j = i + dir;
    if (j < 0 || j >= p.socialLinks.length) return p;
    const next = [...p.socialLinks];
    [next[i], next[j]] = [next[j], next[i]];
    return { ...p, socialLinks: next };
  });
  const uploadSocialIcon = async (id: string, i: number, file: File) => {
    setSocialUploadId(id);
    try {
      const url = await uploadImage(file);
      if (url) updateSocial(i, { iconUrl: url });
    } finally { setSocialUploadId(null); }
  };
  const setS = <K extends keyof SupportConfig>(k: K, v: SupportConfig[K]) => setSupport((p) => ({ ...p, [k]: v }));

  if (loading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">푸터·고객센터·약관 관리</h1>
          <p className="mt-1 text-sm text-gray-500">하단 푸터 정보, 고객센터(1:1) 안내, 이용약관/개인정보처리방침을 관리합니다.</p>
        </div>
        {toast && <span className="text-sm font-medium text-green-600">{toast}</span>}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? "border-slate-800 text-slate-900" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 푸터 ── */}
      {tab === "footer" && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">사업자 정보</p>
            <div className="grid grid-cols-2 gap-4">
              <Labeled label="상호명"><input className={INPUT} value={footer.company_name} onChange={(e) => setF("company_name", e.target.value)} /></Labeled>
              <Labeled label="대표"><input className={INPUT} value={footer.ceo} onChange={(e) => setF("ceo", e.target.value)} /></Labeled>
            </div>
            <Labeled label="주소"><input className={INPUT} value={footer.address} onChange={(e) => setF("address", e.target.value)} /></Labeled>
            <div className="grid grid-cols-2 gap-4">
              <Labeled label="사업자등록번호"><input className={INPUT} value={footer.biz_no} onChange={(e) => setF("biz_no", e.target.value)} /></Labeled>
              <Labeled label="통신판매업 신고번호"><input className={INPUT} value={footer.mail_order_no} onChange={(e) => setF("mail_order_no", e.target.value)} /></Labeled>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">고객센터 표시</p>
            <Labeled label="고객센터 전화번호"><input className={INPUT} value={footer.cs_phone} onChange={(e) => setF("cs_phone", e.target.value)} /></Labeled>
            <div className="grid grid-cols-2 gap-4">
              <Labeled label="평일 운영시간"><input className={INPUT} value={footer.cs_hours_weekday} onChange={(e) => setF("cs_hours_weekday", e.target.value)} /></Labeled>
              <Labeled label="주말 운영시간"><input className={INPUT} value={footer.cs_hours_weekend} onChange={(e) => setF("cs_hours_weekend", e.target.value)} /></Labeled>
            </div>
          </div>

          {/* 메뉴 관리 */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">푸터 메뉴 ({footer.navLinks.length})</p>
              <button
                onClick={() => {
                  const newLink: FooterNavLink = { id: `nav-${Date.now()}`, label: "", href: "/" };
                  setFooter((p) => ({ ...p, navLinks: [...p.navLinks, newLink] }));
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                메뉴 추가
              </button>
            </div>

            {footer.navLinks.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">메뉴가 없습니다. 위 [+ 메뉴 추가]를 눌러 추가하세요.</p>
            ) : (
              <div className="space-y-2">
                {footer.navLinks.map((link, i) => (
                  <div key={link.id} className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50">
                    <span className="text-[11px] font-semibold text-slate-400 w-5 flex-shrink-0">#{i + 1}</span>
                    <input
                      type="text"
                      value={link.label}
                      onChange={(e) => {
                        const next = [...footer.navLinks];
                        next[i] = { ...next[i], label: e.target.value };
                        setFooter((p) => ({ ...p, navLinks: next }));
                      }}
                      placeholder="메뉴 이름"
                      className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                    />
                    <input
                      type="text"
                      value={link.href}
                      onChange={(e) => {
                        const next = [...footer.navLinks];
                        next[i] = { ...next[i], href: e.target.value };
                        setFooter((p) => ({ ...p, navLinks: next }));
                      }}
                      placeholder="/support"
                      className="w-44 flex-shrink-0 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:border-blue-400"
                    />
                    <button
                      onClick={() => {
                        const j = i - 1;
                        if (j < 0) return;
                        const next = [...footer.navLinks];
                        [next[i], next[j]] = [next[j], next[i]];
                        setFooter((p) => ({ ...p, navLinks: next }));
                      }}
                      disabled={i === 0}
                      title="위로"
                      className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-30 flex-shrink-0"
                    >↑</button>
                    <button
                      onClick={() => {
                        const j = i + 1;
                        if (j >= footer.navLinks.length) return;
                        const next = [...footer.navLinks];
                        [next[i], next[j]] = [next[j], next[i]];
                        setFooter((p) => ({ ...p, navLinks: next }));
                      }}
                      disabled={i === footer.navLinks.length - 1}
                      title="아래로"
                      className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-30 flex-shrink-0"
                    >↓</button>
                    <button
                      onClick={() => setFooter((p) => ({ ...p, navLinks: p.navLinks.filter((_, idx) => idx !== i) }))}
                      title="삭제"
                      className="w-6 h-6 flex items-center justify-center rounded border border-red-200 text-red-400 hover:bg-red-50 flex-shrink-0"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-gray-400">저장 버튼을 눌러야 반영됩니다. 링크는 <span className="font-mono">/support</span> 형식(내부) 또는 <span className="font-mono">https://...</span>(외부) 모두 가능합니다.</p>
          </div>

          {/* 소셜 링크 관리 */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">소셜 링크 ({footer.socialLinks.length})</p>
              <button
                onClick={addSocial}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                소셜 추가
              </button>
            </div>

            {footer.socialLinks.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">등록된 소셜 링크가 없습니다. 위 [+ 소셜 추가]를 눌러 추가하세요.</p>
            ) : (
              <div className="space-y-3">
                {footer.socialLinks.map((s, i) => {
                  const meta = FOOTER_SOCIAL_PLATFORMS.find((p) => p.value === s.platform);
                  const builtin = meta?.builtin ?? false;
                  return (
                    <div key={s.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-400 w-5 flex-shrink-0">#{i + 1}</span>
                        <select
                          value={s.platform}
                          onChange={(e) => updateSocial(i, { platform: e.target.value })}
                          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-400 flex-shrink-0"
                        >
                          {FOOTER_SOCIAL_PLATFORMS.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={s.label}
                          onChange={(e) => updateSocial(i, { label: e.target.value })}
                          placeholder="표시 이름 (선택, 접근성용)"
                          className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                        />
                        <button onClick={() => moveSocial(i, -1)} disabled={i === 0} title="위로"
                          className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-30 flex-shrink-0">↑</button>
                        <button onClick={() => moveSocial(i, 1)} disabled={i === footer.socialLinks.length - 1} title="아래로"
                          className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-30 flex-shrink-0">↓</button>
                        <button onClick={() => removeSocial(i)} title="삭제"
                          className="w-6 h-6 flex items-center justify-center rounded border border-red-200 text-red-400 hover:bg-red-50 flex-shrink-0">✕</button>
                      </div>

                      <input
                        type="text"
                        value={s.href}
                        onChange={(e) => updateSocial(i, { href: e.target.value })}
                        placeholder="https://..."
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:border-blue-400"
                      />

                      {builtin ? (
                        <p className="text-[11px] text-gray-400 pl-7">기본 아이콘이 자동으로 표시됩니다.</p>
                      ) : (
                        <div className="flex items-center gap-3 pl-7">
                          {s.iconUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.iconUrl} alt="" className="w-9 h-9 rounded border border-slate-200 bg-white object-contain p-1 flex-shrink-0" />
                          ) : (
                            <span className="w-9 h-9 rounded border border-dashed border-slate-300 flex items-center justify-center text-slate-300 text-lg flex-shrink-0">?</span>
                          )}
                          <label className="px-3 py-1.5 text-xs font-medium border border-slate-200 text-slate-600 hover:bg-white rounded-lg cursor-pointer">
                            {socialUploadId === s.id ? "업로드 중..." : s.iconUrl ? "아이콘 변경" : "아이콘 등록"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSocialIcon(s.id, i, f); e.target.value = ""; }}
                            />
                          </label>
                          {s.iconUrl && (
                            <button onClick={() => updateSocial(i, { iconUrl: "" })} className="text-xs text-red-400 hover:text-red-600">아이콘 제거</button>
                          )}
                          <span className="text-[11px] text-amber-600">아이콘 자동 생성 불가 — 직접 등록 필요</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-gray-400">URL을 비우면 사이트 푸터에 표시되지 않습니다. 저장 버튼을 눌러야 반영됩니다. (PNG·SVG 정사각형 아이콘 권장)</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">카피라이트</p>
            <Labeled label="카피라이트 문구"><input className={INPUT} value={footer.copyright} onChange={(e) => setF("copyright", e.target.value)} /></Labeled>
          </div>

          <button onClick={() => saveSection("footer", footer, "푸터를 저장했습니다.")} disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? "저장 중..." : "푸터 저장"}
          </button>
        </div>
      )}

      {/* ── 고객센터 ── */}
      {tab === "support" && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">상단(히어로)</p>
            <p className="text-xs text-gray-400 -mt-1">고객센터 페이지 맨 위 밝은 영역의 문구입니다. 비우면 해당 줄은 표시되지 않습니다.</p>
            <Labeled label="영문 라벨" hint="제목 위 작은 주황색 텍스트 (예: CUSTOMER CENTER)">
              <input className={INPUT} value={support.hero_eyebrow} onChange={(e) => setS("hero_eyebrow", e.target.value)} />
            </Labeled>
            <Labeled label="제목"><input className={INPUT} value={support.hero_title} onChange={(e) => setS("hero_title", e.target.value)} /></Labeled>
            <Labeled label="설명 (줄바꿈 가능)">
              <textarea rows={2} className={INPUT + " resize-none"} value={support.hero_desc} onChange={(e) => setS("hero_desc", e.target.value)} />
            </Labeled>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">좌측 안내 이미지</p>
            <p className="text-xs text-gray-400 -mt-1">비우면 아래 ‘안내 문구’가 네이비 패널로 표시됩니다.</p>
            {support.guide_image_url && (
              <div className="rounded-lg overflow-hidden border border-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={support.guide_image_url} alt="" className="w-full max-h-72 object-contain bg-gray-50" />
              </div>
            )}
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="px-4 py-2 text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg disabled:opacity-50">
                {uploading ? "업로드 중..." : "이미지 업로드"}
              </button>
              {support.guide_image_url && (
                <button type="button" onClick={() => setS("guide_image_url", "")}
                  className="text-xs text-red-400 hover:text-red-600">이미지 제거</button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadGuide(f); e.target.value = ""; }} />
              <span className="text-xs text-gray-400">JPG · PNG · WebP</span>
            </div>
            <Labeled label="이미지 URL (직접 입력)">
              <input className={INPUT} placeholder="https://..." value={support.guide_image_url} onChange={(e) => setS("guide_image_url", e.target.value)} />
            </Labeled>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">안내 문구</p>
            <Labeled label="제목"><input className={INPUT} value={support.intro_title} onChange={(e) => setS("intro_title", e.target.value)} /></Labeled>
            <Labeled label="설명 (줄바꿈 가능)" hint="이미지가 없을 때는 패널 본문, 이미지가 있을 때는 폼 위 안내 문구로 표시됩니다.">
              <textarea rows={3} className={INPUT + " resize-none"} value={support.intro_desc} onChange={(e) => setS("intro_desc", e.target.value)} />
            </Labeled>
          </div>

          <p className="text-xs text-gray-400">문의 구분(제품·사이즈 / 매장·방문 / 교환·반품·AS / 기타)은 고정이며, 접수된 1:1 문의는 <b>고객 문의 → 문의 관리</b>에서 확인할 수 있습니다.</p>

          <button onClick={() => saveSection("support_page", support, "고객센터 설정을 저장했습니다.")} disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? "저장 중..." : "고객센터 저장"}
          </button>
        </div>
      )}

      {/* ── 약관 / 방침 ── */}
      {(tab === "terms" || tab === "privacy") && (
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{tab === "terms" ? "이용약관" : "개인정보처리방침"} 본문 — 공개 페이지 <b>/{tab === "terms" ? "terms" : "privacy"}</b> 에 그대로 표시됩니다.</p>
            <button type="button"
              onClick={() => tab === "terms" ? setTerms(DEFAULT_TERMS) : setPrivacy(DEFAULT_PRIVACY)}
              className="text-xs text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50">
              기본 문구 불러오기
            </button>
          </div>
          <textarea
            rows={24}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-[13px] leading-relaxed font-mono focus:outline-none focus:border-blue-400"
            value={tab === "terms" ? terms : privacy}
            onChange={(e) => tab === "terms" ? setTerms(e.target.value) : setPrivacy(e.target.value)}
          />
          <p className="text-[11px] text-amber-600">※ 본 문구는 표준 초안입니다. 실제 운영 전 법률 전문가의 검토를 권장합니다.</p>
          <button
            onClick={() => tab === "terms"
              ? saveSection("terms_page", { content: terms }, "이용약관을 저장했습니다.")
              : saveSection("privacy_page", { content: privacy }, "개인정보처리방침을 저장했습니다.")}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      )}
    </div>
  );
}
