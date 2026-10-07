"use client";
import { useEffect, useMemo, useState, useCallback } from "react";

type PassRow = { store_id: number; store_name: string; store_code: string | null; status: "출고" | "패스"; updated_at: string | null };

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}/${day} ${h}:${min}`;
}

export default function PassEntriesTable({ noticeId, noticeDate }: { noticeId: string; noticeDate: string }) {
  const [rows, setRows] = useState<PassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"전체" | "출고" | "패스">("전체");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/notices/${noticeId}/pass-entries`);
      const data = await res.json();
      if (res.ok) setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [noticeId]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      출고: rows.filter((r) => r.status === "출고").length,
      패스: rows.filter((r) => r.status === "패스").length,
    }),
    [rows]
  );

  const filteredRows = useMemo(() => {
    let list = rows;
    if (filter !== "전체") list = list.filter((r) => r.status === filter);
    if (query.trim()) list = list.filter((r) => r.store_name.includes(query.trim()));
    // 패스 우선 → 가나다순
    return [...list].sort((a, b) => {
      if (a.status === "패스" && b.status !== "패스") return -1;
      if (a.status !== "패스" && b.status === "패스") return 1;
      return a.store_name.localeCompare(b.store_name, "ko");
    });
  }, [rows, filter, query]);

  if (loading) return <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 flex-wrap">
          {(["전체", "출고", "패스"] as const).map((f) => {
            const count = f === "전체" ? stats.total : stats[f];
            const active = filter === f;
            const colorCls =
              f === "출고"
                ? active ? "bg-emerald-600 text-white border-emerald-600" : "text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                : f === "패스"
                ? active ? "bg-amber-500 text-white border-amber-500" : "text-amber-600 border-amber-200 hover:bg-amber-50"
                : active ? "bg-[#303236] text-white border-[#303236]" : "text-gray-600 border-gray-200 hover:bg-gray-50";
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-full border transition-colors ${colorCls}`}
              >
                <span>{f}</span>
                <span className={`text-[11px] font-bold ${active ? "opacity-80" : ""}`}>{count}</span>
              </button>
            );
          })}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="지점명 검색"
            className="flex-1 min-w-[120px] border border-gray-200 rounded-full px-3 py-1.5 text-sm focus:outline-none focus:border-[#303236]"
          />
        </div>
      </div>
      <div className="overflow-auto max-h-[calc(100vh-420px)]">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
            <tr>
              <th className="px-3 py-3 text-left whitespace-nowrap text-[12px] font-bold text-gray-500 uppercase">지점명</th>
              <th className="px-3 py-3 text-left whitespace-nowrap text-[12px] font-bold text-gray-500 uppercase">상태</th>
              <th className="px-3 py-3 text-left whitespace-nowrap text-[12px] font-bold text-gray-500 uppercase">변경 시각</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRows.map((r) => (
              <tr key={r.store_id}>
                <td className="px-3 py-3 text-sm text-gray-900 whitespace-nowrap">{r.store_name}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span
                    className={`inline-block whitespace-nowrap px-2.5 py-0.5 text-[12px] font-semibold rounded-full ${
                      r.status === "패스" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-sm text-gray-400 font-mono whitespace-nowrap">{fmtTime(r.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
