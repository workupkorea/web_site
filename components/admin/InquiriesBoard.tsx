"use client";
import { useState, useEffect, useMemo } from "react";
import InquiryTabs from "@/components/admin/InquiryTabs";
import { INQUIRY_STATUS_LABEL, type Inquiry, type InquiryStatus } from "@/data/partnership";
import { DEFAULT_NOTIFICATIONS, normalizeNotifications, NOTIFY_TYPES, type NotificationConfig, type NotifyType } from "@/lib/site-content";

const FIELD_LABELS: Record<string, string> = {
  name: "이름", phone: "연락처", region: "창업 희망 지역", message: "문의 내용",
  brand: "브랜드명", manager: "담당자명", category: "취급 품목", link: "브랜드 링크",
  subject: "문의 구분", organization_name: "회사·단체명", email: "이메일", quantity_text: "예상 수량", product_text: "희망 상품", required_date_text: "필요한 날짜", inquiry_type: "문의 유형", privacyAgree: "개인정보 동의", title: "제목",
  productName: "문의 상품", productId: "상품 ID", sku: "제품번호",
  content: "내용", secret: "공개 여부", notifyConsent: "알림 동의",
};

const TYPE_LABEL: Record<string, string> = { franchise: "가맹·창업", wholesale: "입점·제휴", support: "1:1 문의", product: "상품 문의", group_order: "단체복 문의" };
const TYPE_BADGE: Record<string, string> = { franchise: "bg-[#303236] text-white", wholesale: "bg-[#2d4f72] text-white", support: "bg-[#E5541B] text-white", product: "bg-emerald-600 text-white", group_order: "bg-indigo-600 text-white" };

const STATUS_STYLE: Record<InquiryStatus, string> = {
  new: "bg-green-100 text-green-700",
  processing: "bg-blue-100 text-blue-700",
  done: "bg-gray-100 text-gray-500",
};

// 필터 순서: 전체 / 가맹·창업 / 입점·제휴 / 상품 문의 / 1:1 문의
const FILTERS = [["all", "전체"], ["franchise", "가맹·창업"], ["wholesale", "입점·제휴"], ["product", "상품 문의"], ["support", "1:1 문의"], ["group_order", "단체복 문의"]] as const;

// 유형 변경/이동 대상
const MOVE_TYPES = ["franchise", "wholesale", "support", "product", "group_order"] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch { return iso; }
}

function getBody(q: Inquiry): string {
  return String(q.payload.message ?? q.payload.content ?? "");
}
function getTitle(q: Inquiry): string {
  const t = String(q.payload.title ?? "").trim();
  if (t) return t;
  // 단체복 문의는 제목 필드 대신 "[단체복·대량구매 / 유형] 회사명" 형태의 subject 를 제목으로 쓴다.
  if ((q.type as string) === "group_order") {
    const subject = String(q.payload.subject ?? "").trim();
    if (subject) return subject;
  }
  const first = getBody(q).split("\n").map((s) => s.trim()).filter(Boolean)[0] ?? "";
  if (!first) return "(제목 없음)";
  return first.length > 50 ? first.slice(0, 50) + "…" : first;
}

// 펼침 상세에 표시할 필드(제목·본문·이름은 별도 표시하므로 제외)
const HIDE_FIELDS = new Set(["title", "message", "content", "name", "manager", "inquiry_category"]);

// "미답변" = 완료(done) 상태가 아니면서 답변 내용도 없는 건. 상태만 보고 완료를 걸러야
// (상태를 답변 없이 수동으로 '완료'로 바꾼 경우도 있음) 완료 건이 미답변 목록에 섞여 나오지 않는다.
function isUnanswered(q: Inquiry): boolean {
  return q.status !== "done" && !q.payload._reply;
}

