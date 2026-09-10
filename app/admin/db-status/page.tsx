"use client";

import { useEffect, useState, useCallback } from "react";

// ─── 타입 ─────────────────────────────────────────────────────────────────────
interface TableCount {
  label: string;
  count: number | null;
}

interface RecentActivity {
  table: string;
  label: string;
  updatedAt: string;
  id: unknown;
}

interface ProjectInfo {
  name: string;
  region: string;
  plan: string;
  status: string;
  dbVersion: string;
}

interface DbStatus {
  ok: boolean;
  fetchedAt: string;
  connected: boolean;
  pingMs: number;
  counts: Record<string, TableCount>;
  recentActivity: RecentActivity[];
  projectInfo: ProjectInfo | null;
  projectRef: string | null;
  error?: string;
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function fmtCount(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("ko-KR");
}

// ─── 페이지 ───────────────────────────────────────────────────────────────────
export default function DbStatusPage() {
  const [data,    setData]    = useState<DbStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/db-status");
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "알 수 없는 오류");
      setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  return (
    <div className="space-y-6 max-w-[900px]">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#1a1a1a]">DB 상태</h1>
          {data && (
            <p className="text-[12px] text-gray-400 mt-1">
              마지막 조회 {new Date(data.fetchedAt).toLocaleTimeString("ko-KR", { hour12: false })}
            </p>
          )}
        </div>
        <button
          onClick={fetch_}
          disabled={loading}
          className="px-4 py-2 bg-[#1a1a1a] text-white text-[13px] font-bold rounded-lg hover:bg-[#333] disabled:opacity-50 flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={loading ? "animate-spin" : ""}>
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
            <path d="M16 16h5v5"/>
          </svg>
          {loading ? "조회 중…" : "새로고침"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-[13px] text-red-700 font-mono">{error}</div>
      )}

      {loading && !data && (
        <div className="h-40 flex items-center justify-center text-gray-400 text-[13px]">불러오는 중…</div>
      )}

      {data && (
        <>
          {/* 연결 상태 + 프로젝트 정보 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 연결 상태 */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
              <p className="text-[11px] text-gray-400 font-semibold mb-3 uppercase tracking-wide">Supabase 연결</p>
              <div className="flex items-center gap-3 mb-4">
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${data.connected ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`} />
                <span className={`text-[15px] font-bold ${data.connected ? "text-emerald-700" : "text-red-600"}`}>
                  {data.connected ? "연결됨" : "연결 실패"}
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[12px] text-gray-500">응답 속도</span>
                  <span className={`text-[12px] font-medium ${data.pingMs < 200 ? "text-emerald-600" : data.pingMs < 500 ? "text-yellow-600" : "text-red-600"}`}>
                    {data.pingMs}ms
                  </span>
                </div>
                {data.projectRef && (
                  <div className="flex justify-between">
                    <span className="text-[12px] text-gray-500">Project Ref</span>
                    <span className="text-[12px] font-mono text-gray-600">{data.projectRef}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 프로젝트 정보 */}
            {data.projectInfo ? (
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                <p className="text-[11px] text-gray-400 font-semibold mb-3 uppercase tracking-wide">Supabase 프로젝트</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[12px] text-gray-500">프로젝트명</span>
                    <span className="text-[12px] font-medium text-[#1a1a1a]">{data.projectInfo.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[12px] text-gray-500">플랜</span>
                    <span className={`text-[12px] font-bold px-2 py-0.5 rounded ${
                      data.projectInfo.plan?.toLowerCase().includes("pro")
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>{data.projectInfo.plan || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[12px] text-gray-500">리전</span>
                    <span className="text-[12px] text-gray-600">{data.projectInfo.region || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[12px] text-gray-500">상태</span>
                    <span className={`text-[12px] font-medium ${
                      data.projectInfo.status === "ACTIVE_HEALTHY" ? "text-emerald-600" : "text-yellow-600"
                    }`}>{data.projectInfo.status || "—"}</span>
                  </div>
                  {data.projectInfo.dbVersion && (
                    <div className="flex justify-between">
                      <span className="text-[12px] text-gray-500">DB 버전</span>
                      <span className="text-[12px] text-gray-600">{data.projectInfo.dbVersion}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-dashed border-gray-200 rounded-xl p-5">
                <p className="text-[11px] text-gray-400 font-semibold mb-2 uppercase tracking-wide">Supabase 프로젝트</p>
                <p className="text-[12px] text-gray-400">
                  Management API 조회 불가
                </p>
                <p className="text-[11px] text-gray-300 mt-1">
                  Vercel 환경변수에 <code className="bg-gray-100 px-1 rounded">SUPABASE_ACCESS_TOKEN</code>을 추가하면 플랜·리전 등을 표시합니다.
                </p>
              </div>
            )}
          </div>

          {/* 테이블 레코드 수 */}
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="text-[14px] font-bold text-[#1a1a1a]">테이블 레코드 수</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 divide-x divide-y divide-gray-100">
              {Object.entries(data.counts).map(([key, { label, count }]) => (
                <div key={key} className="p-5">
                  <p className="text-[11px] text-gray-400 mb-1">{label}</p>
                  <p className={`text-[22px] font-black ${count === null ? "text-gray-300" : "text-[#1a1a1a]"}`}>
                    {fmtCount(count)}
                  </p>
                  <p className="text-[10px] text-gray-300 font-mono mt-1">{key}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 최근 DB 활동 */}
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="text-[14px] font-bold text-[#1a1a1a]">최근 DB 활동</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">각 테이블의 가장 최근 변경 기준</p>
            </div>
            {data.recentActivity.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400 text-[13px]">
                최근 활동 없음
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.recentActivity.map((item, i) => (
                  <div key={i} className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                      <div>
                        <span className="text-[13px] font-medium text-[#1a1a1a]">{item.label}</span>
                        <span className="ml-2 text-[11px] font-mono text-gray-400">{item.table}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-[12px] text-gray-600">{timeAgo(item.updatedAt)}</p>
                      <p className="text-[10px] text-gray-400">{fmtDateTime(item.updatedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
