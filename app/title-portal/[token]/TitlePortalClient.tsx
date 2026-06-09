'use client';

/** Phase 64.1 — PUBLIC title-company portal (no login). Token-scoped to one loan. */
import { useState, useEffect } from 'react';

interface Info { valid: boolean; property_address?: string | null; borrower?: string; lo_name?: string; lo_phone?: string | null; lo_email?: string | null; title_company?: string; uploaded?: string[] }
const DOC_TYPES: [string, string][] = [['title_commitment', 'Title Commitment'], ['closing_disclosure_final', 'Closing Disclosure'], ['lien_search', 'Lien Search'], ['survey', 'Survey'], ['title_policy', 'Title Policy'], ['payoff_statement', 'Payoff Statement'], ['other', 'Other Document']];

export function TitlePortalClient({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [wire, setWire] = useState({ bank_name: '', routing_number: '', account_number: '', account_name: '', uploaded_by_name: '' });
  const [wireMsg, setWireMsg] = useState<string | null>(null);

  useEffect(() => { fetch(`/api/title/${token}`).then((r) => r.json()).then(setInfo).catch(() => setInfo({ valid: false })); }, [token]);

  async function upload(docType: string, file: File) {
    setBusy(docType);
    try { const fd = new FormData(); fd.append('file', file); fd.append('doc_type', docType); const r = await fetch(`/api/title/${token}`, { method: 'POST', body: fd }); if (r.ok) { const d = await fetch(`/api/title/${token}`).then((x) => x.json()); setInfo(d); } }
    finally { setBusy(null); }
  }
  async function submitWire() {
    if (!wire.routing_number || !wire.account_number) return;
    setBusy('wire'); setWireMsg(null);
    try { const r = await fetch(`/api/title/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(wire) }); const d = await r.json(); if (r.ok) { setWireMsg(d.message); setWire({ bank_name: '', routing_number: '', account_number: '', account_name: '', uploaded_by_name: '' }); } }
    finally { setBusy(null); }
  }

  if (!info) return <div style={{ padding: 40, textAlign: 'center', color: '#6B7B8D' }}>Loading…</div>;
  if (!info.valid) return (
    <div style={{ minHeight: '100vh', background: '#0F1D2E', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: '-apple-system,sans-serif' }}>
      <div style={{ maxWidth: 380, background: '#F5EFE0', borderRadius: 16, padding: '36px 28px', textAlign: 'center' }}><p style={{ fontSize: 24 }}>⏳</p><p style={{ fontWeight: 600, color: '#0F1D2E' }}>This link is no longer available</p><p style={{ fontSize: 13, color: '#6B7B8D', marginTop: 6 }}>It may have expired or been revoked. Please contact the loan officer for a new link.</p></div>
    </div>
  );

  const inp = { width: '100%', marginTop: 4, fontSize: 13, borderRadius: 8, border: '1px solid #d9d4c7', padding: '8px 10px', color: '#0F1D2E', background: '#fff' } as const;

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', padding: '24px 16px', fontFamily: '-apple-system,sans-serif' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ background: '#0F1D2E', color: '#fff', borderRadius: 16, padding: '20px 24px', marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: '#C9A95C', textTransform: 'uppercase', letterSpacing: 2 }}>Title Portal</p>
          <p style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{info.property_address ?? 'Loan file'}</p>
          <p style={{ fontSize: 13, color: '#9fb0c0', marginTop: 2 }}>Borrower: {info.borrower} · LO: {info.lo_name}{info.lo_phone ? ` · ${info.lo_phone}` : ''}</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(201,169,92,0.18)', padding: '20px 24px', marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#0F1D2E', marginBottom: 12 }}>Upload documents</p>
          {DOC_TYPES.map(([t, l]) => {
            const done = info.uploaded?.includes(t);
            return (
              <div key={t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0ece0' }}>
                <span style={{ fontSize: 13, color: '#0F1D2E' }}>{l} {done && <span style={{ color: '#27AE60' }}>✓</span>}</span>
                <label style={{ fontSize: 12, color: '#C9A95C', cursor: 'pointer', fontWeight: 600 }}>{busy === t ? 'Uploading…' : 'Upload'}<input type="file" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && upload(t, e.target.files[0])} /></label>
              </div>
            );
          })}
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(201,169,92,0.18)', padding: '20px 24px' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#0F1D2E' }}>Wire instructions</p>
          <p style={{ fontSize: 11, color: '#C4724A', margin: '4px 0 12px' }}>⚠ For your protection, the loan officer will call to verbally confirm these before any funds move.</p>
          <input placeholder="Bank name" value={wire.bank_name} onChange={(e) => setWire((x) => ({ ...x, bank_name: e.target.value }))} style={inp} />
          <input placeholder="Account name" value={wire.account_name} onChange={(e) => setWire((x) => ({ ...x, account_name: e.target.value }))} style={inp} />
          <input placeholder="Routing number" value={wire.routing_number} onChange={(e) => setWire((x) => ({ ...x, routing_number: e.target.value }))} style={inp} />
          <input placeholder="Account number" value={wire.account_number} onChange={(e) => setWire((x) => ({ ...x, account_number: e.target.value }))} style={inp} />
          <input placeholder="Your name" value={wire.uploaded_by_name} onChange={(e) => setWire((x) => ({ ...x, uploaded_by_name: e.target.value }))} style={inp} />
          <button onClick={submitWire} disabled={busy === 'wire' || !wire.routing_number || !wire.account_number} style={{ width: '100%', height: 40, marginTop: 10, borderRadius: 999, border: 'none', background: '#C9A95C', color: '#0F1D2E', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: busy === 'wire' ? 0.6 : 1 }}>Submit wire instructions</button>
          {wireMsg && <p style={{ fontSize: 12, color: '#27AE60', marginTop: 8 }}>{wireMsg}</p>}
        </div>

        <p style={{ fontSize: 11, color: '#6B7B8D', textAlign: 'center', marginTop: 16 }}>Questions? Contact {info.lo_name}{info.lo_email ? ` · ${info.lo_email}` : ''}{info.lo_phone ? ` · ${info.lo_phone}` : ''}</p>
      </div>
    </div>
  );
}
