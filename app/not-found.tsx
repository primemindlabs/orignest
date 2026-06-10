/** Phase 70 — global 404. Friendly, branded (no "Ashley IQ"), with a way back. */
import Link from 'next/link';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#F5F5F7', fontFamily: '-apple-system,Segoe UI,Roboto,sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <p style={{ fontSize: 48, fontWeight: 200, color: '#0F1D2E', letterSpacing: '-0.04em' }}>404</p>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#0F1D2E', marginTop: 4 }}>We couldn&apos;t find that page</p>
        <p style={{ fontSize: 13, color: '#6B7B8D', marginTop: 6 }}>The link may be outdated, or the page may have moved.</p>
        <Link href="/dashboard" style={{ display: 'inline-block', marginTop: 20, height: 40, lineHeight: '40px', padding: '0 20px', borderRadius: 999, background: '#C9A95C', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Back to dashboard</Link>
      </div>
    </div>
  );
}
