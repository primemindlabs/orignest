'use client';

/**
 * Phase 148 — public borrower Loan Estimate view + acknowledgment. Self-contained
 * inline styles (no dashboard chrome), token-gated.
 */
import { useEffect, useState } from 'react';

interface LE {
  loan: { amount: number; rate: number; termMonths: number; product: string; purpose: string; monthlyPI: number };
  property: { address: string | null; purchasePrice: number | null };
  closingCosts: Record<string, number>;
  cashToClose: number;
  estimatedDownPayment: number;
  disclaimer: string;
}

const money = (v: number | null | undefined) => v == null ? '—' : v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function DisclosureView({ token }: { token: string }) {
  const [le, setLe] = useState<LE | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [acking, setAcking] = useState(false);

  useEffect(() => {
    fetch(`/api/disclosures/${token}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => {
      setLe(j.le); setCompany(j.company); setName(j.borrower_first_name); setStatus(j.status);
    }).catch(() => setStatus('notfound')).finally(() => setLoading(false));
  }, [token]);

  const acknowledge = async () => {
    setAcking(true);
    const r = await fetch(`/api/disclosures/${token}`, { method: 'POST' });
    setAcking(false);
    if (r.ok) setStatus('acknowledged');
  };

  const wrap: React.CSSProperties = { maxWidth: 720, margin: '0 auto', padding: '32px 20px', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', color: '#1a1a1a' };
  if (loading) return <div style={{ ...wrap, textAlign: 'center', color: '#888' }}>Loading…</div>;
  if (status === 'notfound' || !le) return <div style={{ ...wrap, textAlign: 'center', color: '#888' }}>This estimate is no longer available.</div>;

  const cc = le.closingCosts;
  const row = (label: string, val: number, strong = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontWeight: strong ? 600 : 400, borderTop: strong ? '1px solid #e5e5e5' : 'none' }}>
      <span>{label}</span><span>{money(val)}</span>
    </div>
  );

  return (
    <div style={wrap}>
      <div style={{ fontSize: 13, color: '#888' }}>{company ?? 'Your loan team'}</div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 2px' }}>Your Estimated Loan Terms</h1>
      <p style={{ color: '#666', marginTop: 0 }}>{name ? `Hi ${name} — here` : 'Here'} is a preliminary estimate to help you plan.</p>

      <section style={{ border: '1px solid #e5e5e5', borderRadius: 14, padding: 18, marginTop: 16 }}>
        <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Loan</h2>
        {row('Loan amount', le.loan.amount)}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}><span>Rate (note rate)</span><span>{le.loan.rate ? `${le.loan.rate}%` : '—'}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}><span>Product</span><span>{le.loan.product}</span></div>
        {row('Estimated monthly principal & interest', le.loan.monthlyPI, true)}
      </section>

      <section style={{ border: '1px solid #e5e5e5', borderRadius: 14, padding: 18, marginTop: 14 }}>
        <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Estimated costs at closing</h2>
        {row('Origination charges', cc.origination_charges)}
        {row('Services you cannot shop for', cc.services_cannot_shop)}
        {row('Services you can shop for', cc.services_can_shop)}
        {row('Taxes & government fees', cc.taxes_government_fees)}
        {row('Prepaids', cc.prepaids)}
        {row('Initial escrow', cc.initial_escrow)}
        {cc.other ? row('Other', cc.other) : null}
        {cc.lender_credits ? row('Lender credits', -cc.lender_credits) : null}
        {row('Estimated total closing costs', cc.total_closing_costs, true)}
        {row('Estimated cash to close', le.cashToClose, true)}
      </section>

      <p style={{ fontSize: 11, color: '#999', marginTop: 14, lineHeight: 1.5 }}>{le.disclaimer}</p>

      <div style={{ marginTop: 18 }}>
        {status === 'acknowledged' ? (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', borderRadius: 12, padding: '12px 16px', fontSize: 14 }}>✓ Thanks — you have acknowledged receipt of this estimate.</div>
        ) : (
          <button onClick={acknowledge} disabled={acking} style={{ background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 14, cursor: 'pointer' }}>{acking ? 'Saving…' : 'I acknowledge I received this estimate'}</button>
        )}
      </div>
    </div>
  );
}
