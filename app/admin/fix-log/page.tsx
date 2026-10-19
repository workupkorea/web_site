"use client";
import { useEffect, useState, useCallback } from "react";
import { FIX_LOG_TARGETS, FIX_LOG_STATUSES, type FixLog } from "@/lib/fix-logs";

// 오류 수정 내역 — 출고패스·입고스케쥴처럼 외부 지점이 보는 화면의 오류를 상세히 기록한다.
const TARGET_CLS: Record<string, string> = {
  출고패스: "bg-orange-100 text-orange-700",
  입고스케쥴: "bg-blue-100 text-blue-700",
  기타: "bg-gray-100 text-gray-600",
};

const todayKst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

type Form = {
  target: string; title: string; occurred_on: string; resolved_on: string;
  symptom: string; cause: string; action_taken: string; impact: string; prevention: string; status: string;
};
const emptyForm = (): Form => ({
  target: "출고패스", title: "", occurred_on: todayKst(), resolved_on: "",
  symptom: "", cause: "", action_taken: "", impact: "", prevention: "", status: "조치완료",
});
const toForm = (l: FixLog): Form => ({
  target: l.target, title: l.title, occurred_on: l.occurred_on ?? "", resolved_on: l.resolved_on ?? "",
  symptom: l.symptom ?? "", cause: l.cause ?? "", action_taken: l.action_taken ?? "",
  impact: l.impact ?? "", prevention: l.prevention ?? "", status: l.status,
});

const SECTIONS: { key: keyof FixLog; label: string }[] = [
  { key: "symptom", label: "증상" },
  { key: "cause", label: "원인" },
  { key: "action_taken", label: "조치" },
  { key: "impact", label: "영향 범위" },
  { key: "prevention", label: "재발 방지 조치" },
];

