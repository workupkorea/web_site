"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";

interface Member {
  id: number;
  email: string;
  name: string;
  phone?: string;
  grade: string;
  status: "active" | "dormant" | "withdrawn";
  last_login_at?: string;
  withdrawn_at?: string;
  withdrawn_reason?: string;
  created_at: string;
}

function fmtDate(iso?: string) {
  if (!iso) return "-";
  return iso.slice(0, 10);
}

export default function WithdrawnTab() {
  const [members, setMembers]   = useState<Member[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch]     = useState("");
  const [msg, setMsg]           = useState("");

  const showMsg = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/members");
    const d = await r.json();
    const withdrawn: Member[] = Array.isArray(d) ? d.filter((m: Member) => m.status === "withdrawn") : [];
    withdrawn.sort((a, b) => (b.withdrawn_at ?? "").localeCompare(a.withdrawn_at ?? ""));
    setMembers(withdrawn);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search) return members;
    const q = search.toLowerCase();
    return members.filter(m =>
      m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [members, search]);

  const allSel    = filtered.length > 0 && filtered.every(m => selected.has(m.id));
  const toggleAll = () => setSelected(prev => {
    const n = new Set(prev);
    if (allSel) filtered.forEach(m => n.delete(m.id));
    else         filtered.forEach(m => n.add(m.id));
    return n;
  });
  const toggleOne = (id: number) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const bulkDelete = async () => {
    if (!selected.size) return;
    if (!confirm(`선택된 ${selected.size}명의 데이터를 완전 삭제하시겠습니까? 복구 불가능합니다.`)) return;
    await Promise.all([...selected].map(id =>
      fetch(`/api/admin/members/${id}`, { method: "DELETE" })
    ));
    showMsg(`${selected.size}명 완전 삭제 완료`);
    setSelected(new Set()); load();
  };

  const restore = async (m: Member) => {
    if (!confirm(`"${m.name}" 회원을 활성 상태로 복원하시겠습니까?`)) return;
    await fetch(`/api/admin/members/${m.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...m, status: "active", withdrawn_at: null }),
    });
    showMsg(`"${m.name}" 복원됐습니다.`); load();
  };

  // 월별 탈퇴 통계
  const monthlyStats = useMemo(() => {
    const map: Record<string, number> = {};
    members.forEach(m => {
      const month = (m.withdrawn_at ?? m.created_at).slice(0, 7);
      map[month] = (map[month] ?? 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  }, [members]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <div>
          <h1 className="text-xl font-bold text-gray-900">회원 탈퇴 관리</h1>
        </div>
        <p className="text-sm text-gray-400">
          탈퇴 회원 — <span className="font-bold text-red-500">{members.length}</span>명
        </p>
      </div>

      {msg && <div className="px-5 py-3 bg-green-50 border border-green-200 text-green-700 text-base rounded-lg">{msg}</div>}

      <div className="grid grid-cols-2 gap-5">
        {/* 월별 탈퇴 현황 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">월별 탈퇴 현황</h2>
          {monthlyStats.length === 0 ? (
            <p className="text-[14px] text-gray-400 py-4 text-center">탈퇴 이력 없음</p>
          ) : (
            <div className="space-y-3">
              {monthlyStats.map(([month, count]) => (
                <div key={month} className="flex items-center gap-3">
                  <span className="text-[14px] text-gray-500 w-20 shrink-0">{month}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full"
                      style={{ width: `${Math.min(100, (count / (monthlyStats[0][1] || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[14px] font-bold text-red-500 w-10 text-right">{count}명</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 안내 */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex flex-col gap-3">
          <p className="text-lg font-bold text-red-800">탈퇴 회원 관리 주의사항</p>
          <ul className="text-[14px] text-red-700 space-y-2 list-disc list-inside">
            <li>탈퇴 회원 데이터는 <strong>90일</strong> 보관 후 자동 삭제를 권장합니다.</li>
            <li>개인정보 처리방침에 따라 보관 기간을 준수하세요.</li>
            <li>완전 삭제 후에는 복구가 불가능합니다.</li>
            <li>탈퇴 사유 분석을 통해 서비스를 개선하세요.</li>
          </ul>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-20 text-base text-gray-400">
          <span className="w-6 h-6 border-2 border-[#E5541B] border-t-transparent rounded-full animate-spin" />
          불러오는 중...
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* 툴바 */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              {selected.size > 0 && <span className="text-[15px] font-bold text-red-500 mr-1">{selected.size}명 선택</span>}
              <button onClick={bulkDelete} disabled={!selected.size}
                className="px-4 py-1.5 text-[14px] border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-40 rounded font-semibold">
                완전 삭제 (복구 불가)
              </button>
            </div>
            <div className="flex items-center gap-3">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="이름 또는 이메일 검색..."
                className="border border-gray-200 px-4 py-2 text-[14px] rounded focus:outline-none focus:border-[#303236] w-64" />
              <Link href="/admin/members?tab=inactive&sub=dormant"
                className="inline-flex items-center min-h-[36px] px-4 text-[14px] font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 rounded whitespace-nowrap">
                ← 휴면 회원
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-4 w-10">
                    <input type="checkbox" checked={allSel} onChange={toggleAll}
                      className="w-[18px] h-[18px] accent-[#303236] cursor-pointer" />
                  </th>
                  {["탈퇴일시", "이름", "이메일", "연락처", "등급", "탈퇴 사유", "가입일", "관리"].map(h => (
                    <th key={h} className={`px-3 py-4 text-[13px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap ${h === "관리" ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="py-20 text-center text-[15px] text-gray-400">
                    탈퇴 회원이 없습니다.
                  </td></tr>
                ) : filtered.map(m => (
                  <tr key={m.id} className={selected.has(m.id) ? "bg-red-50/40" : "hover:bg-gray-50 transition-colors"}>
                    <td className="px-4 py-4">
                      <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleOne(m.id)}
                        className="w-[18px] h-[18px] accent-[#303236] cursor-pointer" />
                    </td>
                    <td className="px-3 py-4 text-[14px] text-gray-400 whitespace-nowrap">{fmtDate(m.withdrawn_at)}</td>
                    <td className="px-3 py-4 text-[15px] font-bold text-gray-700 whitespace-nowrap">{m.name}</td>
                    <td className="px-3 py-4 text-[15px] text-gray-500 max-w-[220px] truncate" title={m.email}>{m.email}</td>
                    <td className="px-3 py-4 text-[14px] text-gray-400 whitespace-nowrap">{m.phone ?? "-"}</td>
                    <td className="px-3 py-4">
                      <span className="inline-block whitespace-nowrap px-2.5 py-1 text-[12px] font-bold rounded-full bg-gray-100 text-gray-600">{m.grade}</span>
                    </td>
                    <td className="px-3 py-4 text-[14px] text-gray-400 max-w-[160px] truncate" title={m.withdrawn_reason ?? ""}>
                      {m.withdrawn_reason ?? "-"}
                    </td>
                    <td className="px-3 py-4 text-[13px] text-gray-300 whitespace-nowrap">{fmtDate(m.created_at)}</td>
                    <td className="px-3 py-4">
                      <div className="flex flex-wrap items-center gap-1.5 justify-end min-w-[96px]">
                        <button onClick={() => restore(m)}
                          className="text-[14px] font-semibold text-emerald-600 border border-emerald-200 px-2.5 py-1.5 hover:bg-emerald-50 rounded whitespace-nowrap">
                          복원
                        </button>
                        <button onClick={async () => {
                          if (!confirm(`"${m.name}" 데이터를 완전 삭제하시겠습니까?`)) return;
                          await fetch(`/api/admin/members/${m.id}`, { method: "DELETE" });
                          showMsg("삭제됐습니다."); load();
                        }} className="text-[14px] font-semibold text-red-500 border border-red-200 px-2.5 py-1.5 hover:bg-red-50 rounded whitespace-nowrap">
                          완전삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
