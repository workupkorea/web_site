"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import {
  GOLDENBELL_PROMO_PATH,
  GOLDENBELL_PROMO_SECTION,
  normalizePromoConfig,
  MAX_CUSTOM_SECTIONS,
  PROMO_FIELDS,
  PROMO_SECTIONS,
  renderPromoHtml,
  type PromoConfig,
  type PromoDevice,
  type PromoSection,
} from "@/app/goldenbell/promo";

const SETTINGS_URL = `/api/admin/site-settings/${GOLDENBELL_PROMO_SECTION}`;
const INPUT_CLASS = "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
// PC 에서도 모바일 화면 그대로 보여주므로 미리보기는 모바일 폭 하나다.
const PREVIEW_WIDTH = 390;
const VISIBILITY_OPTIONS = [{ key: "mobile", label: "공개" }] as const;

function PromoPreview({ html, panelRef }: { html: string; panelRef: RefObject<HTMLElement | null> }) {
  const [panelWidth, setPanelWidth] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setPanelWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = panelWidth ? Math.min(1, panelWidth / PREVIEW_WIDTH) : 1;

  return (
    <section ref={panelRef} tabIndex={-1} aria-labelledby="promo-preview" className="min-w-0 scroll-mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white xl:sticky xl:top-3">
      <div className="flex min-h-11 items-center border-b border-slate-200 px-4 py-2">
        <h2 id="promo-preview" className="text-sm font-semibold text-slate-700">안내 페이지 미리보기</h2>
      </div>
      <div ref={viewport} className="relative h-[min(82dvh,64rem)] min-h-80 overflow-hidden bg-slate-100">
        <iframe
          title="연말 이벤트 안내 페이지 미리보기"
          sandbox=""
          srcDoc={html}
          className="absolute top-0 block max-w-none origin-top-left"
          style={{ width: PREVIEW_WIDTH, height: `${100 / scale}%`, left: Math.max(0, (panelWidth - PREVIEW_WIDTH * scale) / 2), transform: `scale(${scale})` }}
        />
      </div>
    </section>
  );
}

