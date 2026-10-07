"use client";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { isBulkShip } from "@/lib/bulk-ship";

// 코드·매장명·주소는 항상 스토어관리(stores 테이블)를 그대로 보여준다 — 이 화면에서 수정 불가,
// 매장 추가/삭제도 스토어관리에서만. 담당자·연락처·출고안내번호·이메일·오픈일은 stores에 없는
// 운영 참고 정보라 site_settings(store_status)에 store_id로 매칭해 별도 저장한다.
type Supplementary = {
  manager: string;
  contact: string;
  shipNotice: string;
  email: string;
  openedAt: string;
};
type SavedRow = Supplementary & { storeId: number; code?: string; name?: string };
type StoreLite = { id: number; name: string; store_code: string | null; address: string | null };
type MergedRow = Supplementary & { storeId: number; code: string; name: string; address: string };

const SUPPLEMENTARY_COLUMNS: { key: keyof Supplementary; label: string }[] = [
  { key: "manager", label: "담당자" },
  { key: "contact", label: "연락처" },
  { key: "shipNotice", label: "출고안내번호" },
  { key: "email", label: "이메일" },
  { key: "openedAt", label: "오픈일" },
];

function buildMerged(stores: StoreLite[], saved: SavedRow[]): MergedRow[] {
  const byStoreId = new Map(saved.filter((r) => r.storeId != null).map((r) => [r.storeId, r]));
  const byCode = new Map(saved.filter((r) => r.code).map((r) => [r.code as string, r]));
  const byName = new Map(saved.filter((r) => r.name).map((r) => [r.name as string, r]));
  return stores.map((s) => {
    const match = byStoreId.get(s.id) ?? (s.store_code ? byCode.get(s.store_code) : undefined) ?? byName.get(s.name);
    return {
      storeId: s.id,
      code: s.store_code ?? "",
      name: s.name,
      address: s.address ?? "",
      manager: match?.manager ?? "",
      contact: match?.contact ?? "",
      shipNotice: match?.shipNotice ?? "",
      email: match?.email ?? "",
      openedAt: match?.openedAt ?? "",
    };
  });
}

type ExcelSupplementaryRow = Supplementary & { code: string; name: string };

