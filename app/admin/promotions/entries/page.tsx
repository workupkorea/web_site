export default function PromotionEntriesPage() {
  return (
    <section className="space-y-4 p-3 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">프로모션 접수</h1>
          <p className="mt-1 text-sm text-slate-600">골든벨 응모 내역을 확인하고 영수증을 검수합니다.</p>
        </div>
        <a href="/goldenbell/admin" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          검수 화면 새 탭에서 열기 ↗
        </a>
      </header>
      <iframe
        src="/goldenbell/admin?embedded=1"
        title="골든벨 접수 검수"
        className="h-[min(80dvh,58rem)] min-h-80 w-full rounded-xl border border-slate-200 bg-white"
      />
    </section>
  );
}
