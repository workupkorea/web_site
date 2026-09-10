"use client";

import { useEffect, useState, useCallback } from "react";

// ─── Git Push 패널 ────────────────────────────────────────────────────────────
interface GitCommit {
  sha: string;
  subject: string;
  date: string;
  author: string;
  pushed: boolean;
}

interface GitStatus {
  branch: string;
  status: string;
  ahead: number;
  lastLog: string;
  commits?: GitCommit[];
}

function GitHistoryModal({ commits, onClose }: { commits: GitCommit[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-[14px] font-bold text-[#1a1a1a]">커밋 히스토리</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-[18px] leading-none">×</button>
        </div>
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="text-gray-400 text-[10px]">
                <th className="text-left px-4 py-2.5 font-semibold border-b w-14">상태</th>
                <th className="text-left px-4 py-2.5 font-semibold border-b">메시지</th>
                <th className="text-left px-4 py-2.5 font-semibold border-b w-36">날짜</th>
                <th className="text-left px-4 py-2.5 font-semibold border-b w-16">SHA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {commits.map(c => (
                <tr key={c.sha} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {c.pushed
                      ? <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold">Push됨</span>
                      : <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-bold">미푸시</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 max-w-0">
                    <p className="truncate">{c.subject}</p>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{c.date}</td>
                  <td className="px-4 py-2.5 text-gray-400 font-mono whitespace-nowrap">{c.sha.slice(0, 7)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GitPushPanel() {
  const [git,       setGit]       = useState<GitStatus | null>(null);
  const [gitErr,    setGitErr]    = useState<string | null>(null);
  const [msg,       setMsg]       = useState("");
  const [pushing,   setPushing]   = useState(false);
  const [pushLog,   setPushLog]   = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const loadGit = useCallback(async () => {
    setGitErr(null);
    try {
      const res  = await fetch("/api/admin/git-push");
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error);
      setGit(json);
      if (!msg) setMsg("관리자 페이지 수정");
    } catch (e) {
      setGitErr(String(e));
    }
  }, [msg]);

  useEffect(() => { loadGit(); }, [loadGit]);

  const handlePush = async () => {
    if (!msg.trim()) return;
    setPushing(true);
    setPushLog(null);
    try {
      const res  = await fetch("/api/admin/git-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error);
      setPushLog(json.committed
        ? `✓ 커밋 & 푸시 완료 — ${json.lastLog}`
        : `✓ 푸시 완료 (변경사항 없음, 미푸시 커밋만 push) — ${json.lastLog}`
      );
      loadGit();
    } catch (e) {
      setPushLog(`오류: ${String(e)}`);
    } finally {
      setPushing(false);
    }
  };

  const changedFiles = git?.status ? git.status.split("\n").filter(Boolean) : [];

  return (
    <>
      {showHistory && git?.commits && (
        <GitHistoryModal commits={git.commits} onClose={() => setShowHistory(false)} />
      )}

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-[14px] font-bold text-[#1a1a1a]">Git Push</h2>
            {git && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-mono rounded">
                {git.branch}
              </span>
            )}
            {git && git.ahead > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded">
                ↑ {git.ahead}커밋 미푸시
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {git?.commits && git.commits.length > 0 && (
              <button
                onClick={() => setShowHistory(true)}
                className="text-[11px] text-blue-500 hover:text-blue-700 flex items-center gap-1"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                히스토리
              </button>
            )}
            <button onClick={loadGit} className="text-[11px] text-gray-400 hover:text-gray-600">
              새로고침
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {gitErr ? (
            <p className="text-[11px] text-red-400 font-mono bg-red-50 rounded p-2">{gitErr}</p>
          ) : !git ? (
            <p className="text-[12px] text-gray-400">불러오는 중…</p>
          ) : (
            <>
              {/* 변경 파일 목록 */}
              {changedFiles.length > 0 ? (
                <div>
                  <p className="text-[11px] text-gray-400 mb-1.5">변경된 파일 {changedFiles.length}개</p>
                  <div className="bg-gray-50 rounded-lg p-2 space-y-0.5 max-h-32 overflow-y-auto">
                    {changedFiles.map((f, i) => (
                      <p key={i} className="text-[11px] font-mono text-gray-600">{f}</p>
                    ))}
                  </div>
                </div>
              ) : git.ahead === 0 ? (
                <p className="text-[12px] text-gray-400">변경사항 없음 · 최신 상태</p>
              ) : (
                <p className="text-[12px] text-gray-500">로컬 변경 없음 · 미푸시 커밋 {git.ahead}개</p>
              )}

              {/* 커밋 메시지 + 버튼 */}
              {(changedFiles.length > 0 || git.ahead > 0) && (
                <div className="flex gap-2">
                  <input
                    value={msg}
                    onChange={e => setMsg(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handlePush(); }}
                    placeholder="커밋 메시지"
                    className="flex-1 text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
                  />
                  <button
                    onClick={handlePush}
                    disabled={pushing || !msg.trim()}
                    className="px-4 py-2 bg-[#1a1a1a] text-white text-[12px] font-bold rounded-lg hover:bg-[#333] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l7-7 7 7"/><path d="M12 5v14"/>
                    </svg>
                    {pushing ? "푸시 중…" : "커밋 & 푸시"}
                  </button>
                </div>
              )}

              {/* 결과 */}
              {pushLog && (
                <p className={`text-[11px] font-mono rounded p-2 ${pushLog.startsWith("오류") ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-700"}`}>
                  {pushLog}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────
interface Deployment {
  uid: string;
  url: string;
  state: "READY" | "ERROR" | "BUILDING" | "QUEUED" | "CANCELED" | string;
  target: "production" | "preview" | null;
  createdAt: number;
  buildingAt?: number;
  ready?: number;
  meta?: {
    githubCommitMessage?: string;
    githubCommitRef?: string;
    githubCommitSha?: string;
  };
}

interface VercelStatus {
  ok: boolean;
  fetchedAt: string;
  project: {
    name: string;
    framework: string;
    domains: string[];
    nodeVersion: string;
    accountId?: string;
  };
  deployments: Deployment[];
  errorLogs: string[];
  usage?: Record<string, unknown> | null;
  usageError?: string | null;
  needsRedeploy?: boolean;
  redeployReasons?: string[];
  envCheckAvailable?: boolean;
  error?: string;
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────
function fmtTime(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

function elapsed(from?: number, to?: number) {
  if (!from || !to) return null;
  const sec = Math.round((to - from) / 1000);
  if (sec < 60) return `${sec}초`;
  return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
}

const STATE_STYLE: Record<string, string> = {
  READY:    "bg-emerald-100 text-emerald-700",
  ERROR:    "bg-red-100 text-red-600",
  BUILDING: "bg-blue-100 text-blue-600 animate-pulse",
  QUEUED:   "bg-gray-100 text-gray-500",
  CANCELED: "bg-gray-100 text-gray-400",
};

const STATE_LABEL: Record<string, string> = {
  READY:    "배포 완료",
  ERROR:    "빌드 오류",
  BUILDING: "빌드 중",
  QUEUED:   "대기 중",
  CANCELED: "취소됨",
};

// ─── 커밋 메시지 접기/펼치기 ───────────────────────────────────────────────────
function CommitMessage({ msg }: { msg?: string }) {
  const [open, setOpen] = useState(false);
  if (!msg || msg === "—") return <span className="text-gray-400">—</span>;
  const lines = msg.split("\n");
  const hasMore = lines.length > 1 || msg.length > 60;
  const preview = lines[0].length > 60 ? lines[0].slice(0, 60) + "…" : lines[0];
  return (
    <div>
      {open ? (
        <span className="block whitespace-pre-wrap break-words text-[12px]">{msg}</span>
      ) : (
        <span className="block truncate text-[12px]">{preview}</span>
      )}
      {hasMore && (
        <button
          onClick={() => setOpen(v => !v)}
          className="mt-0.5 text-[10px] text-blue-500 hover:underline"
        >
          {open ? "접기 ▲" : "펼치기 ▼"}
        </button>
      )}
    </div>
  );
}

// ─── 사용량 값 파싱 헬퍼 ──────────────────────────────────────────────────────
function UsageRow({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  const display = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (display === "0" || display === "null" || display === "{}") return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-[12px] text-gray-500">{label}</span>
      <span className="text-[12px] font-medium text-[#1a1a1a]">{display}</span>
    </div>
  );
}

// ─── 페이지 ───────────────────────────────────────────────────────────────────
export default function VercelStatusPage() {
  const [data,       setData]       = useState<VercelStatus | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [deploying,  setDeploying]  = useState(false);
  const [deployMsg,  setDeployMsg]  = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/vercel-status");
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

  const handleDeploy = useCallback(async () => {
    const latest_ = data?.deployments[0];
    if (!latest_) return;
    if (!window.confirm("현재 프로덕션 배포를 기반으로 재배포합니다.\n계속하시겠습니까?")) return;

    setDeploying(true);
    setDeployMsg(null);
    try {
      const res = await fetch("/api/admin/vercel-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deploymentId: latest_.uid, projectName: data?.project.name }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error);
      setDeployMsg(`재배포 시작됨 — 새 배포 ID: ${json.newDeploymentId}`);
      setTimeout(() => { fetch_(); }, 5000);
    } catch (e) {
      setDeployMsg(`오류: ${String(e)}`);
    } finally {
      setDeploying(false);
    }
  }, [data, fetch_]);

  const latest = data?.deployments[0];
  const latestProd = data?.deployments.find(d => d.target === "production" && d.state === "READY");

  // 프로덕션 배포가 READY인 경우에만 배너 표시 (빌드 중·오류 시엔 숨김)
  const noDeployNeeded =
    latest?.state === "READY" &&
    latest?.target === "production";

  return (
    <div className="space-y-6 max-w-[1100px]">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#1a1a1a]">Vercel 상태</h1>
          {data && (
            <p className="text-[12px] text-gray-400 mt-1">
              마지막 조회 {new Date(data.fetchedAt).toLocaleTimeString("ko-KR", { hour12: false })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data && latest && (
            <button
              onClick={handleDeploy}
              disabled={deploying || latest.state === "BUILDING" || latest.state === "QUEUED"}
              className="px-4 py-2 bg-purple-600 text-white text-[13px] font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={deploying ? "animate-spin" : ""}>
                <path d="M5 12l7-7 7 7"/><path d="M12 5v14"/>
              </svg>
              {deploying ? "배포 중…" : "재배포"}
            </button>
          )}
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
      </div>

      {/* Git Push 패널 */}
      <GitPushPanel />

      {/* 재배포 필요 / 불필요 / 확인불가 안내 */}
      {!deployMsg && noDeployNeeded && (() => {
        // 환경변수 API 접근 불가 → 판단 불가 (회색)
        if (!data?.envCheckAvailable) {
          return (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start gap-3">
              <svg width="18" height="18" className="text-gray-400 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div>
                <p className="text-[13px] font-bold text-gray-600">재배포 필요 여부 확인 불가</p>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  VERCEL_TOKEN 권한이 환경변수 목록 조회를 허용하지 않아 정확한 판단이 불가합니다.
                  환경변수를 추가·변경했다면 재배포하세요.
                </p>
              </div>
            </div>
          );
        }
        // 환경변수 변경 감지 → 재배포 필요 (주황)
        if (data?.needsRedeploy) {
          return (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
              <svg width="18" height="18" className="text-amber-500 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div>
                <p className="text-[13px] font-bold text-amber-700">재배포가 필요합니다</p>
                <ul className="mt-1 space-y-0.5">
                  {data.redeployReasons?.map((r, i) => (
                    <li key={i} className="text-[12px] text-amber-600">• {r}</li>
                  ))}
                </ul>
              </div>
            </div>
          );
        }
        // 모두 최신 → 별도 안내 없음
        return null;
      })()}

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-[13px] text-red-700 font-mono">{error}</div>
      )}

      {/* 재배포 결과 메시지 */}
      {deployMsg && (
        <div className={`rounded-lg p-4 text-[13px] font-mono ${deployMsg.startsWith("오류") ? "bg-red-50 border border-red-200 text-red-700" : "bg-emerald-50 border border-emerald-200 text-emerald-700"}`}>
          {deployMsg}
        </div>
      )}

      {loading && !data && (
        <div className="h-40 flex items-center justify-center text-gray-400 text-[13px]">불러오는 중…</div>
      )}

      {data && (
        <>
          {/* 빌드 에러 로그 */}
          {data.errorLogs.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <h2 className="text-[13px] font-bold text-red-700 mb-3 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                빌드 에러 로그
              </h2>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {data.errorLogs.map((log, i) => (
                  <p key={i} className="text-[11px] font-mono text-red-800 bg-red-100/50 rounded px-2 py-1 break-all">{log}</p>
                ))}
              </div>
            </div>
          )}

          {/* 최근 배포 목록 */}
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-[14px] font-bold text-[#1a1a1a]">최근 배포 이력</h2>
                <a
                  href="https://vercel.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] font-medium rounded-md transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  대시보드
                </a>
              </div>
              {latestProd && (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  현재 프로덕션 SHA:
                  <span className="font-mono text-gray-600">
                    {latestProd.meta?.githubCommitSha?.slice(0, 8) ?? "—"}
                  </span>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-[11px]">
                    <th className="text-left px-4 py-3 font-semibold border-b">상태</th>
                    <th className="text-left px-4 py-3 font-semibold border-b">환경</th>
                    <th className="text-left px-4 py-3 font-semibold border-b">브랜치</th>
                    <th className="text-left px-4 py-3 font-semibold border-b">커밋 메시지</th>
                    <th className="text-left px-4 py-3 font-semibold border-b">배포 시각</th>
                    <th className="text-left px-4 py-3 font-semibold border-b">빌드 시간</th>
                    <th className="text-left px-4 py-3 font-semibold border-b">URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.deployments.map((d, i) => (
                    <tr key={d.uid} className={`hover:bg-gray-50/50 ${i === 0 ? "bg-blue-50/20" : ""}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${STATE_STYLE[d.state] ?? "bg-gray-100 text-gray-500"}`}>
                          {STATE_LABEL[d.state] ?? d.state}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {d.target === "production"
                          ? <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">PROD</span>
                          : <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">preview</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-[11px]">
                        {d.meta?.githubCommitRef ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[320px]">
                        <CommitMessage msg={d.meta?.githubCommitMessage} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtTime(d.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {(d.state === "BUILDING" || d.state === "QUEUED")
                          ? <span className="text-blue-400 text-[11px]">진행 중…</span>
                          : (elapsed(d.buildingAt, d.ready) ?? "—")}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {d.url
                          ? <a href={`https://${d.url}`} target="_blank" rel="noreferrer"
                              className="text-blue-500 hover:underline text-[11px]">열기 ↗</a>
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
