'use client';

/** Phase 70 — root error boundary. Never leaves a blank/unstyled crash screen. */
import { useEffect } from 'react';

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#F5F5F7', fontFamily: '-apple-system,Segoe UI,Roboto,sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#0F1D2E' }}>Something went wrong</p>
        <p style={{ fontSize: 13, color: '#6B7B8D', marginTop: 6 }}>An unexpected error occurred. You can try again.</p>
        <button onClick={reset} style={{ marginTop: 20, height: 40, padding: '0 20px', borderRadius: 999, border: 'none', background: '#C9A95C', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Try again</button>
      </div>
    </div>
  );
}