// ── 접수 목록 한 행 (아코디언: 제목 클릭 시 내용/답변 펼침) ──
function InquiryRow({ q, selected, onToggleSelect, onStatus, onChangeType, onDelete, onSaveReply }: {
  q: Inquiry;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onStatus: (id: string, s: InquiryStatus) => void;
  onChangeType: (id: string, t: string) => void;
  onDelete: (id: string) => void;
  onSaveReply: (id: string, reply: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const existing = q.payload._reply ?? "";
  const repliedAt = q.payload._repliedAt ?? "";
  const [draft, setDraft] = useState(existing);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(existing); }, [existing]);

  const name = q.payload.name || q.payload.manager || "-";
  const subject = q.payload.subject ? String(q.payload.subject) : null;
  const email = Object.entries(q.payload).find(([k, v]) => !k.startsWith("_") && EMAIL_RE.test(String(v)))?.[1];
  const extras = Object.entries(q.payload).filter(([k, v]) => !k.startsWith("_") && !HIDE_FIELDS.has(k) && String(v).trim());
  const save = async () => { setSaving(true); try { await onSaveReply(q.id, draft); } finally { setSaving(false); } };

  return (
    <div className={`border-b border-slate-100 last:border-0 ${selected ? "bg-blue-50/40" : ""}`}>
      <div className="grid grid-cols-[32px_84px_128px_112px_1fr_84px] items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <input type="checkbox" checked={selected} onClick={(e) => e.stopPropagation()} onChange={() => onToggleSelect(q.id)} className="w-4 h-4 accent-blue-600" />
        <span className={`text-[11px] px-2 py-0.5 rounded text-center whitespace-nowrap ${TYPE_BADGE[q.type] ?? "bg-gray-500 text-white"}`}>{TYPE_LABEL[q.type] ?? q.type}</span>
        <span className="text-xs text-slate-400 whitespace-nowrap">{fmtDate(q.created_at)}</span>
        <span className="text-sm text-slate-700 truncate">{name}</span>
        <span className="text-sm text-slate-800 truncate flex items-center gap-1.5">
          {q.payload._reply && <span className="text-emerald-600 text-[11px] flex-shrink-0">✓답변</span>}
          {subject && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 flex-shrink-0">{subject}</span>}
          <span className="truncate">{getTitle(q)}</span>
        </span>
        <div className="flex items-center gap-1.5 justify-end">
          <span className={`text-[11px] px-2 py-0.5 rounded ${STATUS_STYLE[q.status]}`}>{INQUIRY_STATUS_LABEL[q.status]}</span>
          <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-1 bg-slate-50/50">
          <div className="text-sm text-slate-800 whitespace-pre-line break-words border border-slate-100 bg-white rounded-lg p-3.5 mb-3">{getBody(q) || "(내용 없음)"}</div>

          {extras.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mb-3">
              {extras.map(([k, v]) => (
                <div key={k} className="flex gap-2 text-xs">
                  <span className="text-slate-400 w-20 shrink-0">{FIELD_LABELS[k] ?? k}</span>
                  <span className="text-slate-700 break-words">{String(v)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-[11px] text-slate-400">유형</span>
            <select value={q.type} onChange={(e) => onChangeType(q.id, e.target.value)}
              className="text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none">
              {MOVE_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            <span className="text-[11px] text-slate-400 ml-1">상태</span>
            <select value={q.status} onChange={(e) => onStatus(q.id, e.target.value as InquiryStatus)}
              className="text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none">
              {(["new", "processing", "done"] as InquiryStatus[]).map((s) => <option key={s} value={s}>{INQUIRY_STATUS_LABEL[s]}</option>)}
            </select>
            <button onClick={() => onDelete(q.id)} className="text-[11px] text-red-400 border border-red-200 px-2 py-1 rounded hover:bg-red-50">삭제</button>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-500">답변</label>
              {repliedAt && <span className="text-[11px] text-emerald-600">답변완료 · {fmtDate(repliedAt)}</span>}
            </div>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
              placeholder="고객에게 전달할 답변을 입력하고 저장하세요."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-y bg-white" />
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <button onClick={save} disabled={saving || draft === existing}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-40">
                {saving ? "저장 중..." : "답변 저장"}
              </button>
              {email && (
                <a href={`mailto:${email}?subject=${encodeURIComponent("[워크업] 문의에 답변드립니다")}&body=${encodeURIComponent(draft)}`}
                  className="px-4 py-1.5 text-xs font-semibold border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">메일로 보내기</a>
              )}
              <span className="text-[11px] text-slate-400">저장 시 상태가 ‘완료’로 바뀝니다.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// mode="b2b": 상단 B2B 탭용 — 단체복 문의만 보여주는 전용 보기(필터·알림설정 탭 숨김).
export default function InquiriesBoard({ mode = "all" }: { mode?: "all" | "b2b" }) {
  const fixedType = mode === "b2b" ? "group_order" : null;
  const [tab, setTab] = useState<"list" | "notify">("list");
  const [toast, setToast] = useState("");
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2500); };

  // ── 알림 설정 ──
  const [notif, setNotif] = useState<NotificationConfig>(DEFAULT_NOTIFICATIONS);
  const [loadingNotif, setLoadingNotif] = useState(true);
  const [savingNotif, setSavingNotif] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");

  useEffect(() => {
    fetch("/api/admin/site-settings/notifications")
      .then(r => r.ok ? r.json() : null)
      .then(d => setNotif(normalizeNotifications(d)))
      .catch(() => setNotif(DEFAULT_NOTIFICATIONS))
      .finally(() => setLoadingNotif(false));
  }, []);

  const addTypeEmail = (k: NotifyType) => setNotif(n => ({ ...n, emails_by_type: { ...n.emails_by_type, [k]: [...n.emails_by_type[k], ""] } }));
  const setTypeEmail = (k: NotifyType, i: number, v: string) => setNotif(n => ({ ...n, emails_by_type: { ...n.emails_by_type, [k]: n.emails_by_type[k].map((e, idx) => idx === i ? v : e) } }));
  const removeTypeEmail = (k: NotifyType, i: number) => setNotif(n => ({ ...n, emails_by_type: { ...n.emails_by_type, [k]: n.emails_by_type[k].filter((_, idx) => idx !== i) } }));

  const saveNotif = async () => {
    setSavingNotif(true);
    try {
      const cleaned = normalizeNotifications(notif); // 빈 이메일 제거
      const r = await fetch("/api/admin/site-settings/notifications", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cleaned),
      });
      if (r.ok) setNotif(cleaned);
      flash(r.ok ? "알림 설정을 저장했습니다." : "저장에 실패했습니다.");
    } finally { setSavingNotif(false); }
  };

  const testWebhook = async () => {
    setTesting(true); setTestResult("");
    try {
      const r = await fetch("/api/admin/inquiries/test-webhook", { method: "POST" });
      const d = await r.json();
      if (!d.configured) setTestResult("❌ 미설정: " + (d.error ?? ""));
      else if (d.ok) setTestResult(`✅ 전송 성공 (HTTP ${d.status})` + (d.notifyEmail ? ` · 이메일: ${d.notifyEmail}` : " · 이메일 발송 꺼짐") + " — 시트의 [테스트] 행" + (d.notifyEmail ? "과 담당자 메일" : "") + " 도착 여부를 확인하세요.");
      else setTestResult(`❌ 전송 실패 (HTTP ${d.status ?? "-"}) ${d.error ?? d.body ?? ""}`);
    } catch (e) {
      setTestResult("❌ 요청 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally { setTesting(false); }
  };

  // ── 실제 접수 문의 ──
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [filter, setFilter] = useState<string>(fixedType ?? "all");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(30);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveTarget, setMoveTarget] = useState<string>("wholesale");
  const [moving, setMoving] = useState(false);
  const [deletingBulk, setDeletingBulk] = useState(false);

  // ── 문의 통계(유형별 집계 + 미답변 건수) — 기본 최근 1개월, 직접 선택도 가능 ──
  const [statsPeriod, setStatsPeriod] = useState<"1m" | "3m" | "all" | "custom">("1m");
  const [statsFrom, setStatsFrom] = useState("");
  const [statsTo, setStatsTo] = useState("");
  const [unansweredOnly, setUnansweredOnly] = useState(false);

  const loadInquiries = () => {
    setLoadingList(true);
    fetch("/api/admin/inquiries")
      .then(r => r.ok ? r.json() : [])
      .then((d: Inquiry[]) => setInquiries(Array.isArray(d) ? (fixedType ? d.filter(q => (q.type as string) === fixedType) : d) : []))
      .catch(() => setInquiries([]))
      .finally(() => setLoadingList(false));
  };
  useEffect(() => { loadInquiries(); }, []);
  useEffect(() => { setVisible(30); setSelected(new Set()); }, [filter, search, tab, unansweredOnly]);

  // 통계 집계 기간 — "직접선택"은 두 날짜가 다 있어야 적용, 그 전까지는 "전체"와 동일하게 둔다.
  const statsRangeStart = useMemo(() => {
    if (statsPeriod === "1m" || statsPeriod === "3m") {
      const d = new Date();
      d.setMonth(d.getMonth() - (statsPeriod === "1m" ? 1 : 3));
      return d.toISOString();
    }
    if (statsPeriod === "custom" && statsFrom) return new Date(statsFrom + "T00:00:00").toISOString();
    return null;
  }, [statsPeriod, statsFrom]);
  const statsRangeEnd = useMemo(() => {
    if (statsPeriod === "custom" && statsTo) return new Date(statsTo + "T23:59:59").toISOString();
    return null;
  }, [statsPeriod, statsTo]);

  const statsScoped = useMemo(
    () =>
      inquiries.filter((q) => {
        if (statsRangeStart && q.created_at < statsRangeStart) return false;
        if (statsRangeEnd && q.created_at > statsRangeEnd) return false;
        return true;
      }),
    [inquiries, statsRangeStart, statsRangeEnd]
  );
  const statsUnansweredCount = useMemo(() => statsScoped.filter(isUnanswered).length, [statsScoped]);

  // 필터 버튼에 붙는 유형별 건수 — 통계 카드에서 고른 기간을 그대로 따라간다(기간을 바꾸면 이 숫자들도 바뀜).
  const statsTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of MOVE_TYPES) counts[t] = 0;
    for (const q of statsScoped) counts[q.type as string] = (counts[q.type as string] ?? 0) + 1;
    return counts;
  }, [statsScoped]);

  const changeStatus = async (id: string, status: InquiryStatus) => {
    const snapshot = inquiries;
    setInquiries(prev => prev.map(q => q.id === id ? { ...q, status } : q));
    try {
      const res = await fetch(`/api/admin/inquiries/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
    } catch { setInquiries(snapshot); flash("상태 변경에 실패했습니다."); }
  };

  const saveReply = async (id: string, reply: string) => {
    const snapshot = inquiries;
    const trimmed = reply.trim();
    const repliedAt = new Date().toISOString();
    setInquiries(prev => prev.map(q => {
      if (q.id !== id) return q;
      const payload = { ...q.payload };
      if (trimmed) { payload._reply = reply; payload._repliedAt = repliedAt; }
      else { delete payload._reply; delete payload._repliedAt; }
      return { ...q, status: trimmed ? "done" : q.status, payload };
    }));
    try {
      const res = await fetch(`/api/admin/inquiries/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trimmed ? { reply, status: "done" } : { reply }),
      });
      if (!res.ok) throw new Error();
      flash(trimmed ? "답변을 저장했습니다." : "답변을 비웠습니다.");
    } catch { setInquiries(snapshot); flash("답변 저장에 실패했습니다."); }
  };

  const deleteInquiry = async (id: string) => {
    if (!confirm("이 문의를 삭제할까요?")) return;
    const snapshot = inquiries;
    setInquiries(prev => prev.filter(q => q.id !== id));
    try {
      const res = await fetch(`/api/admin/inquiries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      flash("삭제됐습니다.");
    } catch { setInquiries(snapshot); flash("삭제에 실패했습니다."); }
  };

  // 개별 게시판 유형 변경
  const changeType = async (id: string, type: string) => {
    const snapshot = inquiries;
    setInquiries(prev => prev.map(q => q.id === id ? { ...q, type: type as Inquiry["type"] } : q));
    try {
      const res = await fetch(`/api/admin/inquiries/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error();
      flash(`유형을 ${TYPE_LABEL[type] ?? type}(으)로 변경했습니다.`);
    } catch { setInquiries(snapshot); flash("유형 변경에 실패했습니다."); }
  };

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // 선택 문의 일괄 유형 이동
  const bulkMove = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    if (!confirm(`${ids.length}개 문의를 '${TYPE_LABEL[moveTarget] ?? moveTarget}'(으)로 이동할까요?`)) return;
    setMoving(true);
    const snapshot = inquiries;
    setInquiries(prev => prev.map(q => selected.has(q.id) ? { ...q, type: moveTarget as Inquiry["type"] } : q));
    setSelected(new Set());
    try {
      const res = await fetch("/api/admin/inquiries", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, type: moveTarget }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json().catch(() => ({}));
      flash(`${d.updated ?? ids.length}개를 ${TYPE_LABEL[moveTarget] ?? moveTarget}(으)로 이동했습니다.`);
    } catch { setInquiries(snapshot); flash("이동에 실패했습니다."); }
    finally { setMoving(false); }
  };

  // 선택 문의 일괄 삭제
  const bulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    if (!confirm(`${ids.length}개 문의를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setDeletingBulk(true);
    const snapshot = inquiries;
    setInquiries(prev => prev.filter(q => !selected.has(q.id)));
    setSelected(new Set());
    try {
      const res = await fetch("/api/admin/inquiries", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json().catch(() => ({}));
      flash(`${d.deleted ?? ids.length}개를 삭제했습니다.`);
    } catch { setInquiries(snapshot); flash("삭제에 실패했습니다."); }
    finally { setDeletingBulk(false); }
  };

  const byType = filter === "all" ? inquiries : inquiries.filter(q => (q.type as string) === filter);
  const byUnanswered = unansweredOnly ? byType.filter(isUnanswered) : byType;
  const kw = search.trim().toLowerCase();
  const filtered = kw
    ? byUnanswered.filter(q => {
        const hay = [q.payload.name, q.payload.manager, getTitle(q), getBody(q), q.payload.phone].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(kw);
      })
    : byUnanswered;
  const shown = filtered.slice(0, visible);
  const allFilteredSelected = filtered.length > 0 && filtered.every(q => selected.has(q.id));
  const toggleSelectAll = () => setSelected(allFilteredSelected ? new Set() : new Set(filtered.map(q => q.id)));

  return (
    <div>
      <InquiryTabs />
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-3xl font-bold text-gray-900">{fixedType ? "B2B 문의" : "문의 관리"}</h1>
          <p className="text-sm text-gray-500">{fixedType ? "단체복·대량구매 견적 문의를 확인하고 바로 답변합니다. 제목을 클릭하면 내용이 펼쳐집니다." : "실제 접수된 문의를 확인하고 바로 답변합니다. 제목을 클릭하면 내용이 펼쳐집니다."}</p>
        </div>
        <div className="flex items-center gap-3">
          {toast && <span className="text-sm font-medium text-green-600">{toast}</span>}
        </div>
      </div>

      {/* 탭 */}
      {!fixedType && <div className="flex gap-1 border-b border-gray-200 mb-6">
        {([["list", "접수 목록"], ["notify", "알림 설정"]] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-slate-800 text-slate-900" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {label}{t === "list" && inquiries.length > 0 ? ` (${inquiries.length.toLocaleString()})` : ""}
          </button>
        ))}
      </div>}

      {/* ── 접수 목록 ── */}
      {tab === "list" && (
        <div>
          {/* 필터 — 전체를 제외한 나머지 버튼에 위 통계 카드에서 고른 기간 기준 건수를 표기한다(기간을 바꾸면 여기 숫자도 바뀐다). */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {!fixedType && FILTERS.map(([f, label]) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${filter === f ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
                {label}{f !== "all" && <span className={filter === f ? "text-white/70" : "text-slate-400"}> ({(statsTypeCounts[f] ?? 0).toLocaleString()})</span>}
              </button>
            ))}
            <button onClick={loadInquiries}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 hover:border-slate-300 transition-colors">
            <svg className={`w-3.5 h-3.5 ${loadingList ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            새로고침
          </button>
          </div>

          {/* 문의 통계 — 기간 프리셋(왼쪽) + 검색창(오른쪽) + 미답변 건수. 유형별 집계는 아래 필터 버튼에 표기(중복 제거). 영역은 작게 유지. */}
          <div className="bg-white rounded-t-lg border border-b-0 border-slate-200 px-3.5 py-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {([["1m", "1개월"], ["3m", "3개월"], ["all", "전체"], ["custom", "직접선택"]] as const).map(([p, label]) => (
                  <button key={p} onClick={() => setStatsPeriod(p)}
                    className={`text-[11px] font-medium px-2 py-1 rounded ${statsPeriod === p ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                    {label}
                  </button>
                ))}
                {statsPeriod === "custom" && (
                  <span className="flex items-center gap-1 ml-1">
                    <input type="date" value={statsFrom} onChange={(e) => setStatsFrom(e.target.value)} className="text-[11px] border border-slate-200 rounded px-1.5 py-1" />
                    <span className="text-slate-300 text-[11px]">~</span>
                    <input type="date" value={statsTo} onChange={(e) => setStatsTo(e.target.value)} className="text-[11px] border border-slate-200 rounded px-1.5 py-1" />
                  </span>
                )}
              </div>

              {/* 검색창 — 이 영역(통계 카드)의 오른쪽에 배치 */}
              <div className="relative flex-1 min-w-[160px]">
                <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름·제목·내용·연락처 검색"
                  className="w-full border border-gray-200 rounded-lg pl-8 pr-7 py-1.5 text-[12px] focus:outline-none focus:border-blue-400" />
                {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>}
              </div>

              <button onClick={() => setUnansweredOnly((v) => !v)}
                className={`flex-shrink-0 text-[11px] font-semibold px-2 py-1 rounded ${unansweredOnly ? "bg-red-500 text-white" : "bg-red-50 text-red-600 hover:bg-red-100"}`}>
                미답변 {statsUnansweredCount.toLocaleString()}건{unansweredOnly ? " · 해제" : ""}
              </button>
            </div>
          </div>

          {/* 선택 이동 바 */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 my-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg flex-wrap">
              <span className="text-sm font-semibold text-blue-800">{selected.size.toLocaleString()}개 선택</span>
              <span className="text-xs text-slate-500">유형 이동</span>
              <select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none">
                {MOVE_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
              <button onClick={bulkMove} disabled={moving}
                className="px-4 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {moving ? "이동 중..." : "이동"}
              </button>
              <button onClick={bulkDelete} disabled={deletingBulk}
                className="px-4 py-1.5 text-sm font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
                {deletingBulk ? "삭제 중..." : "선택 삭제"}
              </button>
              <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-slate-500 hover:text-slate-700">선택 해제</button>
            </div>
          )}

          {loadingList ? (
            <div className="py-12 text-center text-slate-400 text-sm">불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm bg-white rounded-xl border border-dashed border-slate-200">
              {kw || filter !== "all" ? "조건에 맞는 문의가 없습니다." : "접수된 문의가 없습니다."}
            </div>
          ) : (
            <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[720px]">
                  {/* 헤더 */}
                  <div className="grid grid-cols-[32px_84px_128px_112px_1fr_84px] items-center gap-3 px-4 py-2.5 text-[11px] font-medium text-slate-400 border-b border-slate-100 bg-slate-50/50">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} title="전체 선택" className="w-4 h-4 accent-blue-600" />
                    <span className="text-center">유형</span><span>접수일</span><span>이름</span><span>제목</span><span className="text-right">상태</span>
                  </div>
                  {shown.map((q) => (
                    <InquiryRow key={q.id} q={q} selected={selected.has(q.id)} onToggleSelect={toggleSelect}
                      onStatus={changeStatus} onChangeType={changeType} onDelete={deleteInquiry} onSaveReply={saveReply} />
                  ))}
                </div>
              </div>
              {filtered.length > visible && (
                <button onClick={() => setVisible(v => v + 50)}
                  className="w-full py-3 text-sm font-medium text-slate-600 border-t border-slate-100 hover:bg-slate-50">
                  더 보기 ({visible.toLocaleString()} / {filtered.length.toLocaleString()})
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 알림 설정 ── */}
      {tab === "notify" && (
        loadingNotif ? (
          <div className="py-12 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
              <h2 className="font-semibold text-gray-800">담당자 이메일 알림</h2>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={notif.email_enabled}
                  onChange={e => setNotif(n => ({ ...n, email_enabled: e.target.checked }))}
                  className="w-4 h-4 accent-blue-600" />
                <span className="text-sm font-medium text-gray-700">문의 접수 시 담당자 이메일로 발송</span>
              </label>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">공통 담당자 이메일</label>
                <input type="email" value={notif.manager_email}
                  onChange={e => setNotif(n => ({ ...n, manager_email: e.target.value }))}
                  placeholder="manager@example.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                <p className="text-[11px] text-gray-400 mt-1">아래 형태별 담당자를 지정하지 않은 유형은 이 주소로 발송됩니다.</p>
              </div>

              {/* 형태별 담당자 */}
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-gray-500">게시판 형태별 담당자 <span className="text-gray-400 font-normal">(유형별로 여러 명 지정 가능)</span></p>
                {NOTIFY_TYPES.map((t) => (
                  <div key={t.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-gray-700">{t.label}</label>
                      <button onClick={() => addTypeEmail(t.key)} className="text-xs font-semibold text-blue-600 hover:text-blue-800">+ 이메일 추가</button>
                    </div>
                    {notif.emails_by_type[t.key].length === 0 ? (
                      <p className="text-[11px] text-gray-400">미지정 — 공통 담당자에게 발송됩니다.</p>
                    ) : (
                      <div className="space-y-2">
                        {notif.emails_by_type[t.key].map((em, i) => (
                          <div key={i} className="flex gap-2">
                            <input type="email" value={em} onChange={(e) => setTypeEmail(t.key, i, e.target.value)}
                              placeholder="manager@example.com"
                              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                            <button onClick={() => removeTypeEmail(t.key, i)} title="삭제"
                              className="w-9 flex items-center justify-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={saveNotif} disabled={savingNotif}
                className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {savingNotif ? "저장 중..." : "알림 설정 저장"}
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <h2 className="font-semibold text-gray-800">구글시트 · 이메일 연동 테스트</h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                버튼을 누르면 실제 연동 경로(Apps Script 웹훅)로 <b>테스트 1건</b>을 즉시 전송합니다.
                구글시트에 <b>[테스트]</b> 행이 추가되고(설정 시) 담당자 메일이 도착하면 정상입니다.
              </p>
              <button onClick={testWebhook} disabled={testing}
                className="px-5 py-2.5 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-50">
                {testing ? "전송 중..." : "테스트 전송"}
              </button>
              {testResult && (
                <p className={`text-sm mt-1 break-words ${testResult.startsWith("✅") ? "text-green-600" : "text-red-600"}`}>{testResult}</p>
              )}
              <div className="text-[11px] text-gray-400 leading-relaxed border-t border-gray-100 pt-3 mt-1 space-y-0.5">
                <p>· 시트 기록과 이메일 발송은 구글 Apps Script 웹앱 <b>하나</b>로 함께 처리됩니다(별도 메일 서비스 불필요).</p>
                <p>· 설정 방법: 저장소 <span className="font-mono">docs/google-sheet-setup.md</span> 참고 · Vercel 환경변수 <span className="font-mono">GOOGLE_SHEET_WEBHOOK_URL</span> 필요.</p>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
