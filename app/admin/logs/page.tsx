"use client";
import { useEffect, useState, useCallback } from "react";

type Log = {
  id: number;
  actor_id: string | null;
  actor_name: string;
  action: "create" | "update" | "delete";
  resource: string;
  resource_label: string | null;
  target: string | null;
  target_id: string | null;
  summary: string;
  created_at: string;
};

// 분류 필터 목록 (로깅 시 쓰는 resource 키와 일치)
const RESOURCES: { value: string; label: string }[] = [
  { value: "all",            label: "전체 분류" },
  { value: "products",       label: "상품" },
  { value: "stores",         label: "매장" },
  { value: "members",        label: "회원" },
  { value: "brands",         label: "브랜드" },
  { value: "manufacturers",  label: "제조사" },
  { value: "catalog",        label: "카탈로그" },
  { value: "brand-catalogs", label: "브랜드 카탈로그" },
  { value: "hero-slides",    label: "메인 비주얼" },
  { value: "product-banners",label: "상세 배너" },
  { value: "site-settings",  label: "사이트 설정" },
  { value: "inquiries",      label: "문의" },
  { value: "jobs",           label: "채용공고" },
  { value: "analytics",      label: "분석/픽셀" },
  { value: "fix-logs",       label: "오류 수정 내역" },
];
const RESOURCE_LABEL: Record<string, string> = Object.fromEntries(RESOURCES.map(r => [r.value, r.label]));

const ACTION_META: Record<Log["action"], { label: string; cls: string }> = {
  create: { label: "등록", cls: "bg-green-100 text-green-700" },
  update: { label: "수정", cls: "bg-blue-100 text-blue-700" },
  delete: { label: "삭제", cls: "bg-red-100 text-red-700" },
};

function fmt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function AdminLogsPage() {
  const [rows, setRows]       = useState<Log[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);

  // 필터 입력값
  const [q, setQ]                 = useState("");
  const [appliedQ, setAppliedQ]   = useState("");
  const [action, setAction]       = useState("all");
  const [resource, setResource]   = useState("all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd]     = useState("");
  const [page, setPage]           = useState(1);
  const pageSize = 30;

  const load = useCallback(async () => {
    setLoading(true);
    setNeedsMigration(false);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (appliedQ)  params.set("q", appliedQ);
      if (action !== "all")   params.set("action", action);
      if (resource !== "all") params.set("resource", resource);
      if (dateStart) params.set("dateStart", dateStart);
      if (dateEnd)   params.set("dateEnd", dateEnd);

      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      } else {
        if (data?.needsMigration) setNeedsMigration(true);
        setRows([]); setTotal(0);
      }
    } catch {
      setRows([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, appliedQ, action, resource, dateStart, dateEnd]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isFiltered = appliedQ || action !== "all" || resource !== "all" || dateStart || dateEnd;

  const reset = () => {
    setQ(""); setAppliedQ(""); setAction("all"); setResource("all");
    setDateStart(""); setDateEnd(""); setPage(1);
  };
  const applySearch = () => { setAppliedQ(q); setPage(1); };

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">활동 로그</h1>
        <p className="text-base text-gray-400 mt-1">
          관리자가 수정한 내역을 기록합니다. 총 <span className="font-bold text-gray-700">{total.toLocaleString()}</span>건
        </p>
      </div>

      {needsMigration && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl text-base font-semibold text-amber-800">
          ⚠ audit_logs 테이블이 없습니다. <code className="bg-amber-100 px-1.5 py-0.5 rounded">supabase/migrate_add_audit_logs.sql</code> 을 Supabase SQL Editor에서 실행해주세요.
        </div>
      )}

      {/* 필터 */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100">
          <span className="text-[15px] font-semibold text-gray-600 w-20 shrink-0">검색</span>
          <input value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === "Enter" && applySearch()}
            placeholder="담당자 이름 또는 내용으로 검색 후 Enter"
            className="flex-1 border border-gray-200 px-4 py-2 text-[15px] rounded focus:outline-none focus:border-[#303236]" />
          <button onClick={applySearch}
            className="px-6 py-2 bg-[#303236] text-white text-[15px] font-semibold hover:bg-[#243d5e] rounded">검색</button>
          {isFiltered && (
            <button onClick={reset}
              className="px-4 py-2 border border-gray-200 text-[15px] text-gray-500 hover:border-gray-400 rounded">초기화</button>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-6 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-semibold text-gray-600">작업</span>
            <select value={action} onChange={e => { setAction(e.target.value); setPage(1); }}
              className="border border-gray-200 px-3 py-1.5 text-[15px] bg-white rounded focus:outline-none focus:border-[#303236]">
              <option value="all">전체</option>
              <option value="create">등록</option>
              <option value="update">수정</option>
              <option value="delete">삭제</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-semibold text-gray-600">분류</span>
            <select value={resource} onChange={e => { setResource(e.target.value); setPage(1); }}
              className="border border-gray-200 px-3 py-1.5 text-[15px] bg-white rounded focus:outline-none focus:border-[#303236]">
              {RESOURCES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[15px] font-semibold text-gray-600">기간</span>
            <input type="date" value={dateStart} onChange={e => { setDateStart(e.target.value); setPage(1); }}
              className="border border-gray-200 px-2.5 py-1.5 text-[14px] rounded focus:outline-none focus:border-[#303236]" />
            <span className="text-gray-400">~</span>
            <input type="date" value={dateEnd} onChange={e => { setDateEnd(e.target.value); setPage(1); }}
              className="border border-gray-200 px-2.5 py-1.5 text-[14px] rounded focus:outline-none focus:border-[#303236]" />
          </div>
        </div>
      </div>

      {/* 테이블 */}
      {loading ? (
        <div className="flex items-center gap-3 py-20 text-base text-gray-400">
          <span className="w-6 h-6 border-2 border-[#E5541B] border-t-transparent rounded-full animate-spin" />
          불러오는 중...
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm py-20 text-center text-gray-400 text-base">
          {isFiltered ? "조건에 맞는 로그가 없습니다." : "아직 기록된 활동 로그가 없습니다."}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["일시", "담당자", "작업", "분류", "내용"].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-[14px] font-bold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(log => {
                  const meta = ACTION_META[log.action];
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/70">
                      <td className="px-5 py-3.5 text-[14px] text-gray-500 whitespace-nowrap tabular-nums">{fmt(log.created_at)}</td>
                      <td className="px-5 py-3.5 text-[15px] font-semibold text-gray-800 whitespace-nowrap">{log.actor_name}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-[12px] font-bold rounded-full ${meta?.cls ?? "bg-gray-100 text-gray-600"}`}>
                          {meta?.label ?? log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[14px] text-gray-600 whitespace-nowrap">
                        {log.resource_label ?? RESOURCE_LABEL[log.resource] ?? log.resource}
                      </td>
                      <td className="px-5 py-3.5 text-[15px] text-gray-700">{log.summary}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-[14px] border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50">이전</button>
              <span className="px-4 text-[14px] text-gray-600">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-[14px] border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50">다음</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
