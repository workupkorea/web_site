"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type State = "READY" | "ERROR" | "BUILDING" | "QUEUED" | "CANCELED" | string;

const BADGE: Record<string, { dot: string; label: string }> = {
  READY:    { dot: "bg-emerald-400", label: "배포 완료" },
  ERROR:    { dot: "bg-red-400 animate-pulse", label: "빌드 오류" },
  BUILDING: { dot: "bg-blue-400 animate-pulse", label: "빌드 중" },
  QUEUED:   { dot: "bg-yellow-400", label: "대기 중" },
  CANCELED: { dot: "bg-gray-500", label: "취소됨" },
};

export default function VercelStatusBadge() {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const poll = () => {
      fetch("/api/admin/vercel-status")
        .then(r => r.json())
        .then(d => {
          const s = d?.deployments?.[0]?.state;
          if (s) setState(s);
          // 빌드 중이면 15초, 아니면 60초 후 재조회
          const delay = (s === "BUILDING" || s === "QUEUED") ? 15000 : 60000;
          timer = setTimeout(poll, delay);
        })
        .catch(() => { timer = setTimeout(poll, 60000); });
    };

    poll();
    return () => clearTimeout(timer);
  }, []);

  if (!state) return null;
  const b = BADGE[state] ?? { dot: "bg-gray-500", label: state };

  return (
    <Link
      href="/admin/vercel"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
      title="Vercel 배포 상태"
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${b.dot}`} />
      <span className="text-[11px] text-slate-300 font-medium hidden sm:inline">{b.label}</span>
    </Link>
  );
}
