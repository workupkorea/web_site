"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  HOME_SECTIONS,
  DEFAULT_HOME_LAYOUT,
  normalizeHomeLayout,
  type HomeCampaign,
  type HomeLayoutConfig,
  type HomeSectionLayout,
  type HomeSectionKey,
  type HomeSectionMeta,
} from "@/lib/home-layout";

const META: Record<HomeSectionKey, HomeSectionMeta> = Object.fromEntries(
  HOME_SECTIONS.map((s) => [s.key, s])
) as Record<HomeSectionKey, HomeSectionMeta>;

type EditorialLite = { id: string; title: string; is_visible: boolean };

// ISO(UTC) ↔ datetime-local 입력값(브라우저 로컬=한국시간)
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function toIsoOrNull(val: string): string | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export default function AdminHomeSectionsPage() {
  const [sections, setSections] = useState<HomeSectionLayout[]>(DEFAULT_HOME_LAYOUT.sections);
  const [campaign, setCampaign] = useState<HomeCampaign | null>(null);
  const [view, setView] = useState<"base" | "campaign">("base");
  const [editorials, setEditorials] = useState<EditorialLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/site-settings/home_layout")
      .then((r) => r.json())
      .then((data) => {
        const cfg = normalizeHomeLayout(data);
        setSections(cfg.sections);
        setCampaign(cfg.campaign ?? null);
      })
      .catch(() => setSections(DEFAULT_HOME_LAYOUT.sections))
      .finally(() => setLoading(false));
    // 기획전 블록(예약 기간에만 노출할 기획전 선택용)
    fetch("/api/admin/site-settings/editorial_blocks")
      .then((r) => r.json())
      .then((d) => {
        const raw = Array.isArray(d) ? d : Array.isArray(d?.blocks) ? d.blocks : [];
        setEditorials(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          raw.filter((b: any) => b?.id).map((b: any) => ({ id: String(b.id), title: b.hero?.title || "", is_visible: b.is_visible !== false }))
        );
      })
      .catch(() => setEditorials([]));
  }, []);

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2500); };

  const isCampaignView = view === "campaign" && !!campaign;
  const list = isCampaignView ? campaign!.sections : sections;
  const setList = (next: HomeSectionLayout[]) => {
    if (isCampaignView) setCampaign((c) => (c ? { ...c, sections: next } : c));
    else setSections(next);
    setDirty(true);
  };
  const patchCampaign = (patch: Partial<HomeCampaign>) => {
    setCampaign((c) => (c ? { ...c, ...patch } : c));
    setDirty(true);
  };

  const save = async () => {
    if (campaign?.start && campaign.end && campaign.end <= campaign.start) {
      flash("종료 일시는 시작 일시보다 늦어야 합니다.");
      return;
    }
    setSaving(true);
    try {
      const body: HomeLayoutConfig = { sections, campaign };
      const r = await fetch("/api/admin/site-settings/home_layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) { setDirty(false); flash("저장됐습니다."); }
      else flash("저장에 실패했습니다.");
    } catch {
      flash("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setList(next);
  };

  const handleDrop = (target: number) => {
    if (dragIndex !== null) move(dragIndex, target);
    setDragIndex(null);
    setDragOver(null);
  };

  const toggle = (key: HomeSectionKey) => {
    setList(list.map((s) => (s.key === key ? { ...s, visible: !s.visible } : s)));
  };

  const enableCampaign = () => {
    // 현재 기본 배치를 복사하고 매거진을 켠 채로 시작
    setCampaign({
      start: null,
      end: null,
      sections: sections.map((s) => (s.key === "magazine" ? { ...s, visible: true } : s)),
      heroSlideIds: [],
      editorialBlockIds: [],
    });
    setView("campaign");
    setDirty(true);
  };
  const disableCampaign = () => {
    if (!confirm("예약 메인 설정을 삭제합니다. 계속할까요?")) return;
    setCampaign(null);
    setView("base");
    setDirty(true);
  };

  const toggleEditorial = (id: string) => {
    if (!campaign) return;
    const has = campaign.editorialBlockIds.includes(id);
    patchCampaign({ editorialBlockIds: has ? campaign.editorialBlockIds.filter((x) => x !== id) : [...campaign.editorialBlockIds, id] });
  };

  if (loading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>;

  const visibleCount = list.filter((s) => s.visible).length;
  const campaignReady = !!campaign?.start;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-3xl font-bold text-gray-900">메인 배치</h1>
          <p className="text-sm text-gray-500">
            메인 페이지 섹션의 순서와 노출 여부를 설정합니다. (PC·모바일 공통)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {toast && <span className="text-sm font-medium text-green-600">{toast}</span>}
          {dirty && !toast && <span className="text-sm text-amber-600">저장되지 않은 변경</span>}
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      {/* 기본 메인 / 예약 메인 전환 */}
      <div className="flex items-center gap-2 mb-4 max-w-2xl">
        <button
          onClick={() => setView("base")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg border ${view === "base" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
        >
          기본 메인
        </button>
        {campaign ? (
          <button
            onClick={() => setView("campaign")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg border ${view === "campaign" ? "bg-orange-600 text-white border-orange-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            예약 메인 {campaignReady ? "· 예약됨" : "· 시작일 미설정"}
          </button>
        ) : (
          <button
            onClick={enableCampaign}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-dashed border-orange-300 text-orange-600 hover:bg-orange-50"
          >
            + 메인 전체 예약 오픈 만들기
          </button>
        )}
      </div>

      {/* 예약 메인 설정: 노출 기간 + 예약 히어로 */}
      {isCampaignView && campaign && (
        <div className="bg-white rounded-xl shadow-sm border border-orange-200 max-w-2xl mb-4 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-slate-600">
              아래 기간 동안만 <b>예약 메인</b>(이 탭의 섹션 배치 + 선택한 기획전)으로 메인 전체가 바뀝니다.
              기간 밖에는 <b>기본 메인</b>이 보이고, 캠페인 매거진은 숨겨집니다.
            </p>
            <button onClick={disableCampaign} className="text-xs text-red-500 hover:underline flex-shrink-0">예약 삭제</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-600">
              오픈 일시 (시작)
              <input
                type="datetime-local"
                value={toLocalInput(campaign.start)}
                onChange={(e) => patchCampaign({ start: toIsoOrNull(e.target.value) })}
                className="mt-1 w-full border border-gray-200 px-3 py-2 text-sm rounded font-normal"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              종료 일시 (선택 — 비우면 계속 유지)
              <input
                type="datetime-local"
                value={toLocalInput(campaign.end)}
                onChange={(e) => patchCampaign({ end: toIsoOrNull(e.target.value) })}
                className="mt-1 w-full border border-gray-200 px-3 py-2 text-sm rounded font-normal"
              />
            </label>
          </div>
          {!campaign.start && (
            <p className="text-xs text-amber-600">오픈 일시를 입력해야 예약이 동작합니다. (비어 있으면 기본 메인만 노출)</p>
          )}

          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1.5">
              예약 기간에만 노출할 기획전 <span className="font-normal text-slate-400">— 선택 안 하면 기획전은 그대로</span>
            </p>
            {editorials.length === 0 ? (
              <p className="text-xs text-slate-400">등록된 기획전이 없습니다.</p>
            ) : (
              <ul className="border border-slate-100 rounded-lg divide-y divide-slate-100 max-h-56 overflow-auto">
                {editorials.map((e) => (
                  <li key={e.id}>
                    <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                      <input type="checkbox" checked={campaign.editorialBlockIds.includes(e.id)} onChange={() => toggleEditorial(e.id)} />
                      <span className="text-slate-800 truncate">{e.title || "(제목 없음)"}</span>
                      {!e.is_visible && <span className="text-[11px] text-slate-400 flex-shrink-0">· 비공개(공개로 바꿔야 노출)</span>}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-slate-400 mt-1.5">
              선택한 기획전과 그 상세페이지는 예약 기간에만 열리고, 나머지 기획전은 기간 밖에서만 나옵니다. 새 기획전은 「기획전」 메뉴에서 미리 등록해 두세요.
              (기간 밖에서는 예약 기획전 상세 주소도 열리지 않습니다.)
            </p>
          </div>

          <a
            href="/magazine-preview?view=home&campaign=1"
            target="_blank"
            rel="noreferrer"
            className="inline-block text-xs font-semibold text-orange-600 border border-orange-200 px-3 py-1.5 rounded hover:bg-orange-50"
          >
            오픈 이후 모습 미리보기 ↗
          </a>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-2xl">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            {isCampaignView ? "예약 메인 섹션 순서" : "섹션 순서"}{" "}
            <span className="text-slate-400 font-normal">({visibleCount}/{list.length} 노출)</span>
          </h2>
          <span className="text-xs text-slate-400">드래그 또는 ▲▼ 로 순서 변경</span>
        </div>

        <ul className="divide-y divide-slate-100">
          {list.map((s, i) => {
            const meta = META[s.key];
            return (
              <li
                key={s.key}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
                onDrop={() => handleDrop(i)}
                onDragEnd={() => { setDragIndex(null); setDragOver(null); }}
                className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
                  dragOver === i && dragIndex !== i
                    ? "bg-orange-50 border-l-2 border-orange-400"
                    : "hover:bg-slate-50"
                } ${!s.visible ? "opacity-55" : ""}`}
              >
                {/* 드래그 핸들 */}
                <span className="cursor-grab active:cursor-grabbing text-slate-300 flex-shrink-0" title="드래그로 이동">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
                    <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
                    <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
                  </svg>
                </span>

                {/* 순서 번호 */}
                <span className="w-6 text-center text-xs font-bold text-slate-400 flex-shrink-0">{i + 1}</span>

                {/* 이름 + 설명 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{meta?.label ?? s.key}</p>
                  <p className="text-xs text-slate-400 truncate">{meta?.description}</p>
                </div>

                {/* 내용 편집 바로가기 */}
                {meta?.editHref && (
                  <Link
                    href={meta.editHref}
                    className="text-xs font-medium text-slate-500 border border-slate-200 px-2.5 py-1 rounded hover:bg-slate-100 transition-colors flex-shrink-0"
                  >
                    편집
                  </Link>
                )}

                {/* 순서 ▲▼ */}
                <div className="flex flex-col flex-shrink-0">
                  <button
                    onClick={() => move(i, i - 1)}
                    disabled={i === 0}
                    className="text-slate-400 hover:text-slate-800 disabled:opacity-25 disabled:hover:text-slate-400"
                    title="위로"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button
                    onClick={() => move(i, i + 1)}
                    disabled={i === list.length - 1}
                    className="text-slate-400 hover:text-slate-800 disabled:opacity-25 disabled:hover:text-slate-400"
                    title="아래로"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>

                {/* 노출 토글 */}
                <button
                  onClick={() => toggle(s.key)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${s.visible ? "bg-blue-600" : "bg-slate-300"}`}
                  title={s.visible ? "노출 중 (클릭하면 숨김)" : "숨김 (클릭하면 노출)"}
                  aria-pressed={s.visible}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${s.visible ? "translate-x-5" : ""}`} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-4 text-xs text-slate-400 max-w-2xl space-y-1">
        <p>· 각 섹션의 <b className="text-slate-500">내용</b>은 “편집” 버튼이나 해당 메뉴에서 수정합니다. 이 페이지는 순서·노출만 담당합니다.</p>
        <p>· {campaign?.start ? "기본 메인은 저장 즉시 반영되고, 예약 메인은 오픈 일시가 되면 자동으로 적용됩니다." : "저장하면 메인 페이지에 즉시 반영됩니다."} (팝업 배너는 화면 위 오버레이라 배치 대상이 아닙니다.)</p>
      </div>
    </div>
  );
}
