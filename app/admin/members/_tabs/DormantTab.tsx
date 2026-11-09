"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import TempPasswordModal from "@/components/admin/TempPasswordModal";

interface Member {
  id: number;
  email: string;
  name: string;
  phone?: string;
  grade: string;
  status: "active" | "dormant" | "withdrawn";
  last_login_at?: string;
  created_at: string;
}

function daysSince(iso?: string) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function fmtDate(iso?: string) {
  if (!iso) return "-";
  return iso.slice(0, 10);
}

export default function DormantTab() {
  const [members, setMembers]   = useState<Member[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [msg, setMsg]           = useState("");
  const [marking, setMarking]   = useState(false);
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [tempPasswordResult, setTempPasswordResult] = useState<{ member: Member; tempPassword: string } | null>(null);

  const showMsg = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/members");
    const d = await r.json();
    setMembers(Array.isArray(d) ? d : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // 휴면 회원: status = 'dormant' + 활성이지만 1년 이상 미접속
  const dormant = useMemo(() => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return members.filter(m =>
      m.status === "dormant" ||
      (m.status === "active" && (!m.last_login_at || new Date(m.last_login_at) < oneYearAgo))
    );
  }, [members]);

  const allSel   = dormant.length > 0 && dormant.every(m => selected.has(m.id));
  const toggleAll = () => setSelected(prev => {
    const n = new Set(prev);
    if (allSel) dormant.forEach(m => n.delete(m.id));
    else         dormant.forEach(m => n.add(m.id));
    return n;
  });
  const toggleOne = (id: number) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const markAsDormant = async () => {
    if (!confirm("현재 활성 상태이지만 1년 이상 미접속한 회원을 휴면 처리하시겠습니까?")) return;
    setMarking(true);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const targets = members.filter(m =>
      m.status === "active" && (!m.last_login_at || new Date(m.last_login_at) < oneYearAgo)
    );
    await Promise.all(targets.map(m =>
      fetch(`/api/admin/members/${m.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...m, status: "dormant" }),
      })
    ));
    setMarking(false);
    showMsg(`${targets.length}명 휴면 처리됐습니다.`);
    load();
  };

  const bulkRestore = async () => {
    if (!selected.size) return;
    if (!confirm(`선택된 ${selected.size}명을 활성 상태로 복원하시겠습니까?`)) return;
    await Promise.all([...selected].map(id => {
      const m = members.find(x => x.id === id);
      if (!m) return;
      return fetch(`/api/admin/members/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...m, status: "active" }),
      });
    }));
    showMsg(`${selected.size}명 복원 완료`);
    setSelected(new Set()); load();
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

  const bulkDelete = async () => {
    if (!selected.size) return;
    if (!confirm(`선택된 ${selected.size}명을 삭제하시겠습니까?`)) return;
    await Promise.all([...selected].map(id =>
      fetch(`/api/admin/members/${id}`, { method: "DELETE" })
    ));
    showMsg(`${selected.size}명 삭제 완료`);
    setSelected(new Set()); load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">휴면회원 관리</h1>
          </div>
          <p className="text-base text-gray-400 mt-1">
            status가 휴면이거나 1년 이상 미접속인 회원 —&nbsp;
            <span className="font-bold text-amber-600">{dormant.length}</span>명
          </p>
        </div>
        <button onClick={markAsDormant} disabled={marking}
          className="px-5 py-2.5 text-base bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 rounded font-bold">
          {marking ? "처리 중..." : "미접속 1년↑ 자동 휴면 처리"}
        </button>
      </div>

      {msg && <div className="px-5 py-3 bg-green-50 border border-green-200 text-green-700 text-base rounded-lg">{msg}</div>}

      {/* 안내 — 기본 접힘 */}
      <details className="group bg-amber-50 border border-amber-200 rounded-xl">
        <summary className="flex items-center gap-3 min-h-[44px] px-5 py-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <span className="text-xl">💤</span>
          <span className="text-base font-bold text-amber-800">휴면 회원 기준</span>
          <span className="ml-auto text-amber-600 text-sm transition-transform group-open:rotate-180">▼</span>
        </summary>
        <div className="px-5 pb-4 pl-14">
          <ul className="text-[14px] text-amber-700 space-y-0.5 list-disc list-inside">
            <li>status가 &ldquo;dormant&rdquo;로 설정된 회원</li>
            <li>status가 &ldquo;active&rdquo;이지만 마지막 접속일로부터 1년 이상 경과한 회원</li>
          </ul>
          <p className="text-[13px] text-amber-600 mt-1.5">휴면 회원의 데이터는 보관되며, 복원 버튼으로 언제든지 활성화할 수 있습니다.</p>
        </div>
      </details>

      {loading ? (
        <div className="flex items-center gap-3 py-20 text-base text-gray-400">
          <span className="w-6 h-6 border-2 border-[#E5541B] border-t-transparent rounded-full animate-spin" />
          불러오는 중...
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* 일괄 작업 */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-gray-50">
            {selected.size > 0 && <span className="text-[15px] font-bold text-[#303236] mr-1">{selected.size}명 선택</span>}
            <button onClick={bulkRestore} disabled={!selected.size}
              className="px-4 py-1.5 text-[14px] border border-emerald-300 bg-white text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 rounded">
              활성 복원
            </button>
            <button onClick={bulkDelete} disabled={!selected.size}
              className="px-4 py-1.5 text-[14px] border border-red-200 bg-white text-red-500 hover:bg-red-50 disabled:opacity-40 rounded">
              삭제
            </button>
            <Link href="/admin/members?tab=inactive&sub=withdrawn"
              className="ml-auto inline-flex items-center min-h-[36px] px-4 text-[14px] font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 rounded">
              탈퇴 회원 →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-4 w-10">
                    <input type="checkbox" checked={allSel} onChange={toggleAll}
                      className="w-[18px] h-[18px] accent-[#303236] cursor-pointer" />
                  </th>
                  {["이름", "이메일", "연락처", "등급", "상태", "마지막 접속", "가입일", "휴면 기간", "관리"].map(h => (
                    <th key={h} className={`px-3 py-4 text-[13px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap ${h === "관리" ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dormant.length === 0 ? (
                  <tr><td colSpan={10} className="py-20 text-center text-[15px] text-gray-400">
                    휴면 회원이 없습니다.
                  </td></tr>
                ) : dormant.map(m => {
                  const days = daysSince(m.last_login_at ?? m.created_at);
                  return (
                    <tr key={m.id} className={selected.has(m.id) ? "bg-amber-50/60" : "hover:bg-gray-50 transition-colors"}>
                      <td className="px-4 py-4">
                        <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleOne(m.id)}
                          className="w-[18px] h-[18px] accent-[#303236] cursor-pointer" />
                      </td>
                      <td className="px-3 py-4 text-[15px] font-bold text-gray-900 whitespace-nowrap">{m.name}</td>
                      <td className="px-3 py-4 text-[15px] text-gray-600 max-w-[220px] truncate" title={m.email}>{m.email}</td>
                      <td className="px-3 py-4 text-[14px] text-gray-500 whitespace-nowrap">{m.phone ?? "-"}</td>
                      <td className="px-3 py-4">
                        <span className="inline-block whitespace-nowrap px-2.5 py-1 text-[12px] font-bold rounded-full bg-gray-100 text-gray-600">{m.grade}</span>
                      </td>
                      <td className="px-3 py-4">
                        <span className={`inline-block whitespace-nowrap px-2.5 py-1 text-[12px] font-bold rounded-full ${m.status === "dormant" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                          {m.status === "dormant" ? "휴면" : "미접속"}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-[14px] text-gray-400 whitespace-nowrap">{fmtDate(m.last_login_at)}</td>
                      <td className="px-3 py-4 text-[14px] text-gray-400 whitespace-nowrap">{fmtDate(m.created_at)}</td>
                      <td className="px-3 py-4">
                        <span className={`text-[14px] font-bold ${days && days > 730 ? "text-red-500" : "text-amber-600"}`}>
                          {days != null ? `${days}일` : "-"}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap items-center gap-1.5 justify-end min-w-[96px]">
                          <button onClick={async () => {
                            await fetch(`/api/admin/members/${m.id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ ...m, status: "active" }),
                            });
                            showMsg(`"${m.name}" 복원됐습니다.`); load();
                          }} className="text-[14px] font-semibold text-emerald-600 border border-emerald-200 px-2.5 py-1.5 hover:bg-emerald-50 rounded whitespace-nowrap">
                            복원
                          </button>
                          <button onClick={() => resetPassword(m)} disabled={resettingId === m.id}
                            className="text-[14px] font-semibold text-amber-600 border border-amber-200 px-2.5 py-1.5 hover:bg-amber-50 disabled:opacity-50 rounded whitespace-nowrap">
                            {resettingId === m.id ? "변경 중..." : "비밀번호 변경"}
                          </button>
                          <button onClick={async () => {
                            if (!confirm(`"${m.name}"을 삭제하시겠습니까?`)) return;
                            await fetch(`/api/admin/members/${m.id}`, { method: "DELETE" });
                            showMsg("삭제됐습니다."); load();
                          }} className="text-[14px] font-semibold text-red-500 border border-red-200 px-2.5 py-1.5 hover:bg-red-50 rounded whitespace-nowrap">
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
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
