import type { ReactNode } from "react";

export default function ActivitySummary({ label, fields }: {
  label: string;
  fields: { label: ReactNode; value: string; emphasize?: boolean }[];
}) {
  return <dl aria-label={label} className="grid grid-cols-[repeat(auto-fit,minmax(106px,1fr))] gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200">
    {fields.map(({ label, value, emphasize }, index) => <div key={index} className={`min-w-0 px-3 py-2 ${emphasize ? "bg-slate-100" : "bg-white"}`}>
      <dt className="text-xs font-medium text-slate-600">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-bold tabular-nums">{value}</dd>
    </div>)}
  </dl>;
}
