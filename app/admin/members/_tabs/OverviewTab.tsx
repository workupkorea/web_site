"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

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

const GRADE_COLOR: Record<string, string> = {
  일반회원: "bg-gray-100 text-gray-600",
  VIP:     "bg-amber-100 text-amber-700",
  VVIP:    "bg-purple-100 text-purple-700",
  도매회원:  "bg-blue-100 text-blue-700",
  거래처:   "bg-green-100 text-green-700",
  관리자:   "bg-red-100 text-red-700",
};

function fmtDateTime(iso?: string) {
  if (!iso) return "-";
  return iso.slice(0, 16).replace("T", " ");
}

function isThisMonth(iso: string) {
  const now = new Date();
  const d   = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function OverviewTab() {
  const [members, setMembers]     = useState<Member[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tableError, setTableError] = useState(false);

  useEffect(() => {
    fetch("/api/admin/members")
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => setMembers(Array.isArray(d) ? d : []))
      .catch(() => setTableError(true))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => ({
    total:        members.filter(m => m.status !== "withdrawn").length,
    active:       members.filter(m => m.status === "active").length,
    dormant:      members.filter(m => m.status === "dormant").length,
    withdrawn:    members.filter(m => m.status === "withdrawn").length,
    newThisMonth: members.filter(m => m.status !== "withdrawn" && isThisMonth(m.created_at)).length,
  }), [members]);

  const recent = useMemo(() =>
    members.filter(m => m.status !== "withdrawn").slice(0, 10),
    [members]
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">회원 현황</h1>
          <p className="text-base text-gray-400 mt-1">전체 회원 현황 및 최근 가입 회원</p>
        </div>
        <Link href="/admin/members?tab=list"
          className="px-6 py-2.5 text-base bg-[#303236] text-white hover:bg-[#243d5e] rounded font-bold">
          전체 회원 조회 →
        </Link>
      </div>

      {!loading && tableError && (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-base font-semibold text-amber-800 mb-1">⚠ members 테이블 설정이 필요합니다.</p>
          <p className="text-[14px] text-amber-700">Supabase에서 아래 SQL 섹션의 스크립트를 실행해주세요.</p>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "이번달 신규", value: stats.newThisMonth, color: "text-[#E5541B]",    href: "/admin/members?tab=list" },
          { label: "전체 회원",   value: stats.total,        color: "text-[#303236]",    href: "/admin/members?tab=list" },
          { label: "활성 회원",   value: stats.active,       color: "text-emerald-600",  href: "/admin/members?tab=list" },
          { label: "휴면 회원",   value: stats.dormant,      color: "text-amber-500",    href: "/admin/members?tab=inactive&sub=dormant" },
          { label: "탈퇴 회원",   value: stats.withdrawn,    color: "text-red-500",      href: "/admin/members?tab=inactive&sub=withdrawn" },
        ].map(s => (
          <Link key={s.label} href={s.href}
            className="bg-white border border-gray-200 rounded-xl p-6 hover:border-[#303236] hover:shadow-sm transition-all text-center block">
            <p className="text-[15px] text-gray-500 font-medium mb-2">{s.label}</p>
            {loading
              ? <p className="text-3xl font-black text-gray-200 animate-pulse">---</p>
              : <p className={`text-4xl font-black ${s.color}`}>{s.value.toLocaleString()}</p>
            }
            <p className="text-[13px] text-gray-300 mt-1">명</p>
          </Link>
        ))}
      </div>

      {/* 최근 가입 회원 */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">최근 가입 회원</h2>
          <Link href="/admin/members?tab=list" className="text-[15px] text-[#303236] hover:underline font-semibold">
            전체 조회 →
          </Link>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["가입일시", "이메일", "이름", "연락처", "등급", "상태"].map(h => (
                <th key={h} className="px-6 py-3.5 text-left text-[13px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={6} className="py-14 text-center text-base text-gray-400">불러오는 중...</td></tr>
            ) : recent.length === 0 ? (
              <tr><td colSpan={6} className="py-14 text-center text-base text-gray-400">
                가입된 회원이 없습니다.
              </td></tr>
            ) : recent.map(m => (
              <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-[14px] text-gray-400 whitespace-nowrap">{fmtDateTime(m.created_at)}</td>
                <td className="px-6 py-4 text-[15px] text-gray-700 whitespace-nowrap">{m.email}</td>
                <td className="px-6 py-4 text-[15px] font-bold text-gray-900 whitespace-nowrap">{m.name}</td>
                <td className="px-6 py-4 text-[14px] text-gray-500 whitespace-nowrap">{m.phone ?? "-"}</td>
                <td className="px-6 py-4">
                  <span className={`inline-block whitespace-nowrap px-2.5 py-1 text-[12px] font-bold rounded-full ${GRADE_COLOR[m.grade] ?? "bg-gray-100 text-gray-600"}`}>
                    {m.grade}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-block whitespace-nowrap px-2.5 py-1 text-[12px] font-bold rounded-full ${
                    m.status === "active"   ? "bg-emerald-100 text-emerald-700" :
                    m.status === "dormant"  ? "bg-amber-100 text-amber-600"    :
                                              "bg-red-100 text-red-600"
                  }`}>
                    {m.status === "active" ? "활성" : m.status === "dormant" ? "휴면" : "탈퇴"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* 빠른 메뉴 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "회원 조회",     desc: "전체 회원 검색·필터·관리",  href: "/admin/members?tab=list",       icon: "🔍", border: "border-[#303236]/30" },
          { label: "휴면회원 관리", desc: "장기 미활동 회원 관리",      href: "/admin/members?tab=inactive&sub=dormant",    icon: "💤", border: "border-amber-300" },
          { label: "탈퇴 관리",     desc: "탈퇴 회원 이력 및 관리",    href: "/admin/members?tab=inactive&sub=withdrawn",  icon: "👋", border: "border-red-200" },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className={`bg-white border-2 ${item.border} rounded-xl p-5 hover:shadow-md transition-all`}>
            <p className="text-3xl mb-3">{item.icon}</p>
            <p className="text-[16px] font-bold text-gray-800">{item.label}</p>
            <p className="text-[14px] text-gray-400 mt-1">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
