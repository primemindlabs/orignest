'use client';

/**
 * Phase 30.2 — Competitor LE Analysis panel.
 * Manual fee entry → Claude talking points (works today). PDF auto-extract is
 * gated until AWS Textract is configured (banner shown when unavailable).
 */
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Sparkles, Copy, Check, TrendingDown, TrendingUp } from 'lucide-react';

interface Analysis {
  competitor_name: string | null;
  competitor_rate: number | null;
  competitor_total_closing_costs: number | null;
  our_le_snapshot: { interest_rate?: number | null; total_closing_costs?: number | null; lock_days?: number | null };
  analysis: { talking_points: string[]; summary: string; net_difference_5yr: number; we_win_on: string[] } | null;
}

function n(v: string): number | null {
  const x = parseFloat(v.replace(/[$,%\s]/g, ''));
  return Number.isFinite(x) ? x : null;
}
function money(v: number | null | undefined) {
  return v == null ? '—' : `$${Math.round(v).toLocaleString()}`;
}

export function CompetitorAnalysisPanel({
  loanId,
  loanAmount,
  initial,
  textractConfigured,
}: {
  loanId: string;
  loanAmount: number | null;
  initial: Analysis | null;
  textractConfigured: boolean;
}) {
  const [result, setResult] = useState<Analysis | null>(initial);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // form state
  const [competitorName, setCompetitorName] = useState(initial?.competitor_name ?? '');
  const [theirRate, setTheirRate] = useState(initial?.competitor_rate?.toString() ?? '');
  const [theirCosts, setTheirCosts] = useState(initial?.competitor_total_closing_costs?.toString() ?? '');
  const [theirPayment, setTheirPayment] = useState('');
  const [ourRate, setOurRate] = useState(initial?.our_le_snapshot?.interest_rate?.toString() ?? '');
  const [ourCosts, setOurCosts] = useState(initial?.our_le_snapshot?.total_closing_costs?.toString() ?? '');
  const [ourPayment, setOurPayment] = useState('');

  async function analyze() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/loans/${loanId}/competitor-le`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitorName,
          competitor: {
            lender_name: competitorName || null,
            interest_rate: n(theirRate),
            total_closing_costs: n(theirCosts),
            monthly_payment: n(theirPayment),
            loan_amount: loanAmount,
          },
          ourLe: {
            interest_rate: n(ourRate),
            total_closing_costs: n(ourCosts),
            monthly_payment: n(ourPayment),
            loan_amount: loanAmount,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Analysis failed');
      setResult(data.analysis);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setBusy(false);
    }
  }

  function copyPoints() {
    const a = result?.analysis;
    if (!a) return;
    navigator.clipboard.writeText(a.talking_points.map((p) => `• ${p}`).join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const a = result?.analysis;
  const rateAdv = result && result.our_le_snapshot?.interest_rate != null && result.competitor_rate != null
    ? result.competitor_rate - result.our_le_snapshot.interest_rate
    : null;
  const costAdv = result && result.our_le_snapshot?.total_closing_costs != null && result.competitor_total_closing_costs != null
    ? result.competitor_total_closing_costs - result.our_le_snapshot.total_closing_costs
    : null;

  return (
    <div className="space-y-4">
      {!textractConfigured && (
        <div className="text-[12px] text-[var(--c-label2)] bg-[var(--c-fill)] rounded-[10px] px-3 py-2">
          PDF auto-extract (AWS Textract) isn&apos;t connected yet — enter the competitor&apos;s figures below and Ashley IQ writes the talking points.
        </div>
      )}

      {/* Entry form */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-3">
        <Input label="Competitor name" value={competitorName} onChange={(e) => setCompetitorName(e.target.value)} placeholder="First National Bank" />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-gold-deep)]">Their LE</p>
            <Input label="Rate %" value={theirRate} onChange={(e) => setTheirRate(e.target.value)} placeholder="7.125" />
            <Input label="Total closing costs" value={theirCosts} onChange={(e) => setTheirCosts(e.target.value)} placeholder="8420" />
            <Input label="Monthly payment" value={theirPayment} onChange={(e) => setTheirPayment(e.target.value)} placeholder="optional" />
          </div>
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-text)]">Our LE</p>
            <Input label="Rate %" value={ourRate} onChange={(e) => setOurRate(e.target.value)} placeholder="6.990" />
            <Input label="Total closing costs" value={ourCosts} onChange={(e) => setOurCosts(e.target.value)} placeholder="7180" />
            <Input label="Monthly payment" value={ourPayment} onChange={(e) => setOurPayment(e.target.value)} placeholder="optional" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={analyze} disabled={busy}>
            <Sparkles size={14} /> {busy ? 'Analyzing…' : 'Generate Talking Points'}
          </Button>
          {err && <span className="text-[12px] text-[var(--c-danger)]">{err}</span>}
        </div>
      </div>

      {/* Results */}
      {result && a && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--c-border)]">
            <p className="text-[13px] font-semibold text-[var(--c-text)]">Comparison · {result.competitor_name ?? 'Competitor'}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 p-4">
            <Stat label="Rate advantage" value={rateAdv != null ? `${rateAdv >= 0 ? '↓' : '↑'} ${Math.abs(rateAdv).toFixed(3)}%` : '—'} good={rateAdv != null && rateAdv >= 0} />
            <Stat label="Fee advantage" value={costAdv != null ? `${money(Math.abs(costAdv))} ${costAdv >= 0 ? 'less' : 'more'}` : '—'} good={costAdv != null && costAdv >= 0} />
            <Stat label="5-yr net" value={money(a.net_difference_5yr)} good={a.net_difference_5yr >= 0} />
          </div>
          {a.summary && <p className="px-4 pb-2 text-[12px] text-[var(--c-label2)]">{a.summary}</p>}

          <div className="px-4 py-3 border-t border-[var(--c-border)]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)]">Talking points for your call</p>
              <button onClick={copyPoints} className="inline-flex items-center gap-1 text-[12px] text-[var(--c-gold-deep)] hover:underline">
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <ul className="space-y-1.5">
              {a.talking_points.map((p, i) => (
                <li key={i} className="text-[13px] text-[var(--c-text)] leading-snug flex gap-2">
                  <span className="text-[var(--c-gold)]">•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="bg-[var(--c-fill)] rounded-[10px] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-[var(--c-label2)]">{label}</p>
      <p className={`text-[14px] font-mono tabular-nums font-semibold mt-0.5 inline-flex items-center gap-1 ${good ? 'text-green' : 'text-[var(--c-text)]'}`}>
        {good ? <TrendingDown size={13} /> : <TrendingUp size={13} className="opacity-40" />} {value}
      </p>
    </div>
  );
}
