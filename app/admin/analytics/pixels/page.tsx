"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";

interface PixelSetting {
  platform: string;
  pixel_id: string;
  enabled: boolean;
}

function getMonthLabel(offset: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  return d.toISOString().slice(0, 7);
}

interface PlatformConfig {
  name: string;
  shortName: string;
  color: string;
  textColor: string;
  desc: string;
  idLabel: string;
  idPlaceholder: string;
  guide: string;
  guideUrl: string;
  codePreview: (id: string) => string;
}

const PLATFORMS: Record<string, PlatformConfig> = {
  gtm: {
    name:        "Google Tag Manager",
    shortName:   "GTM",
    color:       "bg-blue-500",
    textColor:   "text-blue-600",
    desc:        "Meta Pixel, GA4, 네이버, 카카오 등 모든 태그를 하나로 관리. 가장 먼저 설정 권장.",
    idLabel:     "컨테이너 ID",
    idPlaceholder: "GTM-XXXXXXX",
    guide:       "1. tagmanager.google.com 접속 → 계정 생성 → 컨테이너 ID(GTM-XXXXXXX) 복사",
    guideUrl:    "https://tagmanager.google.com",
    codePreview: (id) => `<!-- GTM Head -->\n<script>(function(w,d,s,l,i){w[l]=w[l]||[];...})(window,document,'script','dataLayer','${id}');</script>\n<!-- GTM Body -->\n<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${id}" ...></noscript>`,
  },
  ga4: {
    name:        "Google Analytics 4",
    shortName:   "GA4",
    color:       "bg-orange-500",
    textColor:   "text-orange-600",
    desc:        "방문자 수, 페이지뷰, 유입 경로, 기기/지역 분석. GTM을 통해 연동하거나 직접 삽입.",
    idLabel:     "측정 ID",
    idPlaceholder: "G-XXXXXXXXXX",
    guide:       "1. analytics.google.com → 속성 생성 → 데이터 스트림 → 측정 ID(G-XXXXXXXXXX) 복사",
    guideUrl:    "https://analytics.google.com",
    codePreview: (id) => `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', '${id}');\n</script>`,
  },
  meta: {
    name:        "Meta Pixel",
    shortName:   "Meta",
    color:       "bg-[#1877F2]",
    textColor:   "text-[#1877F2]",
    desc:        "Facebook · Instagram 광고 전환 추적. 방문, 문의, 매장찾기 등 오프라인 유도 이벤트 측정.",
    idLabel:     "픽셀 ID",
    idPlaceholder: "123456789012345",
    guide:       "1. business.facebook.com → 이벤트 관리자 → 픽셀 생성 → 픽셀 ID 복사",
    guideUrl:    "https://business.facebook.com/events_manager",
    codePreview: (id) => `<script>\n!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){...};\n  fbq('init', '${id}');\n  fbq('track', 'PageView');\n</script>\n<noscript><img height="1" width="1" src="https://www.facebook.com/tr?id=${id}&ev=PageView"/></noscript>`,
  },
  naver: {
    name:        "Naver 전환추적",
    shortName:   "NA",
    color:       "bg-green-500",
    textColor:   "text-green-600",
    desc:        "네이버 검색광고(SA) 전환 추적. 네이버 유입 고객의 문의·방문 행동을 측정.",
    idLabel:     "전환추적 ID",
    idPlaceholder: "s_XXXXXXXXXXXXXXXX",
    guide:       "1. searchad.naver.com → 도구 → 전환추적 → 스크립트 생성 → ID 복사",
    guideUrl:    "https://searchad.naver.com",
    codePreview: (id) => `<script type="text/javascript" src="//wcs.naver.net/wcslog.js"></script>\n<script>\nif(!wcs_add) var wcs_add = {};\nwcs_add["wa"] = "${id}";\nif(window.wcs) wcs_do();\n</script>`,
  },
  kakao: {
    name:        "Kakao Pixel",
    shortName:   "KA",
    color:       "bg-yellow-400",
    textColor:   "text-yellow-600",
    desc:        "카카오 모먼트 광고 전환 추적. 카카오 유입 고객의 행동을 측정하고 리타겟팅.",
    idLabel:     "픽셀 트래킹 ID",
    idPlaceholder: "XXXXXXXXXXXXXXXXXX",
    guide:       "1. moment.kakao.com → 픽셀 & SDK → 픽셀 생성 → 트래킹 ID 복사",
    guideUrl:    "https://moment.kakao.com",
    codePreview: (id) => `<script type='text/javascript' charset='UTF-8' src='//t1.daumcdn.net/kas/static/kp.js'></script>\n<script>kakaoPixel('${id}').pageView();</script>`,
  },
};

