'use client';

// Phase 122 — borrower selects their preferred scenario on the public proposal page.
import { useState } from 'react';

interface Opt { id: string; name: string; recommended: boolean }

export function ProposalChoose({ token, options, initialChoice }: { token: string; options: Opt[]; initialChoice: string | null }) {
  const [choice, setChoice] = useState<string | null>(initialChoice);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(id: string) {
    setErr(null); setBusy(true);
    const res = await fetch(`/api/proposals/${token}/choose`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: id }) });
    setBusy(false);
    if (res.ok) { setChoice(id); return; }
    const j = await res.json().catch(() => ({}));
    setErr(j.error ?? 'Could not record your choice. Please try again.');
  }

  return (
    <div className="print:hidden">
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>Let your loan officer know which option you&apos;d like to move forward with. You can change this anytime.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map((o) => {
          const selected = choice === o.id;
          return (
            <button key={o.id} onClick={() => pick(o.id)} disabled={busy}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left',
                border: `1.5px solid ${selected ? '#C9A95C' : '#e5e7eb'}`, background: selected ? '#FBF7EE' : '#fff',
                borderRadius: 12, padding: '12px 16px', cursor: 'pointer', fontSize: 14,
              }}>
              <span style={{ fontWeight: 600, color: '#0F1D2E' }}>
                {o.name}
                {o.recommended && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: '#C9A95C' }}>Recommended</span>}
              </span>
              <span style={{ fontSize: 13, color: selected ? '#C9A95C' : '#9ca3af', fontWeight: 600 }}>{selected ? '✓ Selected' : 'Choose'}</span>
            </button>
          );
        })}
      </div>
      {choice && <p style={{ fontSize: 13, color: '#16a34a', marginTop: 10 }}>Thank you — your loan officer has been notified of your selection.</p>}
      {err && <p style={{ fontSize: 13, color: '#ef4444', marginTop: 10 }}>{err}</p>}
    </div>
  );
}
