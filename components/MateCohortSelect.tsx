"use client";

import { useRouter } from "next/navigation";

export default function MateCohortSelect({ value, options }: {
  value?: number;
  options: { value: number; label: string }[];
}) {
  const router = useRouter();
  return <label className="flex items-center gap-2 text-sm font-bold">
    <span className="whitespace-nowrap">모집 기수</span>
    <select className="min-h-9 min-w-32 rounded-md border border-slate-300 bg-white px-2 text-sm font-normal"
      defaultValue={value} onChange={(event) => router.push(`/admin/mate?round=${event.target.value}`)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}