export default function PixelSettingsPage() {
  const [settings, setSettings] = useState<Record<string, PixelSetting>>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<string | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [msg, setMsg]           = useState("");
  const [tableError, setTableError] = useState(false);

  // 회원가입 현황
  interface MemberStats { total: number; active: number; thisMonth: number; byMonth: { month: string; count: number }[] }
  const [memberStats, setMemberStats] = useState<MemberStats>({ total: 0, active: 0, thisMonth: 0, byMonth: [] });
  const [loadingM, setLoadingM] = useState(true);
  useEffect(() => {
    fetch("/api/admin/members/stats")
      .then((r) => r.json())
      .then((d) => { if (d && !d.error) setMemberStats(d); })
      .finally(() => setLoadingM(false));
  }, []);
  const memberChartData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => getMonthLabel(i)).reverse();
    const byMonthMap = new Map(memberStats.byMonth.map((b) => [b.month, b.count]));
    const byMonth = months.map((m) => ({ month: m, count: byMonthMap.get(m) ?? 0 }));
    const max = Math.max(...byMonth.map((b) => b.count), 1);
    return { byMonth, max };
  }, [memberStats]);

  const showMsg = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true); setTableError(false);
    try {
      const r = await fetch("/api/admin/analytics/pixels");
      if (!r.ok) throw new Error();
      const d = await r.json();
      if (Array.isArray(d)) {
        const map: Record<string, PixelSetting> = {};
        d.forEach((row: PixelSetting) => { map[row.platform] = row; });
        setSettings(map);
      }
    } catch { setTableError(true); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // 각 플랫폼별 로컬 수정값
  const [localIds, setLocalIds]       = useState<Record<string, string>>({});
  const [localEnabled, setLocalEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const ids: Record<string, string>    = {};
    const en:  Record<string, boolean>   = {};
    Object.entries(settings).forEach(([k, v]) => { ids[k] = v.pixel_id; en[k] = v.enabled; });
    setLocalIds(ids);
    setLocalEnabled(en);
  }, [settings]);

  const save = async (platform: string) => {
    setSaving(platform);
    try {
      await fetch("/api/admin/analytics/pixels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          pixel_id: localIds[platform] ?? "",
          enabled:  localEnabled[platform] ?? false,
        }),
      });
      showMsg(`${PLATFORMS[platform].name} 설정이 저장됐습니다.`);
      load();
    } catch { showMsg("저장 실패. 다시 시도해주세요."); }
    setSaving(null);
  };

  const enabledCount = Object.entries(localEnabled).filter(([, v]) => v).length;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">픽셀 / 광고 설정</h1>
          <p className="text-base text-gray-400 mt-1">
            인스타그램, 네이버, 카카오 광고 픽셀을 설정하면 사이트 전체에 자동 적용됩니다.
          </p>
        </div>
        <div className={`px-5 py-2.5 rounded-xl text-base font-bold ${enabledCount > 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
          {loading ? "-" : enabledCount}개 활성화
        </div>
      </div>

      {msg && <div className="px-5 py-3 bg-green-50 border border-green-200 text-green-700 text-base rounded-lg">{msg}</div>}

      {!loading && tableError && (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-base font-semibold text-amber-800 mb-1">⚠ pixel_settings 테이블 미설정</p>
          <p className="text-[14px] text-amber-700">Supabase에서 SQL을 실행한 후 사용하세요. ID 값은 로컬에서 입력/미리보기할 수 있습니다.</p>
        </div>
      )}

      {/* 회원 요약 카드 */}
      <div className="grid grid-cols-3 gap-5">
        {[
          { label: "전체 회원", value: memberStats.total, color: "text-[#303236]" },
          { label: "이번달 신규", value: memberStats.thisMonth, color: "text-[#E5541B]" },
          { label: "활성 회원", value: memberStats.active, color: "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-6 text-center">
            <p className="text-[15px] text-gray-500 font-medium mb-2">{s.label}</p>
            <p className={`text-4xl font-black ${s.color}`}>{loadingM ? "-" : s.value.toLocaleString()}</p>
            <p className="text-[13px] text-gray-300 mt-1">명</p>
          </div>
        ))}
      </div>

      {/* 월별 신규 회원 차트 */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-800">월별 신규 회원 추이</h2>
          <Link href="/admin/members" className="text-[14px] text-[#303236] hover:underline">회원 관리 →</Link>
        </div>
        {loadingM ? (
          <div className="h-40 flex items-center justify-center text-gray-400">불러오는 중...</div>
        ) : memberChartData.byMonth.every((b) => b.count === 0) ? (
          <div className="h-40 flex items-center justify-center text-gray-400 text-base">
            가입 회원이 없어 데이터가 없습니다.
          </div>
        ) : (
          <div className="flex items-end gap-4 h-44">
            {memberChartData.byMonth.map(({ month, count }) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[13px] font-bold text-[#303236]">{count > 0 ? count : ""}</span>
                <div className="w-full relative">
                  <div
                    className="w-full bg-[#303236] rounded-t-md transition-all"
                    style={{ height: `${Math.max(4, (count / memberChartData.max) * 120)}px` }}
                  />
                </div>
                <span className="text-[12px] text-gray-400">{month.slice(5)}월</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 픽셀 카드들 */}
      <div className="space-y-4">
        {Object.entries(PLATFORMS).map(([key, cfg]) => {
          const pixelId   = localIds[key]     ?? "";
          const isEnabled = localEnabled[key] ?? false;
          const isSaving  = saving === key;
          const hasId     = pixelId.trim().length > 0;
          const showPrev  = preview === key;

          return (
            <div key={key} className={`bg-white border-2 rounded-xl shadow-sm transition-all ${isEnabled && hasId ? "border-emerald-300" : "border-gray-200"}`}>
              <div className="p-6">
                <div className="flex items-start gap-5">
                  {/* 아이콘 */}
                  <div className={`w-14 h-14 ${cfg.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white text-[15px] font-black">{cfg.shortName}</span>
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="text-xl font-bold text-gray-900">{cfg.name}</h3>
                      <span className={`px-2.5 py-0.5 text-[12px] font-bold rounded-full ${isEnabled && hasId ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                        {isEnabled && hasId ? "활성" : "비활성"}
                      </span>
                    </div>
                    <p className="text-[14px] text-gray-500 mb-4">{cfg.desc}</p>

                    {/* ID 입력 + 토글 */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-[240px]">
                        <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">{cfg.idLabel}</label>
                        <input
                          value={pixelId}
                          onChange={e => setLocalIds(p => ({ ...p, [key]: e.target.value }))}
                          placeholder={cfg.idPlaceholder}
                          className="w-full border border-gray-200 px-4 py-2.5 text-[15px] font-mono rounded focus:outline-none focus:border-[#303236]"
                        />
                      </div>

                      {/* 토글 */}
                      <div className="flex flex-col items-center gap-1 pt-5">
                        <button
                          onClick={() => setLocalEnabled(p => ({ ...p, [key]: !p[key] }))}
                          className={`relative inline-flex items-center w-14 h-7 rounded-full transition-colors duration-200 ${isEnabled ? "bg-[#E5541B]" : "bg-gray-200"}`}
                        >
                          <span className={`absolute w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${isEnabled ? "translate-x-8" : "translate-x-1"}`} />
                        </button>
                        <span className={`text-[12px] font-semibold ${isEnabled ? "text-[#E5541B]" : "text-gray-300"}`}>
                          {isEnabled ? "ON" : "OFF"}
                        </span>
                      </div>

                      {/* 저장 버튼 */}
                      <div className="pt-5">
                        <button onClick={() => save(key)} disabled={isSaving}
                          className="px-6 py-2.5 bg-[#303236] text-white text-[15px] font-bold hover:bg-[#243d5e] disabled:opacity-50 rounded">
                          {isSaving ? "저장 중..." : "저장"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 설정 가이드 + 코드 미리보기 */}
                <div className="mt-5 pt-5 border-t border-gray-100 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-gray-400 font-mono bg-gray-50 px-3 py-1.5 rounded border border-gray-100">
                      {cfg.guide}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <a href={cfg.guideUrl} target="_blank" rel="noopener noreferrer"
                      className={`text-[14px] font-semibold ${cfg.textColor} hover:underline`}>
                      관리 페이지 열기 ↗
                    </a>
                    <button onClick={() => setPreview(showPrev ? null : key)}
                      className="text-[14px] text-gray-500 border border-gray-200 px-3 py-1.5 hover:border-gray-400 rounded">
                      {showPrev ? "코드 숨기기" : "코드 미리보기"}
                    </button>
                  </div>
                </div>

                {/* 코드 미리보기 */}
                {showPrev && (
                  <div className="mt-3">
                    <pre className="bg-gray-900 text-green-400 text-[12px] font-mono p-4 rounded-xl overflow-x-auto whitespace-pre-wrap">
                      {cfg.codePreview(pixelId || cfg.idPlaceholder)}
                    </pre>
                    {!hasId && (
                      <p className="text-[13px] text-amber-600 mt-2">⚠ 실제 {cfg.idLabel}를 입력하면 코드가 업데이트됩니다.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 적용 방법 안내 */}
      <div className="bg-gray-800 text-white rounded-xl p-6 space-y-3">
        <h3 className="text-lg font-bold">사이트에 픽셀 코드 자동 적용 방법</h3>
        <p className="text-[14px] text-gray-300">저장된 픽셀 ID는 <code className="bg-gray-700 px-1.5 py-0.5 rounded">components/PixelManager.tsx</code>를 통해 사이트 전체에 자동 삽입됩니다.</p>
        <div className="bg-gray-900 rounded-lg p-4 font-mono text-[13px] text-green-400">
          {`// app/layout.tsx 에 추가\nimport PixelManager from "@/components/PixelManager";\n\nexport default function RootLayout({ children }) {\n  return (\n    <html>\n      <body>\n        <PixelManager />\n        {children}\n      </body>\n    </html>\n  );\n}`}
        </div>
      </div>
    </div>
  );
}
