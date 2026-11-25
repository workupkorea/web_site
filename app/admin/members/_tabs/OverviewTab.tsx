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
    <div className="space-y-2">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-xl font-bold text-gray-900">회원 현황</h1>
        </div>
        <Link href="/admin/members?tab=list"
          className="inline-flex min-h-11 items-center bg-[var(--admin-accent)] px-3 text-sm font-semibold text-white hover:bg-[var(--admin-accent-hover)] sm:min-h-9">
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          { label: "이번달 신규", value: stats.newThisMonth, color: "text-[var(--admin-accent)]", href: "/admin/members?tab=list" },
          { label: "전체 회원",   value: stats.total,        color: "text-[#303236]",    href: "/admin/members?tab=list" },
          { label: "활성 회원",   value: stats.active,       color: "text-emerald-600",  href: "/admin/members?tab=list" },
          { label: "휴면 회원",   value: stats.dormant,      color: "text-amber-500",    href: "/admin/members?tab=inactive&sub=dormant" },
          { label: "탈퇴 회원",   value: stats.withdrawn,    color: "text-red-500",      href: "/admin/members?tab=inactive&sub=withdrawn" },
        ].map(s => (
          <Link key={s.label} href={s.href}
            className="flex flex-wrap items-baseline justify-center gap-x-1.5 border border-[var(--admin-line)] bg-white px-2 py-1.5 transition-colors hover:border-[var(--admin-accent)]">
            <p className="text-[13px] text-gray-500 font-medium">{s.label}</p>
            {loading
              ? <p className="text-xl font-black text-gray-200 animate-pulse">---</p>
              : <p className={`text-2xl font-black leading-none ${s.color}`}>{s.value.toLocaleString()}</p>
            }
            <p className="text-[12px] text-gray-300">명</p>
          </Link>
        ))}
      </div>

      {/* 최근 가입 회원 */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--admin-line)] px-3 py-2">
          <h2 className="text-base font-bold text-slate-900">최근 가입 회원</h2>
          <Link href="/admin/members?tab=list" className="text-[15px] text-[#303236] hover:underline font-semibold">
            전체 조회 →
          </Link>
        </div>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="최근 가입 회원 표">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["가입일시", "이메일", "이름", "연락처", "등급", "상태"].map(h => (
                <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 text-[13px] font-bold text-slate-600">{h}</th>
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
              <tr key={m.id} className="hover:bg-gray-50 transition-colors [&>td]:px-3 [&>td]:py-1.5">
                <td className="whitespace-nowrap text-[13px] tabular-nums text-gray-500">{fmtDateTime(m.created_at)}</td>
                <td className="whitespace-nowrap text-[14px] text-gray-700">{m.email}</td>
                <td className="whitespace-nowrap text-[14px] font-bold text-gray-900">{m.name}</td>
                <td className="whitespace-nowrap text-[13px] tabular-nums text-gray-500">{m.phone ?? "-"}</td>
                <td>
                  <span className={`inline-block whitespace-nowrap px-2.5 py-1 text-[12px] font-bold rounded-full ${GRADE_COLOR[m.grade] ?? "bg-gray-100 text-gray-600"}`}>
                    {m.grade}
                  </span>
                </td>
                <td>
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
      <nav aria-label="회원 관리 바로가기" className="grid w-full grid-cols-3 gap-2">
        {[
          { label: "회원 조회", href: "/admin/members?tab=list" },
          { label: "휴면회원 관리", href: "/admin/members?tab=inactive&sub=dormant" },
          { label: "탈퇴 관리", href: "/admin/members?tab=inactive&sub=withdrawn" },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="flex min-h-11 items-center justify-center border border-[var(--admin-line)] bg-white px-2 py-2 text-center text-[13px] font-semibold text-slate-700 transition-colors hover:border-[var(--admin-accent)] hover:text-[var(--admin-accent)]">
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