export default function AdminFixLogPage() {
  const [rows, setRows] = useState<FixLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);

  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [target, setTarget] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // 폼 모달 — editingId가 null이면 신규 등록
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNeedsMigration(false);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (appliedQ) params.set("q", appliedQ);
      if (target !== "all") params.set("target", target);
      const res = await fetch(`/api/admin/fix-logs?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      } else {
        if (data?.needsMigration) setNeedsMigration(true);
        setRows([]); setTotal(0);
      }
    } catch {
      setRows([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, appliedQ, target]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => { setEditingId(null); setForm(emptyForm()); setFormError(""); setFormOpen(true); };
  const openEdit = (l: FixLog) => { setEditingId(l.id); setForm(toForm(l)); setFormError(""); setFormOpen(true); };

  const save = async () => {
    if (!form.title.trim()) { setFormError("제목을 입력해주세요."); return; }
    setSaving(true); setFormError("");
    try {
      const res = await fetch(editingId ? `/api/admin/fix-logs/${editingId}` : "/api/admin/fix-logs", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setFormError(data.error ?? "저장에 실패했습니다."); return; }
      setFormOpen(false);
      load();
    } catch {
      setFormError("네트워크 오류로 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (l: FixLog) => {
    if (!confirm(`'${l.title}' 기록을 삭제할까요?`)) return;
    const res = await fetch(`/api/admin/fix-logs/${l.id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? "삭제에 실패했습니다."); return; }
    load();
  };

  const inputCls = "w-full border border-gray-200 px-3 py-2 text-[15px] rounded focus:outline-none focus:border-[#303236]";
  const areaCls = `${inputCls} min-h-[80px] resize-y`;

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">오류 수정 내역</h1>
          <p className="text-base text-gray-400 mt-1">
            외부 지점이 보는 화면(출고패스·입고스케쥴 등)의 오류와 조치를 기록합니다. 총 <span className="font-bold text-gray-700">{total.toLocaleString()}</span>건
          </p>
        </div>
        <button onClick={openNew} className="px-5 py-2.5 bg-[#303236] text-white text-[15px] font-semibold rounded hover:bg-[#243d5e]">
          + 수정 내역 등록
        </button>
      </div>

      {needsMigration && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl text-base font-semibold text-amber-800">
          ⚠ fix_logs 테이블이 없습니다. <code className="bg-amber-100 px-1.5 py-0.5 rounded">supabase/migrate_add_fix_logs.sql</code> 을 SQL 에디터에서 실행해주세요.
        </div>
      )}

      {/* 필터 */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-4 flex items-center flex-wrap gap-3">
        <select value={target} onChange={(e) => { setTarget(e.target.value); setPage(1); }}
          className="border border-gray-200 px-3 py-2 text-[15px] bg-white rounded focus:outline-none focus:border-[#303236]">
          <option value="all">전체 대상</option>
          {FIX_LOG_TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (setAppliedQ(q), setPage(1))}
          placeholder="제목·증상·원인 검색 후 Enter"
          className="flex-1 min-w-[200px] border border-gray-200 px-4 py-2 text-[15px] rounded focus:outline-none focus:border-[#303236]" />
        <button onClick={() => { setAppliedQ(q); setPage(1); }}
          className="px-5 py-2 bg-[#303236] text-white text-[15px] font-semibold rounded hover:bg-[#243d5e]">검색</button>
        {(appliedQ || target !== "all") && (
          <button onClick={() => { setQ(""); setAppliedQ(""); setTarget("all"); setPage(1); }}
            className="px-4 py-2 border border-gray-200 text-[15px] text-gray-500 rounded hover:border-gray-400">초기화</button>
        )}
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center gap-3 py-20 text-base text-gray-400">
          <span className="w-6 h-6 border-2 border-[#E5541B] border-t-transparent rounded-full animate-spin" />
          불러오는 중...
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm py-20 text-center text-gray-400 text-base">
          {appliedQ || target !== "all" ? "조건에 맞는 기록이 없습니다." : "아직 기록된 오류 수정 내역이 없습니다."}
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((l) => (
            <article key={l.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className={`px-2.5 py-1 text-[12px] font-bold rounded-full ${TARGET_CLS[l.target] ?? TARGET_CLS["기타"]}`}>{l.target}</span>
                    <span className={`px-2.5 py-1 text-[12px] font-bold rounded-full ${l.status === "조치완료" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{l.status}</span>
                  </div>
                  <h2 className="text-[17px] font-bold text-gray-900">{l.title}</h2>
                  <p className="text-[13px] text-gray-400 mt-1">
                    발생 {l.occurred_on ?? "-"} · 해결 {l.resolved_on ?? "-"} · 작성 {l.author_name}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(l)} className="px-3.5 py-1.5 text-[14px] border border-gray-200 rounded hover:bg-gray-50">수정</button>
                  <button onClick={() => remove(l)} className="px-3.5 py-1.5 text-[14px] border border-red-200 text-red-600 rounded hover:bg-red-50">삭제</button>
                </div>
              </div>
              <dl className="mt-4 grid gap-3">
                {SECTIONS.map(({ key, label }) => l[key] ? (
                  <div key={key} className="grid sm:grid-cols-[110px_1fr] gap-1 sm:gap-3">
                    <dt className="text-[14px] font-bold text-gray-500">{label}</dt>
                    <dd className="text-[15px] text-gray-800 whitespace-pre-wrap">{String(l[key])}</dd>
                  </div>
                ) : null)}
              </dl>
            </article>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 py-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-[14px] border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50">이전</button>
              <span className="px-4 text-[14px] text-gray-600">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-[14px] border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50">다음</button>
            </div>
          )}
        </div>
      )}

      {/* 등록/수정 모달 */}
      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={() => !saving && setFormOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[720px] my-6 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900">{editingId ? "수정 내역 편집" : "수정 내역 등록"}</h2>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-[14px] font-semibold text-gray-600">대상
                <select value={form.target} onChange={(e) => set("target", e.target.value)} className={`${inputCls} mt-1 bg-white`}>
                  {FIX_LOG_TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block text-[14px] font-semibold text-gray-600">상태
                <select value={form.status} onChange={(e) => set("status", e.target.value)} className={`${inputCls} mt-1 bg-white`}>
                  {FIX_LOG_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block text-[14px] font-semibold text-gray-600">발생일
                <input type="date" value={form.occurred_on} onChange={(e) => set("occurred_on", e.target.value)} className={`${inputCls} mt-1`} />
              </label>
              <label className="block text-[14px] font-semibold text-gray-600">해결일
                <input type="date" value={form.resolved_on} onChange={(e) => set("resolved_on", e.target.value)} className={`${inputCls} mt-1`} />
              </label>
            </div>

            <label className="block text-[14px] font-semibold text-gray-600">제목 *
              <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="예: 마감 후 등록한 공지가 '출고 (최종)'으로 표시" className={`${inputCls} mt-1`} />
            </label>
            {SECTIONS.map(({ key, label }) => (
              <label key={key} className="block text-[14px] font-semibold text-gray-600">{label}
                <textarea value={form[key as keyof Form]} onChange={(e) => set(key as keyof Form, e.target.value)} className={`${areaCls} mt-1`} />
              </label>
            ))}

            {formError && <p className="text-[14px] text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setFormOpen(false)} disabled={saving} className="px-5 py-2 border border-gray-200 text-[15px] rounded hover:bg-gray-50">취소</button>
              <button onClick={save} disabled={saving} className="px-6 py-2 bg-[#303236] text-white text-[15px] font-semibold rounded hover:bg-[#243d5e] disabled:opacity-50">
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
