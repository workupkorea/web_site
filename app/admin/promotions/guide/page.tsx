"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  GOLDENBELL_PROMO_PATH,
  GOLDENBELL_PROMO_SECTION,
  normalizePromoConfig,
  PROMO_FIELDS,
  renderPromoHtml,
  type PromoConfig,
} from "@/app/goldenbell/promo";

const SETTINGS_URL = `/api/admin/site-settings/${GOLDENBELL_PROMO_SECTION}`;
const INPUT_CLASS = "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";

export default function PromotionGuidePage() {
  const [config, setConfig] = useState<PromoConfig | null>(null);
  const [published, setPublished] = useState<PromoConfig | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

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

  const dirty = PROMO_FIELDS.some(({ key }) => config?.[key] !== published?.[key]);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config || !dirty || saving) return;
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
    <section className="space-y-4 p-3 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">프로모션 안내</h1>
          <p className="mt-1 text-sm text-slate-600">골든벨 공개 안내 페이지의 문구를 관리합니다.</p>
        </div>
        <a href={GOLDENBELL_PROMO_PATH} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          공개 안내 페이지 열기 ↗
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
          <form onSubmit={publish} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <fieldset disabled={saving} className="space-y-3">
              <legend className="mb-3 text-base font-bold text-slate-900">골든벨 안내 문구</legend>
              {PROMO_FIELDS.map((field) => {
                const props = {
                  name: field.key,
                  maxLength: field.max,
                  required: true,
                  value: config[field.key],
                  className: INPUT_CLASS,
                };
                const update = (value: string) => {
                  setConfig({ ...config, [field.key]: value });
                  setNotice(null);
                };
                return (
                  <label key={field.key} className="block text-sm font-semibold text-slate-700">
                    {field.label}
                    {"multiline" in field
                      ? <textarea {...props} rows={3} onChange={(event) => update(event.target.value)} />
                      : <input {...props} onChange={(event) => update(event.target.value)} />}
                  </label>
                );
              })}
              <p className="text-sm text-slate-600">저장하면 공개 안내 페이지에 바로 반영됩니다.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setPreviewHtml(renderPromoHtml(config))} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  미리보기 갱신
                </button>
                <button type="submit" disabled={!dirty} className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                  {saving ? "저장 중…" : "저장 및 공개 반영"}
                </button>
              </div>
            </fieldset>
            {notice && <p role={notice.error ? "alert" : "status"} className={`mt-3 text-sm ${notice.error ? "text-rose-700" : "text-emerald-700"}`}>{notice.text}</p>}
          </form>

          <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">안내 페이지 미리보기</h2>
            <iframe title="골든벨 안내 페이지 미리보기" sandbox="" srcDoc={previewHtml} className="block h-[min(75dvh,52rem)] min-h-80 w-full" />
          </section>
        </div>
      )}
    </section>
  );
}
