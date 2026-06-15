'use client';

/**
 * Phase 137 — contact-capture start screen for the branded full 1003.
 * On submit, mints a lead + draft loan_application and routes the borrower into
 * the adaptive Smart-1003 at /apply/smart/[token].
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  orgSlug: string;
  mloSlug: string;
  loName: string;
  orgName: string;
  nmls: string | null;
  brandColor: string;
}

const PURPOSES = [
  { value: '', label: 'What are you looking to do?' },
  { value: 'purchase', label: 'Buy a home' },
  { value: 'rate_term_refinance', label: 'Refinance (lower my rate/payment)' },
  { value: 'cash_out_refinance', label: 'Refinance (take cash out)' },
];

export function PublicApplyStart({ orgSlug, mloSlug, loName, orgName, nmls, brandColor }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', phone: '', loan_purpose: '', sms_consent: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = loName.split(' ')[0];

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || (!form.email.trim() && !form.phone.trim())) {
      setError('Please enter your name and a phone or email.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/apply/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_slug: orgSlug, mlo_slug: mloSlug, ...form }),
      });
      const j = await res.json();
      if (!res.ok || !j.token) throw new Error(j.error ?? 'Could not start your application.');
      router.push(`/apply/smart/${j.token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', fontSize: 14, padding: '11px 12px', borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.14)', background: '#fff', marginTop: 8, boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: '-apple-system,Segoe UI,Roboto,sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.08)' }}>
        <div style={{ background: '#0F1D2E', padding: '24px 28px', color: '#fff', borderTop: `3px solid ${brandColor}` }}>
          <p style={{ fontSize: 18, fontWeight: 700 }}>{loName}</p>
          {orgName && <p style={{ fontSize: 13, color: '#9fb0c0' }}>{orgName}</p>}
          {nmls && <p style={{ fontSize: 12, color: '#6B7B8D', marginTop: 2 }}>NMLS #{nmls}</p>}
        </div>
        <form onSubmit={start} style={{ padding: '24px 28px' }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#0F1D2E', marginBottom: 4 }}>Start your loan application</p>
          <p style={{ fontSize: 13, color: '#6B7B8D', marginBottom: 16 }}>
            A few details to begin — {firstName} will tailor the rest to your loan.
          </p>

          <input style={inp} placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input style={inp} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input style={inp} type="tel" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <select style={{ ...inp, appearance: 'auto' }} value={form.loan_purpose} onChange={(e) => setForm({ ...form, loan_purpose: e.target.value })}>
            {PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>

          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 14, fontSize: 12, color: '#6B7B8D', lineHeight: 1.5 }}>
            <input type="checkbox" checked={form.sms_consent} onChange={(e) => setForm({ ...form, sms_consent: e.target.checked })} style={{ marginTop: 2 }} />
            <span>I agree to be contacted by {orgName || loName} about my application, including by text. Message/data rates may apply.</span>
          </label>

          {error && <p style={{ color: '#FF3B30', fontSize: 13, marginTop: 12 }}>{error}</p>}

          <button type="submit" disabled={submitting} style={{ width: '100%', marginTop: 18, padding: '13px', borderRadius: 12, border: 'none', background: brandColor, color: '#0F1D2E', fontSize: 15, fontWeight: 700, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Starting…' : 'Begin application'}
          </button>
        </form>
        <div style={{ padding: '12px 28px', background: 'rgba(15,29,46,0.04)' }}>
          <p style={{ fontSize: 10, color: '#6B7B8D', lineHeight: 1.5 }}>
            This is not a commitment to lend or an offer of credit. Equal Housing Opportunity.{orgName ? ` ${orgName}.` : ''}{nmls ? ` NMLS #${nmls}.` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
