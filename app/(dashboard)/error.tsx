'use client';

/** Phase 70 — dashboard error boundary. Keeps the user inside the app on a crash. */
import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <AlertCircle className="w-10 h-10 text-[#C4724A] mb-3" />
      <h2 className="text-[18px] font-semibold text-[var(--c-text)] mb-1">Something went wrong</h2>
      <p className="text-[13px] text-[var(--c-label2)] max-w-sm mb-5">This section hit an unexpected error. Your data is safe — try reloading it.</p>
      <button onClick={reset} className="h-10 px-5 rounded-btn text-[14px] font-medium bg-[var(--c-gold)] text-white">Try again</button>
    </div>
  );
}
