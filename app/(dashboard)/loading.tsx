/** Phase 70 — dashboard route-segment loading fallback (no blank flash on navigation). */
export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-48 rounded-lg bg-[rgba(15,29,46,0.06)]" />
      <div className="h-4 w-80 rounded bg-[rgba(15,29,46,0.05)]" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-[14px] bg-[rgba(15,29,46,0.05)]" />)}
      </div>
      <div className="space-y-2 mt-4">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 rounded-[10px] bg-[rgba(15,29,46,0.04)]" />)}
      </div>
    </div>
  );
}
