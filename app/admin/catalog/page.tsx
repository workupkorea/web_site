"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CatalogEditor from "@/components/admin/CatalogEditor";

export default function AdminCatalogPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400 text-sm">불러오는 중…</div>}>
      <AdminCatalogPageInner />
    </Suspense>
  );
}

function AdminCatalogPageInner() {
  const brandId = useSearchParams().get("brand") ?? "";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            카탈로그 관리
            {brandId && <span className="ml-2 text-lg text-blue-600">· 브랜드 전용 (id {brandId})</span>}
          </h1>
          <p className="text-base text-gray-400 mt-1">디지털 카탈로그(플립북) 페이지 관리</p>
        </div>
        {brandId && (
          <a href={`/brands/${brandId}/catalog`} target="_blank"
            className="px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            카탈로그 미리보기 ↗
          </a>
        )}
      </div>

      <div className="mb-6 p-4 bg-blue-50/60 border border-blue-100 rounded-xl text-sm text-slate-600 leading-relaxed">
        페이지 종류: <b>표지</b>·<b>목차</b>·<b>구분</b>은 디자인이 자동 적용되고 글자만 수정합니다. <b>이미지</b>는 직접 디자인한 페이지를 업로드합니다. <b>분할</b>은 한 페이지를 2~4칸으로 나눠 각 칸에 이미지를 배치합니다.
        <span className="block mt-1 text-xs text-slate-400">이미지 권장 비율 5:7 세로형 (예: 1000 × 1400px) · JPG/PNG · 10MB 이하</span>
      </div>

      <CatalogEditor brandId={brandId} />
    </div>
  );
}
