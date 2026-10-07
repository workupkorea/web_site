"use client";
import { useEffect, useMemo, useState } from "react";
import type { ChangeItem, SyncPreview } from "@/lib/wjumun-sync";

// wjumun 동기화 패널 — ① 계정 저장 ② 변경사항 확인(이전 vs 지금) ③ 승인 시에만 반영.
// 계정 비밀번호는 서버에 암호화 저장되며 이 화면으로 다시 내려오지 않는다(저장 여부만 표시).
type CredInfo = { userid: string; hasPassword: boolean; updatedAt: string | null };

type Props = {
  onClose: () => void;
  onApplied: (message: string, last: { syncedAt: string; syncedBy: string }) => void;
};

async function readJson<T>(res: Response): Promise<T & { error?: string }> {
  return res.json().catch(() => ({} as T & { error?: string }));
}

const KIND_LABEL: Record<ChangeItem["kind"], string> = { added: "신규", removed: "삭제", changed: "값 변경" };

function ItemRow({ item }: { item: ChangeItem }) {
  return (
    <li className="px-3 py-2 border border-gray-100 rounded-lg">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-semibold text-gray-900">{item.name}</span>
        <span className="font-mono text-gray-400 text-[11px]">{item.code}</span>
        {item.bulk === "set" && <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[11px] font-semibold">일괄출고 지정</span>}
        {item.bulk === "unset" && <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 text-[11px] font-semibold">일괄출고 해제</span>}
        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[11px]">{KIND_LABEL[item.kind]}</span>
        {!item.matched && (
          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[11px]">폐업·취소 추정 · 반영 안 됨</span>
        )}
      </div>
      {item.changes.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-[12px] text-gray-600">
          {item.changes.map((c) => (
            <li key={c.field}>
              <span className="text-gray-400">{c.label}</span> {c.before || "(비어있음)"} <span className="text-gray-400">→</span>{" "}
              <span className="font-semibold text-gray-900">{c.after || "(비어있음)"}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function WjumunSyncPanel({ onClose, onApplied }: Props) {
  const [cred, setCred] = useState<CredInfo | null>(null);
  const [editingCred, setEditingCred] = useState(false);
  const [userid, setUserid] = useState("");
  const [password, setPassword] = useState("");
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [busy, setBusy] = useState<"cred" | "preview" | "apply" | null>(null);
  const [error, setError] = useState("");

  const runPreview = async () => {
    setBusy("preview");
    setError("");
    setPreview(null);
    try {
      const res = await fetch("/api/admin/wjumun/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview" }),
      });
      const d = await readJson<SyncPreview>(res);
      if (!res.ok) setError(d.error ?? "가져오기에 실패했습니다.");
      else setPreview(d);
    } catch {
      setError("네트워크 오류로 가져오지 못했습니다.");
    } finally {
      setBusy(null);
    }
  };

  // 열자마자 저장된 계정이 있으면 바로 변경사항 확인을 시작한다.
  useEffect(() => {
    fetch("/api/admin/wjumun/credentials")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CredInfo | null) => {
        setCred(d);
        setUserid(d?.userid ?? "");
        if (d?.hasPassword) runPreview();
        else setEditingCred(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveCred = async () => {
    setBusy("cred");
    setError("");
    try {
      const res = await fetch("/api/admin/wjumun/credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userid, password }),
      });
      const d = await readJson<CredInfo>(res);
      if (!res.ok) {
        setError(d.error ?? "저장에 실패했습니다.");
        return;
      }
      setCred(d);
      setPassword("");
      setEditingCred(false);
      runPreview();
    } finally {
      setBusy(null);
    }
  };

  const apply = async (action: "apply" | "record" = "apply") => {
    if (!preview) return;
    setBusy("apply");
    setError("");
    try {
      const res = await fetch("/api/admin/wjumun/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, hash: preview.hash }),
      });
      const d = await readJson<{ applied?: number; bulk?: number; syncedAt: string; syncedBy: string }>(res);
      if (!res.ok) {
        setError(d.error ?? "반영에 실패했습니다.");
        if (res.status === 409) setPreview(null);
        return;
      }
      onApplied(
        action === "record" ? "wjumun 동기화 확인을 기록했습니다. (변경 없음)" : `wjumun 동기화 완료 — ${d.applied}개 지점 반영, 일괄출고금지 ${d.bulk}곳`,
        { syncedAt: d.syncedAt, syncedBy: d.syncedBy },
      );
    } catch {
      setError("네트워크 오류로 반영하지 못했습니다.");
    } finally {
      setBusy(null);
    }
  };

  // 일괄출고 변동을 맨 위로 — 통계에서 빠지거나 다시 들어오는 지점이라 가장 먼저 확인해야 한다.
  const sorted = useMemo(() => {
    const rank = (i: ChangeItem) => (i.bulk === "set" ? 0 : i.bulk === "unset" ? 1 : i.kind === "added" ? 2 : i.kind === "changed" ? 3 : 4);
    return [...(preview?.items ?? [])].sort((a, b) => rank(a) - rank(b));
  }, [preview]);
  const bulkSet = sorted.filter((i) => i.bulk === "set").length;
  const bulkUnset = sorted.filter((i) => i.bulk === "unset").length;
  const applicable = preview && (preview.items.length > 0 || preview.mode === "first");
  const canRecordCheck = !!preview && preview.items.length === 0 && preview.mode === "diff";

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); if (!busy) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <span className="font-bold text-[16px] text-gray-900">wjumun 동기화</span>
            <p className="text-xs text-gray-400 mt-0.5">가져온 데이터를 이전 데이터와 비교합니다. 승인하기 전에는 아무것도 바뀌지 않습니다.</p>
          </div>
          <button type="button" onClick={onClose} disabled={!!busy} className="text-gray-400 hover:text-gray-700 text-2xl leading-none disabled:opacity-40" aria-label="닫기">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4 text-[13px]">
          {/* 계정 */}
          {editingCred ? (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
              <p className="text-[12px] text-gray-500">
                wjumun 관리자 계정을 입력하세요. 비밀번호는 서버에 암호화되어 저장되며 화면에는 다시 표시되지 않습니다.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={userid}
                  onChange={(e) => setUserid(e.target.value)}
                  placeholder="아이디"
                  autoComplete="off"
                  className="flex-1 border border-gray-200 rounded px-2.5 py-2 text-[13px] focus:outline-none focus:border-[#303236]"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={cred?.hasPassword ? "비밀번호 (변경 시에만 입력)" : "비밀번호"}
                  autoComplete="new-password"
                  className="flex-1 border border-gray-200 rounded px-2.5 py-2 text-[13px] focus:outline-none focus:border-[#303236]"
                />
                <button
                  type="button"
                  onClick={saveCred}
                  disabled={busy !== null || !userid.trim() || (!password && !cred?.hasPassword)}
                  className="px-4 py-2 text-[13px] font-semibold bg-[#303236] text-white rounded hover:bg-[#1f2124] disabled:opacity-50"
                >
                  {busy === "cred" ? "저장 중..." : "저장 후 가져오기"}
                </button>
              </div>
            </div>
          ) : (
            cred && (
              <div className="flex items-center justify-between text-[12px] text-gray-500">
                <span>
                  저장된 계정: <span className="font-semibold text-gray-700">{cred.userid}</span>
                </span>
                <button type="button" onClick={() => setEditingCred(true)} disabled={busy !== null} className="underline hover:text-gray-800 disabled:opacity-40">
                  계정 변경
                </button>
              </div>
            )
          )}

          {error && <div className="px-4 py-2.5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>}
          {busy === "preview" && <div className="py-12 text-center text-gray-400">wjumun에서 가져와 비교하는 중... (최대 30초)</div>}

          {/* 변경 내역 */}
          {preview && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                {[
                  ["가져온 지점", `${preview.totals.fetched}곳`],
                  ["일괄출고금지", `${preview.totals.bulk}곳`],
                  ["지정 / 해제", `+${bulkSet} / -${bulkUnset}`],
                  ["폐업·취소 추정", `${preview.totals.unmatched}곳`],
                ].map(([label, value]) => (
                  <div key={label} className="px-2 py-2.5 bg-gray-50 rounded-lg">
                    <div className="text-[11px] text-gray-400">{label}</div>
                    <div className="font-bold text-gray-900">{value}</div>
                  </div>
                ))}
              </div>
              {preview.mode === "first" && (
                <p className="text-[12px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  첫 동기화입니다. 이전 기록이 없어 현재 지점 현황과 비교했습니다. 승인하면 이 데이터가 이후 비교의 기준이 됩니다.
                </p>
              )}
              {sorted.length === 0 ? (
                <div className="py-8 text-center text-gray-400">변경된 내용이 없습니다.</div>
              ) : (
                <ul className="space-y-1.5">
                  {sorted.map((item) => (
                    <ItemRow key={`${item.kind}-${item.code}`} item={item} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 flex-shrink-0">
          <button type="button" onClick={onClose} disabled={busy === "apply"} className="px-4 py-2 text-[13px] font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
            {applicable ? "취소" : "닫기"}
          </button>
          {!preview && !busy && cred?.hasPassword && !editingCred && (
            <button type="button" onClick={runPreview} className="px-4 py-2 text-[13px] font-semibold border border-gray-300 rounded-lg hover:bg-gray-50">
              다시 가져오기
            </button>
          )}
          {canRecordCheck && (
            <button
              type="button"
              onClick={() => apply("record")}
              disabled={busy !== null}
              className="px-4 py-2 text-[13px] font-semibold bg-[#303236] text-white rounded-lg hover:bg-[#1f2124] disabled:opacity-50"
            >
              {busy === "apply" ? "기록 중..." : "변경 없음 · 확인 완료 기록"}
            </button>
          )}
          {applicable && (
            <button
              type="button"
              onClick={() => apply("apply")}
              disabled={busy !== null}
              className="px-4 py-2 text-[13px] font-semibold bg-[#303236] text-white rounded-lg hover:bg-[#1f2124] disabled:opacity-50"
            >
              {busy === "apply" ? "반영 중..." : preview.items.length === 0 ? "기준 데이터로 저장" : "확인했습니다 · 승인하고 반영"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
