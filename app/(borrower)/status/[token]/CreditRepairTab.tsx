'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Loader2, Sparkles, Send, CheckCircle2, Clock, PartyPopper, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CreditRepairEnrollment {
  id: string;
  status: string;
  subscription_status: string;
  target_score: number;
  trial_ends_at: string | null;
  starting_score_exp: number | null;
  starting_score_eqx: number | null;
  starting_score_tu: number | null;
  current_score_exp: number | null;
  current_score_eqx: number | null;
  current_score_tu: number | null;
  score_history: unknown;
  croa_disclosure_signed_at: string | null;
  created_at: string;
}

interface Dispute {
  id: string;
  tradeline_id: string;
  bureau: string;
  letter_type: string;
  cycle_number: number;
  response_status: string;
  sent_at: string | null;
  expected_response_by: string | null;
  lob_status: string | null;
  ai_next_action: string | null;
  approved_by_borrower_at: string | null;
  letter_body: string;
}

interface Tradeline {
  id: string;
  creditor_name: string;
  bureau: string;
  dispute_status: string;
  dispute_priority: number;
  estimated_score_gain: number | null;
  is_disputable: boolean;
  dispute_reason: string | null;
  account_type: string | null;
  payment_status: string | null;
}

const CROA_TEXT = `CONSUMER CREDIT REPAIR ORGANIZATIONS ACT DISCLOSURE

You have a right to dispute inaccurate information in your credit report by contacting the credit bureau directly. There is no fee charged by credit bureaus for such disputes.

AshleyIQ is a credit services organization. Before paying any money, you have the right to:
1. Review a copy of your rights under the Credit Repair Organizations Act (15 U.S.C. §1679 et seq.)
2. Cancel this contract within 3 business days without charge
3. Receive a complete description of services to be performed

AshleyIQ will review your credit report for inaccurate, incomplete, or unverifiable items, prepare and send dispute letters to the three major credit bureaus on your behalf, track bureau responses, and provide progress updates.

AshleyIQ will NOT advise you to dispute accurate information, make any guarantee regarding credit score improvement, or charge you before services are rendered.

Monthly fee: $19.99 billed after your free trial period. You may cancel at any time.`;

function avg(...vals: (number | null)[]): number {
  const present = vals.filter((v): v is number => typeof v === 'number');
  return present.length ? Math.round(present.reduce((a, b) => a + b, 0) / present.length) : 0;
}

