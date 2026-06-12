import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = { title: 'HIPAA Notice · Ashley IQ' };

const LAST_UPDATED = 'June 12, 2026';

export default function HipaaPage() {
  return (
    <main style={{ background: '#FAFAF8', minHeight: '100vh' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '64px 24px', color: '#1A1A1A' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7B8D', marginBottom: 24, textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Back
        </Link>
        <p style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#C9A95C', fontWeight: 600, margin: '0 0 8px' }}>Compliance</p>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 8px' }}>HIPAA Notice</h1>
        <p style={{ color: '#6B7B8D', fontSize: 14, marginBottom: 32 }}>Last updated {LAST_UPDATED}</p>

        <div style={{ fontSize: 15, lineHeight: 1.7, color: '#374151' }}>
          <p>
            Ashley IQ provides software for licensed mortgage loan originators and their teams. Our
            platform is designed for mortgage origination and is <strong>not a covered entity or a
            business associate</strong> under the Health Insurance Portability and Accountability Act
            (HIPAA), and it is not intended to create, receive, maintain, or transmit Protected Health
            Information (PHI).
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 600, margin: '28px 0 10px' }}>Do not submit PHI</h2>
          <p>
            Customers should not upload, enter, or transmit PHI through Ashley IQ. If your workflow
            involves health information, please contact us before doing so — we will work with you on
            an appropriate arrangement, including a Business Associate Agreement (BAA) where required.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 600, margin: '28px 0 10px' }}>Safeguards</h2>
          <p>
            We maintain administrative, technical, and physical safeguards for the data we process —
            encryption in transit and at rest, role-based access controls, row-level security, and
            audit logging. Sensitive identifiers are encrypted at the application layer.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 600, margin: '28px 0 10px' }}>Questions</h2>
          <p>
            For questions about this notice or to request a BAA, contact{' '}
            <a href="mailto:privacy@ashleyiq.com" style={{ color: '#1A1A1A' }}>privacy@ashleyiq.com</a>.
          </p>

          <p style={{ marginTop: 32, fontSize: 13, color: '#9AA4AE' }}>
            This page is provided for transparency and does not constitute legal advice. Final HIPAA
            and BAA language is subject to counsel review.
          </p>
        </div>
      </div>
    </main>
  );
}
