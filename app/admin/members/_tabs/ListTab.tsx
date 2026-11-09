"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import MemberCreateForm from "./MemberCreateForm";
import TempPasswordModal from "@/components/admin/TempPasswordModal";

interface Member {
  id: number;
  email: string;
  name: string;
  phone?: string;
  memo?: string;
  grade: string;
  status: "active" | "dormant" | "withdrawn";
  last_login_at?: string;
  withdrawn_at?: string;
  created_at: string;
}

const GRADES   = ["전체", "일반회원", "VIP", "VVIP", "도매회원", "거래처", "관리자", "S관리자"];
const STATUSES = ["전체", "active", "dormant", "withdrawn"];
const STATUS_LABEL: Record<string, string> = { active: "활성", dormant: "휴면", withdrawn: "탈퇴" };
const STATUS_COLOR: Record<string, string> = {
  active:    "bg-emerald-100 text-emerald-700",
  dormant:   "bg-amber-100 text-amber-600",
  withdrawn: "bg-red-100 text-red-600",
};
const GRADE_COLOR: Record<string, string> = {
  일반회원: "bg-gray-100 text-gray-600",
  VIP:     "bg-amber-100 text-amber-700",
  VVIP:    "bg-purple-100 text-purple-700",
  도매회원:  "bg-blue-100 text-blue-700",
  거래처:   "bg-green-100 text-green-700",
  관리자:   "bg-red-100 text-red-700",
};

type AccessKey = "all" | "today" | "week" | "month" | "never";
const ACCESS_FILTERS: { key: AccessKey; label: string; color: string }[] = [
  { key: "today", label: "오늘 접속", color: "text-emerald-600" },
  { key: "week",  label: "7일 이내",  color: "text-blue-600" },
  { key: "month", label: "30일 이내", color: "text-[#303236]" },
  { key: "never", label: "미접속",    color: "text-gray-400" },
];

type SortKey = "created_at" | "email" | "name" | "phone" | "grade" | "status" | "last_login_at";
const SORT_COLUMNS: Record<string, SortKey> = {
  "가입일시": "created_at", "이메일": "email", "이름": "name", "연락처": "phone",
  "등급": "grade", "상태": "status", "접속": "last_login_at",
};

function matchAccess(key: AccessKey, iso?: string) {
  if (key === "all") return true;
  if (key === "never") return !iso;
  if (!iso) return false;
  const days = (Date.now() - new Date(iso).getTime()) / 86400000;
  return key === "today" ? days < 1 : key === "week" ? days < 7 : days < 30;
}