export function CreditRepairTab({ token, initial, borrowerFirstName }: { token: string; initial: CreditRepairEnrollment | null; borrowerFirstName?: string }) {
  const [enrollment, setEnrollment] = useState<CreditRepairEnrollment | null>(initial);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [tradelines, setTradelines] = useState<Tradeline[]>([]);
  const [loading, setLoading] = useState(!!initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const base = `/api/borrower-portal/${token}/credit-repair`;

  const load = useCallback(async () => {
    const res = await fetch(`${base}/status`);
    if (res.ok) {
      const j = (await res.json()) as { enrolled: boolean; enrollment?: CreditRepairEnrollment; disputes?: Dispute[]; tradelines?: Tradeline[] };
      if (j.enrolled && j.enrollment) {
        setEnrollment(j.enrollment);
        setDisputes(j.disputes ?? []);
        setTradelines(j.tradelines ?? []);
      } else {
        setEnrollment(null);
      }
    }
    setLoading(false);
  }, [base]);

  useEffect(() => { if (initial) void load(); }, [initial, load]);

  // ── Not enrolled ──────────────────────────────────────────────────────────
  if (!enrollment) {
    return (
      <div className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] p-8 shadow-card text-center">
        <ShieldCheck size={28} className="text-blue mx-auto mb-3" />
        <h2 className="text-base font-semibold text-label">Credit Repair</h2>
        <p className="text-sm text-label-2 mt-2 max-w-sm mx-auto">
          Your loan officer can set up a guided credit repair program for you when it&apos;s needed to qualify for the best loan. Check back soon.
        </p>
      </div>
    );
  }

  const currentAvg = avg(enrollment.current_score_exp, enrollment.current_score_eqx, enrollment.current_score_tu);
  const startingAvg = avg(enrollment.starting_score_exp, enrollment.starting_score_eqx, enrollment.starting_score_tu);

  return (
    <div className="space-y-4">
      {error && <div className="text-xs text-red bg-red/10 border border-red/20 rounded-[10px] px-3 py-2">{error}</div>}

      {/* CROA gate */}
      {!enrollment.croa_disclosure_signed_at && (
        <CroaSign base={base} enrollmentId={enrollment.id} busy={busy} setBusy={setBusy} setError={setError} onSigned={load} />
      )}

      {/* Pending upload (CROA signed) → soft pull */}
      {enrollment.croa_disclosure_signed_at && enrollment.status === 'pending_upload' && (
        <SoftPullForm base={base} firstName={borrowerFirstName} busy={busy} setBusy={setBusy} setError={setError} onDone={load} />
      )}

      {enrollment.status === 'analyzing' && (
        <div className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] p-8 shadow-card text-center">
          <Loader2 size={26} className="text-blue mx-auto mb-3 animate-spin" />
          <p className="text-sm font-semibold text-label">Ashley is pulling your credit report…</p>
          <p className="text-xs text-label-3 mt-1">This usually takes 5–10 seconds.</p>
        </div>
      )}

      {enrollment.status === 'mortgage_ready' && (
        <div className="bg-gradient-to-br from-gold/15 to-blue/10 rounded-[10px] border border-gold/30 p-8 shadow-card text-center">
          <PartyPopper size={30} className="text-gold mx-auto mb-3" />
          <h2 className="text-lg font-bold text-label">You&apos;re mortgage ready! 🎉</h2>
          <p className="text-sm text-label-2 mt-2">Your average score reached {currentAvg} — at or above your {enrollment.target_score} target. Your loan officer has been notified and will reach out about next steps.</p>
        </div>
      )}

      {/* Active dashboard */}
      {(enrollment.status === 'active' || enrollment.status === 'mortgage_ready') && (
        <>
          {loading ? (
            <div className="text-center py-6"><Loader2 size={20} className="text-blue mx-auto animate-spin" /></div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <ScoreCard label="Experian" current={enrollment.current_score_exp ?? 0} starting={enrollment.starting_score_exp ?? 0} target={enrollment.target_score} />
                <ScoreCard label="Equifax" current={enrollment.current_score_eqx ?? 0} starting={enrollment.starting_score_eqx ?? 0} target={enrollment.target_score} />
                <ScoreCard label="TransUnion" current={enrollment.current_score_tu ?? 0} starting={enrollment.starting_score_tu ?? 0} target={enrollment.target_score} />
              </div>

              <LoanUnlockBar score={currentAvg} />

              <DisputeSection
                base={base}
                enrollmentId={enrollment.id}
                tradelines={tradelines}
                disputes={disputes}
                firstName={borrowerFirstName}
                busy={busy}
                setBusy={setBusy}
                setError={setError}
                onChange={load}
              />

              <ActiveDisputes base={base} enrollmentId={enrollment.id} disputes={disputes} busy={busy} setBusy={setBusy} onChange={load} />

              <ScoreUpdate base={base} enrollmentId={enrollment.id} busy={busy} setBusy={setBusy} setError={setError} onChange={load} />

              <p className="text-[11px] text-label-3 text-center">Started at {startingAvg || '—'} · now {currentAvg || '—'} · target {enrollment.target_score}</p>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Score card ──────────────────────────────────────────────────────────────
function ScoreCard({ label, starting, current, target }: { label: string; starting: number; current: number; target: number }) {
  const denom = target - starting;
  const pct = denom > 0 ? Math.min(100, Math.max(0, ((current - starting) / denom) * 100)) : (current >= target ? 100 : 0);
  return (
    <div className="bg-white border border-[rgba(60,60,67,0.06)] rounded-[10px] p-4 shadow-card">
      <p className="text-xs text-label-3 mb-1">{label}</p>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-2xl font-bold text-[#876830]">{current || '—'}</span>
        <span className="text-xs text-label-3 mb-0.5">/ {target} target</span>
      </div>
      <div className="h-2 bg-black/[0.06] rounded-full overflow-hidden">
        <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      {starting > 0 && <p className="text-[11px] text-label-3 mt-1">Started: {starting}</p>}
    </div>
  );
}

function LoanUnlockBar({ score }: { score: number }) {
  const products = [
    { label: 'FHA', minScore: 580, color: '#34C759' },
    { label: 'Conventional', minScore: 620, color: '#C9A95C' },
    { label: 'Best rates', minScore: 680, color: '#C9A95C' },
    { label: 'Jumbo', minScore: 720, color: '#8B5CF6' },
  ];
  return (
    <div className="bg-white border border-[rgba(60,60,67,0.06)] rounded-[10px] p-4 shadow-card">
      <p className="text-xs text-label-2 mb-3 font-medium">Loan products you unlock</p>
      <div className="space-y-2">
        {products.map((p) => {
          const unlocked = score >= p.minScore;
          return (
            <div key={p.label} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full" style={{ background: unlocked ? p.color : '#E5E7EB' }} />
              <span className={cn('text-sm', unlocked ? 'text-label font-medium' : 'text-label-3')}>{p.label}</span>
              <span className="text-xs text-label-3 ml-auto">{p.minScore}+</span>
              {unlocked && <span className="text-xs font-medium text-green">✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── CROA sign ─────────────────────────────────────────────────────────────
function CroaSign({ base, enrollmentId, busy, setBusy, setError, onSigned }: { base: string; enrollmentId: string; busy: boolean; setBusy: (b: boolean) => void; setError: (e: string) => void; onSigned: () => void }) {
  const [agreed, setAgreed] = useState(false);
  async function sign() {
    setBusy(true); setError('');
    try {
      const res = await fetch(`${base}/sign-croa`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enrollmentId }) });
      if (!res.ok) throw new Error('Could not record your signature');
      onSigned();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); } finally { setBusy(false); }
  }
  return (
    <div className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] p-5 shadow-card">
      <h2 className="text-sm font-semibold text-label mb-2">Before we begin</h2>
      <div className="max-h-56 overflow-y-auto text-xs text-label-2 whitespace-pre-wrap bg-bg rounded-[8px] p-3 border border-[rgba(60,60,67,0.08)]">{CROA_TEXT}</div>
      <label className="flex items-start gap-2 mt-3 cursor-pointer">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 accent-blue" />
        <span className="text-xs text-label-2">I have read and agree to the Credit Repair Organizations Act disclosure.</span>
      </label>
      <button onClick={sign} disabled={!agreed || busy} className="mt-3 w-full py-2.5 bg-[#0F0D0B] text-white text-sm font-semibold rounded-[10px] hover:bg-[#0F0D0B]/90 transition-colors disabled:opacity-40">
        {busy ? 'Signing…' : 'Sign & Continue'}
      </button>
    </div>
  );
}

// ── Soft pull form ─────────────────────────────────────────────────────────
function SoftPullForm({ base, firstName, busy, setBusy, setError, onDone }: { base: string; firstName?: string; busy: boolean; setBusy: (b: boolean) => void; setError: (e: string) => void; onDone: () => void }) {
  const [f, setF] = useState({ firstName: firstName ?? '', lastName: '', ssn: '', dob: '', addressLine1: '', city: '', state: '', zip: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const res = await fetch(`${base}/pull-credit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      if (!res.ok) { const j = await res.json() as { error?: string }; throw new Error(j.error ?? 'Credit pull failed'); }
      onDone();
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); } finally { setBusy(false); }
  }

  const input = 'w-full px-3 py-2 rounded-[8px] border border-[rgba(60,60,67,0.12)] bg-bg text-sm';
  return (
    <form onSubmit={submit} className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] p-5 shadow-card space-y-3">
      <div>
        <h2 className="text-base font-semibold text-label">Pull My Credit Report — won&apos;t affect your score</h2>
        <p className="text-xs text-label-2 mt-1">We use a soft pull, which is invisible to lenders and has zero impact on your credit score.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input required placeholder="First name" value={f.firstName} onChange={set('firstName')} className={input} />
        <input required placeholder="Last name" value={f.lastName} onChange={set('lastName')} className={input} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input required placeholder="SSN" inputMode="numeric" value={f.ssn} onChange={set('ssn')} className={input} style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties} />
        <input required type="date" placeholder="Date of birth" value={f.dob} onChange={set('dob')} className={input} />
      </div>
      <input required placeholder="Street address" value={f.addressLine1} onChange={set('addressLine1')} className={input} />
      <div className="grid grid-cols-3 gap-3">
        <input required placeholder="City" value={f.city} onChange={set('city')} className={input} />
        <input required placeholder="State" maxLength={2} value={f.state} onChange={set('state')} className={input} />
        <input required placeholder="Zip" value={f.zip} onChange={set('zip')} className={input} />
      </div>
      <button type="submit" disabled={busy} className="w-full py-3 bg-[#0F0D0B] text-white text-sm font-semibold rounded-[10px] hover:bg-[#0F0D0B]/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
        {busy ? 'Pulling your credit report…' : 'Pull My Credit — Free Soft Pull'}
      </button>
      <p className="text-[11px] text-label-3">By clicking, you authorize AshleyIQ to obtain your credit report from all three bureaus via a soft inquiry. This will not appear on your credit report or affect your score. Your SSN is used only to pull your report and is never stored.</p>
    </form>
  );
}

// ── Dispute queue + letter generation ──────────────────────────────────────
function DisputeSection({ base, enrollmentId, tradelines, disputes, firstName, busy, setBusy, setError, onChange }: {
  base: string; enrollmentId: string; tradelines: Tradeline[]; disputes: Dispute[]; firstName?: string;
  busy: boolean; setBusy: (b: boolean) => void; setError: (e: string) => void; onChange: () => void;
}) {
  const disputable = tradelines.filter((t) => t.is_disputable && ['identified', 'queued'].includes(t.dispute_status));
  const [selected, setSelected] = useState<string[]>([]);
  const [showAddr, setShowAddr] = useState(false);
  const [name, setName] = useState(firstName ?? '');
  const [addr, setAddr] = useState('');

  const generatedUnsent = disputes.filter((d) => !d.sent_at);

  function toggle(id: string) { setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]); }

  async function generate() {
    if (!name.trim() || !addr.trim()) { setShowAddr(true); setError('Please enter your name and mailing address to generate letters.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch(`${base}/generate-letters`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId, borrowerName: name, borrowerAddress: addr, tradelineIds: selected.length ? selected : undefined }),
      });
      if (!res.ok) throw new Error('Letter generation failed');
      setSelected([]);
      onChange();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); } finally { setBusy(false); }
  }

  async function sendAll() {
    setBusy(true); setError('');
    try {
      const res = await fetch(`${base}/send-disputes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disputeIds: generatedUnsent.map((d) => d.id) }) });
      if (!res.ok) throw new Error('Send failed');
      onChange();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); } finally { setBusy(false); }
  }

  if (disputable.length === 0 && generatedUnsent.length === 0) return null;

  const groups: Array<[string, Tradeline[]]> = [
    ['High Impact', disputable.filter((t) => t.dispute_priority <= 3)],
    ['Medium', disputable.filter((t) => t.dispute_priority >= 4 && t.dispute_priority <= 6)],
    ['Lower', disputable.filter((t) => t.dispute_priority >= 7)],
  ];

  const inputCls = 'w-full px-3 py-2 rounded-[8px] border border-[rgba(60,60,67,0.12)] bg-bg text-sm';
  return (
    <div className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] p-5 shadow-card space-y-3">
      <h2 className="text-sm font-semibold text-label">Dispute Queue</h2>
      {groups.map(([label, items]) => items.length > 0 && (
        <div key={label}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-label-3 mb-1.5">{label}</p>
          <div className="space-y-2">
            {items.map((t) => (
              <label key={t.id} className="flex items-start gap-2.5 p-2.5 rounded-[8px] border border-[rgba(60,60,67,0.08)] cursor-pointer hover:bg-bg">
                <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} className="mt-1 accent-blue" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-label">{t.creditor_name}</span>
                    {t.estimated_score_gain != null && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green/10 text-green whitespace-nowrap">+{t.estimated_score_gain} pts</span>}
                  </div>
                  <p className="text-xs text-label-3">{(t.account_type ?? '').replace(/_/g, ' ')} · {t.bureau}</p>
                  {t.dispute_reason && <p className="text-xs text-label-2 mt-0.5">{t.dispute_reason}</p>}
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}

      {(showAddr || disputable.length > 0) && generatedUnsent.length === 0 && (
        <div className="space-y-2 pt-1">
          <input placeholder="Full legal name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          <input placeholder="Mailing address (e.g. 123 Main St, City ST 12345)" value={addr} onChange={(e) => setAddr(e.target.value)} className={inputCls} />
        </div>
      )}

      {disputable.length > 0 && (
        <button onClick={generate} disabled={busy} className="w-full py-2.5 bg-blue text-white text-sm font-semibold rounded-[10px] hover:bg-blue/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
          <Sparkles size={15} /> {busy ? 'Generating…' : `Generate & Preview Letters${selected.length ? ` (${selected.length})` : ''}`}
        </button>
      )}

      {generatedUnsent.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-black/[0.06]">
          <p className="text-xs text-label-2">{generatedUnsent.length} letter(s) ready to mail.</p>
          {generatedUnsent.slice(0, 3).map((d) => (
            <details key={d.id} className="text-xs">
              <summary className="cursor-pointer text-label-2 flex items-center gap-1.5"><FileText size={12} /> {d.bureau} · {d.letter_type.replace(/_/g, ' ')}</summary>
              <pre className="whitespace-pre-wrap bg-bg rounded-[8px] p-2 mt-1 text-[11px] text-label-2 max-h-40 overflow-y-auto">{d.letter_body}</pre>
            </details>
          ))}
          <button onClick={sendAll} disabled={busy} className="w-full py-2.5 bg-[#0F0D0B] text-white text-sm font-semibold rounded-[10px] hover:bg-[#0F0D0B]/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            <Send size={15} /> {busy ? 'Sending…' : 'Approve & Send Certified Mail'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Active disputes timeline ───────────────────────────────────────────────
function ActiveDisputes({ base, enrollmentId, disputes, busy, setBusy, onChange }: { base: string; enrollmentId: string; disputes: Dispute[]; busy: boolean; setBusy: (b: boolean) => void; onChange: () => void }) {
  const sent = disputes.filter((d) => d.sent_at && d.response_status === 'awaiting_response');
  const [logging, setLogging] = useState<string | null>(null);
  if (sent.length === 0) return null;

  async function logOutcome(disputeId: string, outcome: string) {
    setBusy(true);
    try {
      await fetch(`${base}/log-outcome`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disputeId, outcome, enrollmentId }) });
      setLogging(null);
      onChange();
    } finally { setBusy(false); }
  }

  function daysLeft(d: Dispute): number {
    if (!d.expected_response_by) return 0;
    return Math.max(0, Math.ceil((new Date(d.expected_response_by).getTime() - Date.now()) / 86400000));
  }

  return (
    <div className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] p-5 shadow-card space-y-3">
      <h2 className="text-sm font-semibold text-label">Active Disputes</h2>
      {sent.map((d) => {
        const dl = daysLeft(d);
        return (
          <div key={d.id} className="p-3 rounded-[8px] border border-[rgba(60,60,67,0.08)]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-label capitalize">{d.bureau}</span>
              <span className={cn('text-xs flex items-center gap-1', dl > 0 ? 'text-label-3' : 'text-orange font-medium')}>
                <Clock size={12} /> {dl > 0 ? `${dl} days until response due` : 'Response window passed'}
              </span>
            </div>
            <p className="text-[11px] text-label-3 mt-0.5">Sent {d.sent_at ? new Date(d.sent_at).toLocaleDateString() : ''} · {d.lob_status}</p>
            {logging === d.id ? (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {([['item_removed', 'Item Removed ✓'], ['item_updated', 'Item Updated'], ['verified_accurate', 'Bureau Verified'], ['no_response', 'No Response']] as const).map(([val, lbl]) => (
                  <button key={val} disabled={busy} onClick={() => logOutcome(d.id, val)} className="text-xs px-2 py-1.5 rounded-[8px] border border-[rgba(60,60,67,0.12)] hover:bg-bg disabled:opacity-40">{lbl}</button>
                ))}
              </div>
            ) : (
              <button onClick={() => setLogging(d.id)} className="mt-2 text-xs font-semibold text-blue hover:underline">⏰ Log Bureau Response</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Score update ───────────────────────────────────────────────────────────
function ScoreUpdate({ base, enrollmentId, busy, setBusy, setError, onChange }: { base: string; enrollmentId: string; busy: boolean; setBusy: (b: boolean) => void; setError: (e: string) => void; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState({ exp: '', eqx: '', tu: '' });
  async function submit() {
    setBusy(true); setError('');
    try {
      const res = await fetch(`${base}/update-score`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enrollmentId, scoreExp: Number(s.exp), scoreEqx: Number(s.eqx), scoreTu: Number(s.tu) }) });
      if (!res.ok) throw new Error('Could not update scores');
      setOpen(false); setS({ exp: '', eqx: '', tu: '' });
      onChange();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); } finally { setBusy(false); }
  }
  const input = 'w-full px-3 py-2 rounded-[8px] border border-[rgba(60,60,67,0.12)] bg-bg text-sm';
  return (
    <div className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] p-5 shadow-card">
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-sm font-semibold text-blue flex items-center gap-1.5"><CheckCircle2 size={15} /> Re-check your scores</button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-label">Update your scores</p>
          <div className="grid grid-cols-3 gap-2">
            <input placeholder="Experian" inputMode="numeric" value={s.exp} onChange={(e) => setS((p) => ({ ...p, exp: e.target.value }))} className={input} />
            <input placeholder="Equifax" inputMode="numeric" value={s.eqx} onChange={(e) => setS((p) => ({ ...p, eqx: e.target.value }))} className={input} />
            <input placeholder="TransUnion" inputMode="numeric" value={s.tu} onChange={(e) => setS((p) => ({ ...p, tu: e.target.value }))} className={input} />
          </div>
          <div className="flex gap-2">
            <button onClick={submit} disabled={busy || !s.exp || !s.eqx || !s.tu} className="px-4 py-2 bg-[#0F0D0B] text-white text-sm font-semibold rounded-[10px] disabled:opacity-40">Save</button>
            <button onClick={() => setOpen(false)} className="px-4 py-2 bg-black/[0.06] text-label-2 text-sm rounded-[10px]">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
