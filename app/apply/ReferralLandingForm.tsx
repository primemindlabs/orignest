'use client';

/** Phase 61.1 — public referral application form. White-labeled; TCPA consent. */
import { useState } from 'react';

export function ReferralLandingForm({ refCode }: { refCode: string | null }) {
  const [f, setF] = useState({ name: '', phone: '', email: '', purpose: 'purchase', timeline: 'ready_now', sms_consent: false });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!f.name || (!f.phone && !f.email)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/referrals/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: refCode, ...f }) });
      if (r.ok) setDone(true);
    } finally { setBusy(false); }
  }

  const inp = { width: '100%', marginTop: 4, fontSize: 14, borderRadius: 8, border: '1px solid #d9d4c7', padding: '10px 12px', color: '#0F1D2E', background: '#fff' } as const;

  if (done) return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <p style={{ fontSize: 32 }}>✓</p>
      <p style={{ fontSize: 16, fontWeight: 600, color: '#0F1D2E' }}>Thank you!</p>
      <p style={{ fontSize: 13, color: '#6B7B8D', marginTop: 6 }}>Your loan officer will reach out shortly to get you pre-qualified.</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ display: 'block' }}><span style={{ fontSize: 12, color: '#6B7B8D' }}>Full name</span><input value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} style={inp} /></label>
      <label style={{ display: 'block' }}><span style={{ fontSize: 12, color: '#6B7B8D' }}>Mobile phone</span><input value={f.phone} onChange={(e) => setF((x) => ({ ...x, phone: e.target.value }))} style={inp} /></label>
      <label style={{ display: 'block' }}><span style={{ fontSize: 12, color: '#6B7B8D' }}>Email</span><input value={f.email} onChange={(e) => setF((x) => ({ ...x, email: e.target.value }))} style={inp} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={{ display: 'block' }}><span style={{ fontSize: 12, color: '#6B7B8D' }}>I want to</span><select value={f.purpose} onChange={(e) => setF((x) => ({ ...x, purpose: e.target.value }))} style={inp}><option value="purchase">Buy a home</option><option value="refinance">Refinance</option></select></label>
        <label style={{ display: 'block' }}><span style={{ fontSize: 12, color: '#6B7B8D' }}>Timeline</span><select value={f.timeline} onChange={(e) => setF((x) => ({ ...x, timeline: e.target.value }))} style={inp}><option value="ready_now">Ready now</option><option value="1_3_months">1–3 months</option><option value="3_6_months">3–6 months</option><option value="exploring">Just exploring</option></select></label>
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11, color: '#6B7B8D' }}>
        <input type="checkbox" checked={f.sms_consent} onChange={(e) => setF((x) => ({ ...x, sms_consent: e.target.checked }))} style={{ marginTop: 2 }} />
        <span>I agree to be contacted by phone, text, and email about my mortgage inquiry. Message/data rates may apply; reply STOP to opt out. Consent is not a condition of any purchase.</span>
      </label>
      <button onClick={submit} disabled={busy || !f.name || (!f.phone && !f.email)} style={{ width: '100%', height: 44, borderRadius: 999, border: 'none', background: '#C9A95C', color: '#0F1D2E', fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Submitting…' : 'Get pre-qualified'}</button>
    </div>
  );
}
