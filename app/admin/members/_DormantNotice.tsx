"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { isDormantCandidate } from "@/lib/member-dormancy";

// 회원관리 진입 시 휴면 대상(1년 이상 미접속) 인원을 알리는 배너. 전환은 관리자가 휴면 탭에서 직접 한다.
export default function DormantNotice() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch("/api/admin/members")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setCount(d.filter(m => isDormantCandidate(m)).length); })
      .catch(() => {});
  }, []);

  if (!count) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-amber-50 border border-amber-200 rounded-lg text-[15px] text-amber-800">
      <span>1년 이상 미접속한 휴면 대상 회원이 <b>{count}명</b> 있습니다.</span>
      <Link href="/admin/members?tab=inactive" className="min-h-[44px] inline-flex items-center px-3 font-semibold underline">휴면·탈퇴 탭에서 확인</Link>
    </div>
  );
}