// 접속 경과 표시 (오늘 / N일 전 / N개월 전 …)
function daysSince(iso?: string) {
  if (!iso) return "미접속";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "오늘";
  if (days < 30) return `${days}일 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

function fmtDate(iso?: string) {
  if (!iso) return "-";
  return iso.slice(0, 16).replace("T", " ");
}

function EditModal({ member, onSave, onClose }: {
  member: Member;
  onSave: (m: Member) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ ...member });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Member, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
        <div className="px-7 py-5 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">회원 정보 수정</h2>
          <p className="text-[14px] text-gray-400 mt-0.5">{form.email}</p>
        </div>
        <div className="px-7 py-6 space-y-4">
          {([
            ["이름",   "name",  "text"],
            ["연락처", "phone", "tel"],
          ] as [string, keyof Member, string][]).map(([lbl, key, type]) => (
            <div key={key}>
              <label className="block text-[14px] font-semibold text-gray-600 mb-1.5">{lbl}</label>
              <input type={type} value={(form[key] as string) ?? ""} onChange={e => set(key, e.target.value)}
                className="w-full border border-gray-200 px-4 py-2.5 text-[15px] rounded focus:outline-none focus:border-[#303236]" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[14px] font-semibold text-gray-600 mb-1.5">등급</label>
              <select value={form.grade} onChange={e => set("grade", e.target.value)}
                className="w-full border border-gray-200 px-3 py-2.5 text-[15px] bg-white rounded focus:outline-none focus:border-[#303236]">
                {GRADES.slice(1).map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[14px] font-semibold text-gray-600 mb-1.5">상태</label>
              <select value={form.status} onChange={e => set("status", e.target.value as Member["status"])}
                className="w-full border border-gray-200 px-3 py-2.5 text-[15px] bg-white rounded focus:outline-none focus:border-[#303236]">
                <option value="active">활성</option>
                <option value="dormant">휴면</option>
                <option value="withdrawn">탈퇴</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[14px] font-semibold text-gray-600 mb-1.5">메모</label>
            <textarea value={form.memo ?? ""} onChange={e => set("memo", e.target.value)} rows={3}
              className="w-full border border-gray-200 px-4 py-2.5 text-[15px] rounded focus:outline-none focus:border-[#303236] resize-none" />
          </div>
        </div>
        <div className="px-7 py-5 border-t border-gray-200 flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-6 py-2.5 border border-gray-200 text-[15px] text-gray-600 hover:border-gray-400 rounded">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2.5 bg-[#303236] text-white text-[15px] font-bold hover:bg-[#243d5e] disabled:opacity-50 rounded">
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ListTab() {
  const [createOpen, setCreateOpen] = useState(false);
  const [members, setMembers]   = useState<Member[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tableError, setTableError] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [tempPasswordResult, setTempPasswordResult] = useState<{ member: Member; tempPassword: string } | null>(null);
  const [msg, setMsg]           = useState("");

  // 검색 필터
  const [searchType, setSearchType] = useState("name");
  const [searchQuery, setSearchQuery] = useState("");
  const [applied, setApplied]   = useState({ type: "name", query: "" });
  const [gradeFilter, setGradeFilter]   = useState("전체");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd]     = useState("");
  const [accessFilter, setAccessFilter] = useState<AccessKey>("all");
  // 정렬: 기본은 최근 접속이 위로. 헤더를 누르면 같은 열은 방향 전환, 다른 열은 해당 열 기준으로 변경
  const [sortKey, setSortKey] = useState<SortKey>("last_login_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [perPage, setPerPage]   = useState(20);
  const [page, setPage]         = useState(1);

  // 일괄 작업
  const [bulkGrade, setBulkGrade]   = useState("일반회원");
  const [bulkStatus, setBulkStatus] = useState("active");

  const showMsg = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true); setTableError(false);
    try {
      const res = await fetch("/api/admin/members");
      if (!res.ok) throw new Error();
      const d = await res.json();
      setMembers(Array.isArray(d) ? d : []);
    } catch { setTableError(true); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = [...members];
    if (applied.query) {
      const q = applied.query.toLowerCase();
      list = list.filter(m =>
        applied.type === "name"  ? m.name.toLowerCase().includes(q) :
        applied.type === "email" ? m.email.toLowerCase().includes(q) :
        (m.phone ?? "").toLowerCase().includes(q)
      );
    }
    if (gradeFilter  !== "전체") list = list.filter(m => m.grade === gradeFilter);
    if (statusFilter !== "전체") list = list.filter(m => m.status === statusFilter);
    if (dateStart) list = list.filter(m => m.created_at >= dateStart);
    if (dateEnd)   list = list.filter(m => m.created_at <= dateEnd + "T23:59:59");
    if (accessFilter !== "all") list = list.filter(m => matchAccess(accessFilter, m.last_login_at));
    list.sort((a, b) => {
      const av = (a[sortKey] ?? "") as string, bv = (b[sortKey] ?? "") as string;
      // 값이 없는 항목(미접속 등)은 방향과 무관하게 항상 아래로
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return sortDir === "desc" ? bv.localeCompare(av, "ko") : av.localeCompare(bv, "ko");
    });
    return list;
  }, [members, applied, gradeFilter, statusFilter, dateStart, dateEnd, accessFilter, sortKey, sortDir]);

  // 접속 현황 집계 (필터와 무관하게 전체 회원 기준)
  const accessCounts = useMemo(() => ({
    today: members.filter(m => matchAccess("today", m.last_login_at)).length,
    week:  members.filter(m => matchAccess("week", m.last_login_at)).length,
    month: members.filter(m => matchAccess("month", m.last_login_at)).length,
    never: members.filter(m => matchAccess("never", m.last_login_at)).length,
  }), [members]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated  = filtered.slice((page - 1) * perPage, page * perPage);

  const allSel = paginated.length > 0 && paginated.every(m => selected.has(m.id));
  const toggleAll = () => setSelected(prev => {
    const n = new Set(prev);
    if (allSel) paginated.forEach(m => n.delete(m.id));
    else         paginated.forEach(m => n.add(m.id));
    return n;
  });
  const toggleOne = (id: number) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const doBulkUpdate = async (updates: Partial<Member>) => {
    if (!selected.size) return;
    const total = selected.size;
    const results = await Promise.allSettled(
      members.filter(m => selected.has(m.id)).map(m =>
        fetch(`/api/admin/members/${m.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...m, ...updates }),
        }).then(r => { if (!r.ok) throw new Error(); })
      )
    );
    const failed = results.filter(r => r.status === "rejected").length;
    showMsg(failed ? `${total - failed}명 완료 · ${failed}명 실패` : `${total}명 일괄 업데이트 완료`);
    setSelected(new Set()); load();
  };

  const doBulkDelete = async () => {
    if (!selected.size) return;
    const total = selected.size;
    if (!confirm(`${total}명을 삭제하시겠습니까?`)) return;
    const results = await Promise.allSettled([...selected].map(id =>
      fetch(`/api/admin/members/${id}`, { method: "DELETE" }).then(r => { if (!r.ok) throw new Error(); })
    ));
    const failed = results.filter(r => r.status === "rejected").length;
    showMsg(failed ? `${total - failed}명 삭제 · ${failed}명 실패` : `${total}명 삭제 완료`);
    setSelected(new Set()); load();
  };

  const saveEdit = async (m: Member) => {
    const res = await fetch(`/api/admin/members/${m.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(m),
    });
    showMsg(res.ok ? "저장됐습니다." : "저장에 실패했습니다.");
    setEditTarget(null); load();
  };

  const resetPassword = async (m: Member) => {
    if (!confirm(`"${m.name}"(${m.email})의 비밀번호를 변경하시겠습니까?\n변경된 임시 비밀번호는 직접 전달해주셔야 합니다.`)) return;
    setResettingId(m.id);
    try {
      const res = await fetch(`/api/admin/members/${m.id}/reset-password`, { method: "POST" });
      const d = await res.json();
      if (res.ok) setTempPasswordResult({ member: m, tempPassword: d.tempPassword });
      else showMsg(d.error || "비밀번호 변경에 실패했습니다.");
    } catch {
      showMsg("비밀번호 변경에 실패했습니다.");
    }
    setResettingId(null);
  };

  const isFiltered = accessFilter !== "all" || applied.query || gradeFilter !== "전체" || statusFilter !== "전체" || dateStart || dateEnd;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">회원 조회</h1>
          </div>
          <p className="text-base text-gray-400 mt-1">총 <span className="font-bold text-gray-700">{members.length}</span>명 등록</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="min-h-[44px] px-5 bg-[#303236] text-white text-sm font-semibold rounded-lg hover:bg-[#243d5e] transition-colors">
          + 회원 직접등록
        </button>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCreateOpen(false)}>
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-gray-900">회원 직접등록</h2>
            <p className="text-sm text-gray-400 mt-1 mb-5">관리자가 직접 회원을 등록합니다.</p>
            <MemberCreateForm onCreated={() => { load(); setTimeout(() => setCreateOpen(false), 800); }} onCancel={() => setCreateOpen(false)} />
          </div>
        </div>
      )}

      {msg && <div className="px-5 py-3 bg-green-50 border border-green-200 text-green-700 text-base rounded-lg">{msg}</div>}
      {!loading && tableError && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl text-base font-semibold text-amber-800">
          ⚠ members 테이블 미설정. Supabase SQL을 먼저 실행해주세요.
        </div>
      )}

      {/* 접속 현황 — 카드를 누르면 해당 접속 기간으로 필터 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ACCESS_FILTERS.map(f => (
          <button key={f.key} onClick={() => { setAccessFilter(accessFilter === f.key ? "all" : f.key); setPage(1); }}
            aria-pressed={accessFilter === f.key}
            className={`min-h-[44px] bg-white border rounded-xl py-4 text-center transition-colors ${accessFilter === f.key ? "border-[#303236] ring-1 ring-[#303236]" : "border-gray-200 hover:border-gray-400"}`}>
            <p className="text-[14px] text-gray-500 font-medium mb-1">{f.label}</p>
            <p className={`text-3xl font-black ${f.color}`}>{loading ? "-" : accessCounts[f.key as keyof typeof accessCounts].toLocaleString()}<span className="text-[13px] font-normal text-gray-300 ml-1">명</span></p>
          </button>
        ))}
      </div>

      {/* 검색 필터 */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100">
          <span className="text-[15px] font-semibold text-gray-600 w-20 shrink-0">검색</span>
          <select value={searchType} onChange={e => setSearchType(e.target.value)}
            className="border border-gray-200 px-3 py-2 text-[15px] bg-white rounded w-28 focus:outline-none focus:border-[#303236]">
            <option value="name">이름</option>
            <option value="email">이메일</option>
            <option value="phone">연락처</option>
          </select>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (setApplied({ type: searchType, query: searchQuery }), setPage(1))}
            placeholder="검색어 입력 후 Enter"
            className="flex-1 border border-gray-200 px-4 py-2 text-[15px] rounded focus:outline-none focus:border-[#303236]" />
          <button onClick={() => { setApplied({ type: searchType, query: searchQuery }); setPage(1); }}
            className="px-6 py-2 bg-[#303236] text-white text-[15px] font-semibold hover:bg-[#243d5e] rounded">검색</button>
          {isFiltered && (
            <button onClick={() => {
              setSearchQuery(""); setApplied({ type: "name", query: "" });
              setGradeFilter("전체"); setStatusFilter("전체");
              setDateStart(""); setDateEnd(""); setAccessFilter("all"); setPage(1);
            }} className="px-4 py-2 border border-gray-200 text-[15px] text-gray-500 hover:border-gray-400 rounded">초기화</button>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-6 px-6 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-semibold text-gray-600">등급</span>
            <select value={gradeFilter} onChange={e => { setGradeFilter(e.target.value); setPage(1); }}
              className="border border-gray-200 px-3 py-1.5 text-[15px] bg-white rounded focus:outline-none focus:border-[#303236]">
              {GRADES.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-semibold text-gray-600">상태</span>
            {STATUSES.map(s => (
              <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="sts" checked={statusFilter === s}
                  onChange={() => { setStatusFilter(s); setPage(1); }}
                  className="accent-[#303236] w-4 h-4" />
                <span className="text-[15px] text-gray-700">{s === "전체" ? "전체" : STATUS_LABEL[s]}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[15px] font-semibold text-gray-600">가입일</span>
            <input type="date" value={dateStart} onChange={e => { setDateStart(e.target.value); setPage(1); }}
              className="border border-gray-200 px-2.5 py-1.5 text-[14px] rounded focus:outline-none focus:border-[#303236]" />
            <span className="text-gray-400">~</span>
            <input type="date" value={dateEnd} onChange={e => { setDateEnd(e.target.value); setPage(1); }}
              className="border border-gray-200 px-2.5 py-1.5 text-[14px] rounded focus:outline-none focus:border-[#303236]" />
          </div>
        </div>
      </div>

      {/* 결과 요약 */}
      <div className="flex items-center justify-between">
        <span className="text-[15px] text-gray-600">
          검색결과 <span className="font-bold text-[#303236] text-lg">{filtered.length}</span>명
        </span>
        <select value={perPage} onChange={e => { setPerPage(+e.target.value); setPage(1); }}
          className="border border-gray-200 px-3 py-1.5 text-[14px] bg-white rounded focus:outline-none">
          <option value={20}>20명씩</option>
          <option value={50}>50명씩</option>
          <option value={100}>100명씩</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-20 text-base text-gray-400">
          <span className="w-6 h-6 border-2 border-[#E5541B] border-t-transparent rounded-full animate-spin" />
          불러오는 중...
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* 일괄 작업 바 */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-gray-50 flex-wrap">
            {selected.size > 0 && (
              <span className="text-[15px] font-bold text-[#303236] mr-1">{selected.size}명 선택</span>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[14px] text-gray-500">등급</span>
              <select value={bulkGrade} onChange={e => setBulkGrade(e.target.value)}
                className="border border-gray-200 px-2.5 py-1.5 text-[14px] bg-white rounded focus:outline-none">
                {GRADES.slice(1).map(g => <option key={g}>{g}</option>)}
              </select>
              <button onClick={() => doBulkUpdate({ grade: bulkGrade as Member["grade"] })} disabled={!selected.size}
                className="px-3 py-1.5 text-[14px] border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 rounded">변경</button>
            </div>
            <div className="w-px h-5 bg-gray-300" />
            <div className="flex items-center gap-2">
              <span className="text-[14px] text-gray-500">상태</span>
              <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
                className="border border-gray-200 px-2.5 py-1.5 text-[14px] bg-white rounded focus:outline-none">
                <option value="active">활성</option>
                <option value="dormant">휴면</option>
                <option value="withdrawn">탈퇴</option>
              </select>
              <button onClick={() => doBulkUpdate({ status: bulkStatus as Member["status"] })} disabled={!selected.size}
                className="px-3 py-1.5 text-[14px] border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 rounded">변경</button>
            </div>
            <div className="w-px h-5 bg-gray-300" />
            <button onClick={doBulkDelete} disabled={!selected.size}
              className="px-3 py-1.5 text-[14px] border border-red-200 bg-white text-red-500 hover:bg-red-50 disabled:opacity-40 rounded">삭제</button>
          </div>

          {/* 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-4 w-10">
                    <input type="checkbox" checked={allSel} onChange={toggleAll}
                      className="w-[18px] h-[18px] accent-[#303236] cursor-pointer" />
                  </th>
                  {["가입일시", "이메일", "이름", "연락처", "메모", "등급", "상태", "접속", "관리"].map(h => {
                    const key = SORT_COLUMNS[h];
                    const on = key === sortKey;
                    return (
                      <th key={h} aria-sort={on ? (sortDir === "desc" ? "descending" : "ascending") : undefined}
                        className={`px-5 py-4 text-[13px] font-bold uppercase tracking-wide whitespace-nowrap ${h === "관리" ? "text-right" : "text-left"} ${on ? "text-[#303236]" : "text-gray-500"}`}>
                        {key ? (
                          <button type="button" className="inline-flex items-center gap-1 hover:text-[#303236]"
                            onClick={() => { if (on) setSortDir(d => d === "desc" ? "asc" : "desc"); else { setSortKey(key); setSortDir(key === "created_at" || key === "last_login_at" ? "desc" : "asc"); } setPage(1); }}>
                            {h}<span className="text-[11px]">{on ? (sortDir === "desc" ? "▼" : "▲") : "↕"}</span>
                          </button>
                        ) : h}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.length === 0 ? (
                  <tr><td colSpan={10} className="py-16 text-center text-[15px] text-gray-400">
                    {members.length === 0 ? "등록된 회원이 없습니다." : "검색 조건에 맞는 회원이 없습니다."}
                  </td></tr>
                ) : paginated.map(m => (
                  <tr key={m.id} className={selected.has(m.id) ? "bg-blue-50/60" : "hover:bg-gray-50 transition-colors"}>
                    <td className="px-4 py-4">
                      <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleOne(m.id)}
                        className="w-[18px] h-[18px] accent-[#303236] cursor-pointer" />
                    </td>
                    <td className="px-5 py-4 text-[13px] text-gray-400 whitespace-nowrap">{fmtDate(m.created_at)}</td>
                    <td className="px-5 py-4 text-[15px] text-gray-700 whitespace-nowrap">{m.email}</td>
                    <td className="px-5 py-4 text-[15px] font-bold text-gray-900 whitespace-nowrap">{m.name}</td>
                    <td className="px-5 py-4 text-[14px] text-gray-500 whitespace-nowrap">{m.phone ?? "-"}</td>
                    <td className="px-5 py-4 text-[13px] text-gray-400 max-w-[120px] truncate" title={m.memo ?? ""}>{m.memo ?? "-"}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-block whitespace-nowrap px-2.5 py-1 text-[12px] font-bold rounded-full ${GRADE_COLOR[m.grade] ?? "bg-gray-100 text-gray-600"}`}>
                        {m.grade}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-block whitespace-nowrap px-2.5 py-1 text-[12px] font-bold rounded-full ${STATUS_COLOR[m.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABEL[m.status] ?? m.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`text-[14px] font-semibold ${m.last_login_at ? "text-gray-700" : "text-gray-300"}`}>{daysSince(m.last_login_at)}</span>
                      {m.last_login_at && <span className="block text-[12px] text-gray-400">{m.last_login_at.slice(0, 16).replace("T", " ")}</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => setEditTarget(m)}
                          className="text-[14px] font-semibold text-[#303236] border border-[#303236] px-3.5 py-1.5 hover:bg-[#303236] hover:text-white rounded whitespace-nowrap">
                          수정
                        </button>
                        <button onClick={() => resetPassword(m)} disabled={resettingId === m.id}
                          className="text-[14px] font-semibold text-amber-600 border border-amber-200 px-3.5 py-1.5 hover:bg-amber-50 disabled:opacity-50 rounded whitespace-nowrap">
                          {resettingId === m.id ? "변경 중..." : "비밀번호 변경"}
                        </button>
                        <button onClick={async () => {
                          if (!confirm(`"${m.name}"을 삭제하시겠습니까?`)) return;
                          await fetch(`/api/admin/members/${m.id}`, { method: "DELETE" });
                          showMsg("삭제됐습니다."); load();
                        }} className="text-[14px] font-semibold text-red-500 border border-red-200 px-3.5 py-1.5 hover:bg-red-50 rounded whitespace-nowrap">
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setPage(1)} disabled={page === 1}
                className="px-2.5 py-1.5 text-[14px] border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 rounded">«</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-[14px] border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 rounded">‹</button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const n = Math.max(1, Math.min(page - 3, totalPages - 6)) + i;
                return n <= totalPages ? (
                  <button key={n} onClick={() => setPage(n)}
                    className={`px-3 py-1.5 text-[14px] border rounded ${page === n ? "bg-[#303236] text-white border-[#303236]" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
                    {n}
                  </button>
                ) : null;
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-[14px] border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 rounded">›</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                className="px-2.5 py-1.5 text-[14px] border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 rounded">»</button>
              <span className="ml-3 text-[14px] text-gray-400">{page} / {totalPages} 페이지</span>
            </div>
          )}
        </div>
      )}

      {editTarget && (
        <EditModal member={editTarget} onSave={saveEdit} onClose={() => setEditTarget(null)} />
      )}
      {tempPasswordResult && (
        <TempPasswordModal
          member={tempPasswordResult.member}
          tempPassword={tempPasswordResult.tempPassword}
          onClose={() => setTempPasswordResult(null)}
        />
      )}
    </div>
  );
}
