"use client";

import { useEffect, useState, useCallback } from "react";

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

  // "배포 불필요" 판단: 가장 최신 배포가 READY이고, 그게 프로덕션이면 변경 없음
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

      {/* 배포 불필요 안내 */}
      {noDeployNeeded && !deployMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
          <svg width="18" height="18" className="text-emerald-600 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <div>
            <p className="text-[13px] font-bold text-emerald-700">현재 배포가 최신 상태입니다</p>
            <p className="text-[12px] text-emerald-600 mt-0.5">
              변경사항이 없다면 재배포하지 않아도 됩니다. 코드 변경이 있을 때만 배포하세요.
            </p>
          </div>
        </div>
      )}

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
          {/* 현재 상태 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 배포 상태 */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
              <p className="text-[11px] text-gray-400 font-semibold mb-2 uppercase tracking-wide">현재 배포 상태</p>
              {latest ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-3 py-1 rounded-full text-[13px] font-bold ${STATE_STYLE[latest.state] ?? "bg-gray-100 text-gray-500"}`}>
                      {STATE_LABEL[latest.state] ?? latest.state}
                    </span>
                    {latest.target === "production" && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">PROD</span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500">{fmtTime(latest.createdAt)}</p>
                  {latest.state !== "BUILDING" && latest.state !== "QUEUED" && latest.ready && latest.buildingAt && elapsed(latest.buildingAt, latest.ready) && (
                    <p className="text-[11px] text-gray-400">빌드 소요 {elapsed(latest.buildingAt, latest.ready)}</p>
                  )}
                </>
              ) : <p className="text-[13px] text-gray-400">배포 없음</p>}
            </div>

            {/* 프로젝트 정보 */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
              <p className="text-[11px] text-gray-400 font-semibold mb-2 uppercase tracking-wide">프로젝트</p>
              <p className="text-[14px] font-bold text-[#1a1a1a] mb-1">{data.project.name}</p>
              <p className="text-[11px] text-gray-500 mb-1">Framework: {data.project.framework ?? "—"}</p>
              <p className="text-[11px] text-gray-500">Node.js {data.project.nodeVersion ?? "—"}</p>
            </div>

            {/* 도메인 */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
              <p className="text-[11px] text-gray-400 font-semibold mb-2 uppercase tracking-wide">도메인</p>
              <div className="flex flex-col gap-1">
                {data.project.domains.length > 0
                  ? data.project.domains.map(d => (
                    <a key={d} href={`https://${d}`} target="_blank" rel="noreferrer"
                      className="text-[12px] text-blue-600 hover:underline truncate">{d}</a>
                  ))
                  : <p className="text-[12px] text-gray-400">—</p>
                }
              </div>
            </div>
          </div>

          {/* Vercel 사용량 */}
          {data.usage && (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-[14px] font-bold text-[#1a1a1a]">Vercel 사용량 / 비용</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">현재 청구 기간 기준</p>
              </div>
              <div className="px-6 py-4">
                {(() => {
                  const u = data.usage as Record<string, unknown>;
                  const plan = (u.plan as Record<string, unknown>)?.name ?? u.plan;
                  const billing = (u.billing as Record<string, unknown>) ?? {};
                  const items = [
                    ["플랜", plan],
                    ["월 비용", billing.amount !== undefined ? `$${billing.amount}` : null],
                    ["빌드 분", u.buildMinutesUsed ?? (u.metrics as Record<string, unknown>)?.buildMinutes],
                    ["함수 실행", u.functionDurationUsed ?? (u.metrics as Record<string, unknown>)?.functionDuration],
                    ["대역폭", u.bandwidthUsed ?? (u.metrics as Record<string, unknown>)?.bandwidth],
                    ["요청 수", u.requestsUsed ?? (u.metrics as Record<string, unknown>)?.requests],
                  ] as [string, unknown][];

                  const hasAny = items.some(([, v]) => v !== null && v !== undefined);

                  if (!hasAny) {
                    return (
                      <div className="py-4">
                        <p className="text-[12px] text-gray-400">
                          사용량 정보를 가져올 수 없습니다.
                          팀 계정의 경우 Vercel 대시보드에서 직접 확인하세요.
                        </p>
                        <p className="text-[11px] text-gray-300 mt-1 font-mono break-all">
                          {JSON.stringify(data.usage).slice(0, 300)}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div>
                      {items.map(([label, value]) => (
                        <UsageRow key={label} label={label} value={value} />
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

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
              <h2 className="text-[14px] font-bold text-[#1a1a1a]">최근 배포 이력</h2>
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