// 엑셀 헤더(아이디매칭/매장명/담당자/연락처/출고안내번호/이메일/오픈일) — 이름·코드는 매칭용으로만 쓰고 저장하지 않는다.
function parseExcelRows(file: ArrayBuffer): ExcelSupplementaryRow[] {
  const wb = XLSX.read(file, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  return raw
    .map((r) => ({
      code: String(r["아이디매칭"] ?? "").trim(),
      name: String(r["매장명"] ?? "").trim(),
      manager: String(r["담당자"] ?? "").trim(),
      contact: String(r["연락처"] ?? "").trim(),
      shipNotice: String(r["출고안내번호"] ?? "").trim(),
      email: String(r["이메일"] ?? "").trim(),
      openedAt: String(r["오픈일"] ?? "").trim(),
    }))
    .filter((r) => r.name);
}

export default function StoreStatusModal({ onClose }: { onClose: () => void }) {
  const [merged, setMerged] = useState<MergedRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editStoreId, setEditStoreId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Supplementary | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  // 일괄출고금지은 공지 & 현황·통계에서 빠지므로, 여기서 따로 모아 볼 수 있게 탭으로 나눈다.
  const [tab, setTab] = useState<"all" | "bulk" | "normal">("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const showInfo = (text: string) => {
    setInfo(text);
    setTimeout(() => setInfo(""), 4000);
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/stores").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/admin/site-settings/store_status").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([stores, config]: [StoreLite[], { rows: SavedRow[]; updatedAt: string | null } | null]) => {
        setMerged(buildMerged(Array.isArray(stores) ? stores : [], config?.rows ?? []));
        setUpdatedAt(config?.updatedAt ?? null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const persist = async (next: MergedRow[]) => {
    setSaving(true);
    setError("");
    try {
      const rows: SavedRow[] = next.map((r) => ({
        storeId: r.storeId,
        manager: r.manager,
        contact: r.contact,
        shipNotice: r.shipNotice,
        email: r.email,
        openedAt: r.openedAt,
      }));
      const newUpdatedAt = new Date().toISOString();
      const res = await fetch("/api/admin/site-settings/store_status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, updatedAt: newUpdatedAt }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "저장에 실패했습니다.");
        return false;
      }
      setMerged(next);
      setUpdatedAt(newUpdatedAt);
      return true;
    } catch {
      setError("네트워크 오류로 저장에 실패했습니다.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseExcelRows(buf);
      if (parsed.length === 0) {
        setError("엑셀에서 읽은 행이 없습니다. 양식을 확인해 주세요.");
        return;
      }
      const byCode = new Map(parsed.filter((p) => p.code).map((p) => [p.code, p]));
      const byName = new Map(parsed.map((p) => [p.name, p]));
      let matchedCount = 0;
      const next = merged.map((r) => {
        const match = (r.code && byCode.get(r.code)) ?? byName.get(r.name);
        if (!match) return r;
        matchedCount++;
        return { ...r, manager: match.manager, contact: match.contact, shipNotice: match.shipNotice, email: match.email, openedAt: match.openedAt };
      });
      const unmatched = parsed.length - matchedCount;
      if (!confirm(`엑셀 ${parsed.length}개 행 중 ${matchedCount}개 매장이 매칭됩니다${unmatched > 0 ? ` (매칭 안 됨 ${unmatched}개)` : ""}. 담당자·연락처 등 참고 정보를 덮어쓸까요?`)) {
        return;
      }
      const ok = await persist(next);
      if (ok) showInfo(`${matchedCount}개 매장의 참고 정보를 반영했습니다.`);
    } catch {
      setError("엑셀 파일을 읽는 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (row: MergedRow) => {
    setEditStoreId(row.storeId);
    setDraft({ manager: row.manager, contact: row.contact, shipNotice: row.shipNotice, email: row.email, openedAt: row.openedAt });
  };

  const cancelEdit = () => {
    setEditStoreId(null);
    setDraft(null);
  };

  const saveEdit = async () => {
    if (editStoreId === null || !draft) return;
    const next = merged.map((r) => (r.storeId === editStoreId ? { ...r, ...draft } : r));
    const ok = await persist(next);
    if (ok) {
      showInfo("저장했습니다.");
      setEditStoreId(null);
      setDraft(null);
    }
  };

  const bulkCount = merged.filter((r) => isBulkShip(r.openedAt)).length;
  const visible = merged.filter((r) => (tab === "all" ? true : tab === "bulk" ? isBulkShip(r.openedAt) : !isBulkShip(r.openedAt)));
  const TABS = [
    { key: "all", label: "전체", count: merged.length },
    { key: "normal", label: "출고 대상", count: merged.length - bulkCount },
    { key: "bulk", label: "일괄출고금지", count: bulkCount },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-6xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <span className="font-bold text-[16px] text-gray-900">지점 현황</span>
            <p className="text-xs text-gray-400 mt-0.5">
              코드·매장명·주소는 스토어관리와 동기화됩니다. 담당자·연락처·이메일 등만 여기서 관리하세요.
              {updatedAt && ` · 마지막 업데이트 ${new Date(updatedAt).toLocaleString("ko-KR")}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 text-[13px] font-semibold border border-gray-200 rounded-lg hover:border-gray-300 disabled:opacity-50"
            >
              {uploading ? "업로드 중..." : "엑셀 업로드"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>

        {(info || error) && (
          <div className="px-5 pt-3 flex-shrink-0">
            {info && <div className="px-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-600 text-sm rounded-lg">{info}</div>}
            {error && <div className="px-4 py-2.5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>}
          </div>
        )}

        <div className="flex items-center gap-1.5 px-5 pt-3 flex-shrink-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-[12px] font-semibold rounded-full border ${
                tab === t.key ? "bg-[#303236] text-white border-[#303236]" : "text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {t.label} {t.count}
            </button>
          ))}
          <span className="ml-2 text-[11px] text-gray-400">일괄출고금지은 공지 &amp; 현황·통계에서 제외됩니다.</span>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : merged.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">스토어관리에 등록된 매장이 없습니다.</div>
          ) : visible.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">해당하는 지점이 없습니다.</div>
          ) : (
            <table className="w-full text-[12px] border border-gray-100 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="sticky left-0 bg-gray-50 px-2 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap z-10">
                    관리
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">코드</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">매장명</th>
                  {SUPPLEMENTARY_COLUMNS.map((c) => (
                    <th key={c.key} className="px-2 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">주소</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((r) => {
                  const isEditing = editStoreId === r.storeId;
                  return (
                    <tr key={r.storeId} className={isEditing ? "bg-amber-50/60" : "hover:bg-gray-50"}>
                      <td className={`sticky left-0 px-2 py-1.5 whitespace-nowrap ${isEditing ? "bg-amber-50/60" : "bg-white"}`}>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={saving}
                              className="px-2 py-1 text-[11px] font-semibold bg-[#303236] text-white rounded hover:bg-[#1f2124] disabled:opacity-50"
                            >
                              저장
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="px-2 py-1 text-[11px] font-semibold text-gray-500 border border-gray-200 rounded hover:bg-gray-50"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            disabled={editStoreId !== null}
                            className="px-2 py-1 text-[11px] font-semibold text-gray-600 border border-gray-200 rounded hover:border-gray-400 disabled:opacity-40"
                          >
                            수정
                          </button>
                        )}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap font-mono text-gray-500">{r.code || "-"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-gray-900 font-semibold">
                        {r.name}
                        {isBulkShip(r.openedAt) && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-semibold align-middle">일괄출고금지</span>
                        )}
                      </td>
                      {SUPPLEMENTARY_COLUMNS.map((c) => (
                        <td key={c.key} className="px-2 py-1.5 whitespace-nowrap">
                          {isEditing ? (
                            <input
                              value={draft?.[c.key] ?? ""}
                              onChange={(e) => setDraft((d) => (d ? { ...d, [c.key]: e.target.value } : d))}
                              className="w-full min-w-[80px] border border-gray-200 rounded px-1.5 py-1 text-[12px] focus:outline-none focus:border-[#303236]"
                            />
                          ) : (
                            <span className="text-gray-700">{r[c.key] || "-"}</span>
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 whitespace-nowrap text-gray-500">{r.address || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
