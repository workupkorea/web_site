import type { Metadata } from "next";

export const metadata: Metadata = { title: "전단 스튜디오", robots: { index: false, follow: false } };
export default function PrintStudioPage() {
  return <iframe src="/api/admin/print-studio/editor" title="WORKUP 전단 스튜디오" className="fixed inset-x-0 top-12 h-[calc(100dvh-3rem)] w-full border-0 bg-white" allow="clipboard-write" />;
}
