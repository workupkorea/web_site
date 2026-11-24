import { MATE_STYLES } from "@/lib/mate";

const feedIcons = {
  outdoor: "m2 16 5-8 3 5 3-7 5 10H2Z",
  work: "M3 8h14v9H3zM7 8V5h6v3M3 12h14",
  lifestyle: "m2 9 8-6 8 6M4 8v9h12V8m-8 9v-5h4v5",
} satisfies Record<keyof typeof MATE_STYLES, string>;

export default function MateFeedStyleIcon({ style }: { style: keyof typeof MATE_STYLES }) {
  return <svg role="img" aria-label={MATE_STYLES[style]} viewBox="0 0 20 20" className="size-4 shrink-0 text-slate-700"
    fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <title>{MATE_STYLES[style]}</title>
    <path d={feedIcons[style]} />
  </svg>;
}
