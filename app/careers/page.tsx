import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase-server";
import CareersClient from "./_components/CareersClient";

export const metadata: Metadata = {
  title: "채용공고 — 워크업",
  description: "워크업 전국 매장 채용공고. 함께 일할 워크업 팀원을 찾습니다.",
};

type Job = {
  id: number;
  store_id: number;
  title: string;
  employment_type: string;
  salary_info: string;
  description: string;
  requirements: string;
  deadline: string | null;
  is_active: boolean;
  created_at: string;
  stores: {
    id: number;
    name: string;
    region: string;
    address: string;
    phone: string;
  } | null;
};

async function getJobs(): Promise<Job[]> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("store_jobs")
    .select("*, stores(id, name, region, address, phone)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (!data) return [];
  return data.filter((j: Job) => !j.deadline || j.deadline >= today);
}

export default async function CareersPage() {
  const jobs = await getJobs();
  const regions = Array.from(new Set(jobs.map((j) => j.stores?.region).filter(Boolean))).sort() as string[];

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-[#303236] text-white">
        <div className="max-w-4xl mx-auto px-5 py-12">
          <p className="text-sm font-semibold text-blue-300 mb-2">WORKUP CAREERS</p>
          <h1 className="text-3xl font-bold mb-3">함께 일할 팀원을 찾습니다</h1>
          <p className="text-blue-200 text-base">
            전국 {jobs.length > 0 ? jobs.length : "다수"}개 매장에서 워크업과 함께할 인재를 모집합니다.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-8">
        {jobs.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl py-20 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-700 mb-1">현재 모집 중인 공고가 없습니다.</p>
            <p className="text-sm text-gray-400">새로운 공고가 올라오면 이 페이지에서 확인하세요.</p>
            <Link
              href="/store"
              className="inline-block mt-6 px-6 py-3 bg-[#303236] text-white text-sm font-semibold rounded-xl hover:bg-[#243a63] transition-colors"
            >
              전국 매장 찾기
            </Link>
          </div>
        ) : (
          <CareersClient jobs={jobs} regions={regions} />
        )}
      </div>
    </main>
  );
}