export default function PromotionGuidePage() {
  const [config, setConfig] = useState<PromoConfig | null>(null);
  const [published, setPublished] = useState<PromoConfig | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const previewRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(SETTINGS_URL, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load promotion settings");
        return normalizePromoConfig(await response.json());
      })
      .then((saved) => {
        if (controller.signal.aborted) return;
        setConfig(saved);
        setPublished(saved);
        setPreviewHtml(renderPromoHtml(saved));
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, [attempt]);

  const dirty = JSON.stringify(config) !== JSON.stringify(published);

  function updateConfig(next: PromoConfig) {
    setConfig(next);
    setNotice(null);
  }

  function updateVisibility(key: PromoSection, device: PromoDevice, checked: boolean) {
    if (!config) return;
    const next = { ...config, sections: { ...config.sections, [key]: { ...config.sections[key], [device]: checked } } };
    updateConfig(next);
    setPreviewHtml(renderPromoHtml(next));
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config || !dirty || saving) return;
    if (config.customSections.some(({ title, body }) => !title.trim() || !body.trim())) {
      setNotice({ text: "추가 섹션의 제목과 본문을 입력해 주세요.", error: true });
      return;
    }
    const next = normalizePromoConfig(config);
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(SETTINGS_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) throw new Error("Failed to publish promotion settings");
      setConfig(next);
      setPublished(next);
      setPreviewHtml(renderPromoHtml(next));
      setNotice({ text: "공개 안내 페이지에 반영했습니다." });
    } catch {
      setNotice({ text: "저장하지 못했습니다. 다시 시도해 주세요.", error: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="min-w-0 space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-900">프로모션 안내</h1>
        <a href={GOLDENBELL_PROMO_PATH} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          공개 안내 ↗
        </a>
      </header>

      {loadError && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-white p-4 text-sm">
          <p role="alert" className="text-rose-700">안내 설정을 불러오지 못했습니다.</p>
          <button type="button" className="min-h-11 font-semibold text-blue-700" onClick={() => { setLoadError(false); setAttempt(attempt + 1); }}>
            다시 불러오기
          </button>
        </div>
      )}
      {!config && !loadError && <p role="status" className="text-sm text-slate-600">안내 설정을 불러오는 중입니다.</p>}

      {config && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(21rem,2fr)_minmax(0,3fr)]">
          <form onSubmit={publish} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <fieldset disabled={saving} className="min-w-0 space-y-3">
              <legend className="sr-only">안내 문구 설정</legend>
              <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3" aria-labelledby="promo-sections">
                <h2 id="promo-sections" className="text-sm font-bold text-slate-800">기본 섹션 표시</h2>
                <table className="w-full table-fixed text-left text-sm text-slate-700">
                  <thead>
                    <tr>
                      <th scope="col">섹션</th>
                      {VISIBILITY_OPTIONS.map(({ key, label }) => <th key={key} scope="col" className="w-14 text-center">{label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {PROMO_SECTIONS.map(({ key, label }) => (
                      <tr key={key} className="border-t border-slate-200">
                        <th scope="row" className="pr-2 font-medium">{label}</th>
                        {VISIBILITY_OPTIONS.map(({ key: device, label: deviceLabel }) => (
                          <td key={device} className="text-center">
                            <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                              <input type="checkbox" aria-label={`${label} ${deviceLabel}`} checked={config.sections[key][device]}
                                onChange={(event) => updateVisibility(key, device, event.target.checked)}
                                className="size-4 accent-blue-700" />
                            </label>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              {PROMO_FIELDS.map((field) => {
                const id = `promo-field-${field.key}`;
                const props = {
                  id,
                  name: field.key,
                  maxLength: field.max,
                  required: true,
                  value: config[field.key],
                  className: INPUT_CLASS,
                };
                const update = (value: string) => updateConfig({ ...config, [field.key]: value });
                return (
                  <div key={field.key}>
                    <label htmlFor={id} className="text-sm font-semibold text-slate-700">{field.label}</label>
                    {"multiline" in field
                      ? <textarea {...props} rows={3} onChange={(event) => update(event.target.value)} />
                      : <input {...props} onChange={(event) => update(event.target.value)} />}
                  </div>
                );
              })}
              <section className="space-y-3 border-t border-slate-200 pt-3" aria-labelledby="promo-custom-sections">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="promo-custom-sections" className="text-sm font-bold text-slate-800">추가 섹션</h2>
                  <button
                    type="button"
                    disabled={config.customSections.length >= MAX_CUSTOM_SECTIONS}
                    className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
                    onClick={() => updateConfig({ ...config, customSections: [...config.customSections, { id: crypto.randomUUID(), title: "", body: "", visibility: { pc: true, mobile: true } }] })}
                  >
                    + 섹션 추가
                  </button>
                </div>
                {config.customSections.map((section, index) => {
                  const edit = (field: "title" | "body", value: string) => updateConfig({
                    ...config,
                    customSections: config.customSections.map((item) => item.id === section.id ? { ...item, [field]: value } : item),
                  });
                  return (
                    <div key={section.id} className="space-y-2 rounded-lg border border-slate-200 p-3">
                      <label className="block text-sm font-semibold text-slate-700">
                        제목
                        <input value={section.title} onChange={(event) => edit("title", event.target.value)} maxLength={80} required className={INPUT_CLASS} />
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">
                        본문
                        <textarea value={section.body} onChange={(event) => edit("body", event.target.value)} maxLength={1200} required rows={4} className={INPUT_CLASS} />
                      </label>
                      <div className="flex flex-wrap gap-x-4" role="group" aria-label={`추가 섹션 ${index + 1} 공개 여부`}>
                        {VISIBILITY_OPTIONS.map(({ key, label }) => (
                          <label key={key} className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={section.visibility[key]} className="size-4 accent-blue-700"
                              onChange={(event) => updateConfig({
                                ...config,
                                customSections: config.customSections.map((item) => item.id === section.id
                                  ? { ...item, visibility: { ...item.visibility, [key]: event.target.checked } }
                                  : item),
                              })} />
                            {label}
                          </label>
                        ))}
                      </div>
                      <button type="button" aria-label={`추가 섹션 ${index + 1} 삭제`} className="min-h-11 text-sm font-semibold text-rose-700"
                        onClick={() => updateConfig({ ...config, customSections: config.customSections.filter((item) => item.id !== section.id) })}>
                        섹션 삭제
                      </button>
                    </div>
                  );
                })}
              </section>
              <p className="text-sm text-slate-600">저장하면 공개 안내 페이지에 바로 반영됩니다.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => {
                  setPreviewHtml(renderPromoHtml(config));
                  if (!window.matchMedia("(min-width: 1280px)").matches) {
                    previewRef.current?.focus({ preventScroll: true });
                    previewRef.current?.scrollIntoView({ block: "start" });
                  }
                }} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  미리보기 갱신
                </button>
                <button type="submit" disabled={!dirty} className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                  {saving ? "저장 중…" : "저장 및 공개 반영"}
                </button>
              </div>
            </fieldset>
            {notice && <p role={notice.error ? "alert" : "status"} className={`mt-3 text-sm ${notice.error ? "text-rose-700" : "text-emerald-700"}`}>{notice.text}</p>}
          </form>

          <PromoPreview html={previewHtml} panelRef={previewRef} />
        </div>
      )}
    </section>
  );
}
