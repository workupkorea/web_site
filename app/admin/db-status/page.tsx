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

interface TableListItem {
  tableName: string;
  rowEstimate: number | null;
}

interface DbStatus {
  ok: boolean;
  fetchedAt: string;
  connected: boolean;
  pingMs: number;
  counts: Record<string, TableCount>;
  recentActivity: RecentActivity[];
  projectInfo: ProjectInfo | null;
  projectInfoError?: string | null;
  projectRef: string | null;
  tableList?: TableListItem[];
  hasAccessToken?: boolean;
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

// ─── SQL 에디터 ───────────────────────────────────────────────────────────────
function SqlEditor({ projectRef, hasAccessToken }: { projectRef: string | null; hasAccessToken?: boolean }) {
  const [sql,      setSql]      = useState("SELECT * FROM members LIMIT 10;");
  const [running,  setRunning]  = useState(false);
  const [result,   setResult]   = useState<{ rows?: unknown[]; error?: string; elapsedMs?: number } | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/db-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql }),
      });
      const json = await res.json();
      setResult(json);
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setRunning(false);
    }
  };

  // 토큰 없으면 안내 배너만 표시
  if (!hasAccessToken) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-[14px] font-bold text-[#1a1a1a]">SQL 에디터</h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-[12px] text-amber-600 font-medium mb-1">SUPABASE_ACCESS_TOKEN 필요</p>
          <p className="text-[11px] text-gray-500 mb-3">
            SQL 에디터는 Supabase Management API 개인 액세스 토큰이 필요합니다.
            현재 설정된 <code className="bg-gray-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code>와 다른 별도 토큰입니다.
          </p>
          <ol className="text-[11px] text-gray-500 space-y-1 list-decimal list-inside">
            <li><a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">supabase.com/dashboard/account/tokens</a>에서 토큰 발급</li>
            <li>Vercel 환경변수에 <code className="bg-gray-100 px-1 rounded">SUPABASE_ACCESS_TOKEN</code> 이름으로 추가</li>
            <li>Vercel 재배포</li>
          </ol>
        </div>
      </div>
    );
  }

  if (!projectRef) return null;

  const cols = result?.rows?.length
    ? Object.keys(result.rows[0] as object)
    : [];

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-bold text-[#1a1a1a]">SQL 에디터</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Supabase Management API 경유 · SELECT 권장</p>
        </div>
        <button
          onClick={run}
          disabled={running || !sql.trim()}
          className="px-4 py-1.5 bg-[#1a1a1a] text-white text-[12px] font-bold rounded-lg hover:bg-[#333] disabled:opacity-50 flex items-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          {running ? "실행 중…" : "실행"}
        </button>
      </div>
      <div className="p-4">
        <textarea
          value={sql}
          onChange={e => setSql(e.target.value)}
          onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") run(); }}
          rows={4}
          className="w-full font-mono text-[12px] bg-gray-50 border border-gray-200 rounded-lg p-3 resize-y focus:outline-none focus:border-gray-400"
          placeholder="SELECT * FROM members LIMIT 10;"
        />
        <p className="text-[10px] text-gray-300 mt-1">Ctrl+Enter 로 실행</p>
      </div>

      {result && (
        <div className="border-t px-4 pb-4">
          {result.error ? (
            <div className="mt-3 bg-red-50 rounded-lg p-3">
              <p className="text-[12px] text-red-600 font-medium mb-1">오류</p>
              <p className="text-[11px] text-red-500 font-mono">{result.error}</p>
            </div>
          ) : (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-gray-500">{result.rows?.length ?? 0}행</span>
                {result.elapsedMs !== undefined && (
                  <span className="text-[11px] text-gray-400">· {result.elapsedMs}ms</span>
                )}
              </div>
              {cols.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-gray-50">
                        {cols.map(c => (
                          <th key={c} className="text-left px-3 py-2 font-semibold text-gray-500 border-b whitespace-nowrap">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(result.rows ?? []).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          {cols.map(c => (
                            <td key={c} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[200px] truncate font-mono">
                              {String((row as Record<string, unknown>)[c] ?? "NULL")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-[12px] text-gray-400">결과 없음 (쿼리 성공)</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
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
                {!data.hasAccessToken ? (
                  <p className="text-[12px] text-gray-400">
                    <code className="bg-gray-100 px-1 rounded text-[11px]">SUPABASE_ACCESS_TOKEN</code> 추가 시 플랜·리전 정보를 표시합니다.
                  </p>
                ) : data.projectInfoError ? (
                  <>
                    <p className="text-[12px] text-red-500 font-medium mb-1">조회 실패</p>
                    <p className="text-[11px] text-red-400 font-mono break-all bg-red-50 rounded p-2">
                      {data.projectInfoError}
                    </p>
                  </>
                ) : (
                  <p className="text-[12px] text-gray-400">정보 없음</p>
                )}
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

          {/* DB 테이블 목록 */}
          {data.tableList && data.tableList.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-[14px] font-bold text-[#1a1a1a]">DB 테이블 목록</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">public 스키마 · 행 수는 통계 추정값</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-[11px]">
                      <th className="text-left px-5 py-3 font-semibold border-b">테이블명</th>
                      <th className="text-right px-5 py-3 font-semibold border-b">행 수 (추정)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.tableList.map(t => (
                      <tr key={t.tableName} className="hover:bg-gray-50/50">
                        <td className="px-5 py-2.5 font-mono text-gray-700">{t.tableName}</td>
                        <td className="px-5 py-2.5 text-right text-gray-500">
                          {t.rowEstimate !== null ? t.rowEstimate.toLocaleString("ko-KR") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SQL 에디터 */}
          <SqlEditor projectRef={data.projectRef} hasAccessToken={data.hasAccessToken} />
        </>
      )}
    </div>
  );
}
