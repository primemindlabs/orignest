'use client';

// Phase 122 — LO proposal generator: configure (recommended + comparisons) → generate
// (Claude Haiku + print-ready page) → preview → send (email/SMS).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconSparkles, IconExternalLink, IconCopy, IconCheck, IconMail, IconMessage } from '@tabler/icons-react';

interface Scenario { id: string; scenario_name: string; loan_type: string; loan_amount: number | null; interest_rate: number | null; loan_term_months: number | null; monthly_payment: number | null; is_recommended: boolean }
interface Proposal { id: string; share_token: string; recommended_scenario_id: string; sent_at: string | null; sent_channel: string | null; viewed_at: string | null; borrower_choice_scenario_id: string | null; created_at: string }

const usd = (n: number | null) => (n == null ? '—' : `$${Math.round(n).toLocaleString()}`);

export function ProposalGenerator({ loanId, scenarios, initialProposals }: { loanId: string; scenarios: Scenario[]; initialProposals: Proposal[] }) {
  const router = useRouter();
  const [recId, setRecId] = useState<string>(scenarios.find((s) => s.is_recommended)?.id ?? scenarios[0]?.id ?? '');
  const [compIds, setCompIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ proposalId: string; proposalUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);

  function toggleComp(id: string) {
    setCompIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? prev : [...prev, id]);
  }

  async function generate() {
    setErr(null); setResult(null); setSendMsg(null);
    if (!recId) { setErr('Pick a recommended scenario.'); return; }
    setBusy(true);
    const res = await fetch(`/api/loans/${loanId}/proposals`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendedScenarioId: recId, comparisonScenarioIds: compIds }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (res.ok) { setResult({ proposalId: j.proposalId, proposalUrl: j.proposalUrl }); router.refresh(); }
    else setErr(j.error ?? 'Could not generate the proposal.');
  }

  async function send(channel: 'email' | 'sms') {
    if (!result) return;
    setSendMsg(null);
    const res = await fetch(`/api/loans/${loanId}/proposals/${result.proposalId}/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) setSendMsg(j.delivered ? `Sent via ${channel}.` : `Recorded — ${channel} delivery is not configured in this environment.`);
    else setSendMsg(j.error ?? 'Could not send.');
    router.refresh();
  }

  async function copyLink() {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.proposalUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
  }

  if (scenarios.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <p className="text-sm font-medium text-gray-900 mb-1">No scenarios yet</p>
        <p className="text-xs text-gray-400 mb-4">Build at least one loan scenario first, then come back to generate a proposal.</p>
        <a href={`/loans/${loanId}/scenarios`} className="inline-flex items-center gap-1.5 rounded-xl bg-[#C9A95C] px-4 py-2 text-sm font-semibold text-white hover:brightness-95">Open Scenario Builder</a>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-5">
      {/* Configure */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">1 · Recommended product</p>
          <div className="space-y-2">
            {scenarios.map((s) => (
              <label key={s.id} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 cursor-pointer ${recId === s.id ? 'border-[#C9A95C] bg-[#FBF7EE]' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <input type="radio" name="rec" checked={recId === s.id} onChange={() => { setRecId(s.id); setCompIds((c) => c.filter((x) => x !== s.id)); }} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.scenario_name}</p>
                    <p className="text-xs text-gray-400 capitalize">{(s.loan_type ?? '').replace(/_/g, ' ')} · {usd(s.loan_amount)} · {usd(s.monthly_payment)}/mo</p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-900 mb-1">2 · Comparisons <span className="text-xs font-normal text-gray-400">(up to 3)</span></p>
          <div className="space-y-2 mt-2">
            {scenarios.filter((s) => s.id !== recId).map((s) => (
              <label key={s.id} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 cursor-pointer">
                <input type="checkbox" checked={compIds.includes(s.id)} onChange={() => toggleComp(s.id)} disabled={!compIds.includes(s.id) && compIds.length >= 3} />
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.scenario_name}</p>
                  <p className="text-xs text-gray-400 capitalize">{(s.loan_type ?? '').replace(/_/g, ' ')} · {usd(s.monthly_payment)}/mo</p>
                </div>
              </label>
            ))}
            {scenarios.filter((s) => s.id !== recId).length === 0 && <p className="text-xs text-gray-300">Add more scenarios to compare.</p>}
          </div>
        </div>

        {err && <p className="text-xs text-red-500">{err}</p>}
        <button onClick={generate} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#C9A95C] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50">
          <IconSparkles size={16} /> {busy ? 'Generating…' : 'Generate proposal'}
        </button>
      </div>

      {/* Preview / Send + History */}
      <div className="space-y-4">
        {result ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-900">3 · Preview & send</p>
            <div className="flex items-center gap-2">
              <input readOnly value={result.proposalUrl} className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600" />
              <button onClick={copyLink} className="inline-flex items-center gap-1 rounded-xl bg-gray-900 px-3 py-2 text-xs font-medium text-white">{copied ? <IconCheck size={13} /> : <IconCopy size={13} />}{copied ? 'Copied' : 'Copy'}</button>
              <a href={result.proposalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-xl border border-gray-200 px-2 py-2 text-gray-500 hover:bg-gray-50"><IconExternalLink size={14} /></a>
            </div>
            <iframe src={result.proposalUrl} title="Proposal preview" className="w-full h-72 rounded-xl border border-gray-100" />
            <div className="flex gap-2">
              <button onClick={() => send('email')} className="inline-flex items-center gap-1.5 rounded-xl bg-[#C9A95C] px-4 py-2 text-sm font-semibold text-white hover:brightness-95"><IconMail size={15} /> Email</button>
              <button onClick={() => send('sms')} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"><IconMessage size={15} /> Text (TCPA-gated)</button>
            </div>
            {sendMsg && <p className="text-xs text-gray-600">{sendMsg}</p>}
          </div>
        ) : (
          <div className="bg-gray-50/60 rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">Configure and generate to preview the proposal here.</div>
        )}

        {initialProposals.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-sm font-semibold text-gray-900 mb-2">History</p>
            <div className="space-y-2">
              {initialProposals.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs border border-gray-100 rounded-xl px-3 py-2">
                  <span className="text-gray-500">{new Date(p.created_at).toLocaleDateString()}</span>
                  <span className="flex items-center gap-2">
                    {p.borrower_choice_scenario_id && <span className="text-green-600 font-medium">Chosen</span>}
                    {p.viewed_at && <span className="text-blue-500">Viewed</span>}
                    {p.sent_at && <span className="text-gray-400">Sent {p.sent_channel}</span>}
                    <a href={`/proposal/${p.share_token}`} target="_blank" rel="noreferrer" className="text-[#C9A95C] font-medium">Open</a>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
