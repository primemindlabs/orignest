'use client';

// Phase 89 — Lender AE directory. Card grid of the LO's AE contacts with performance
// score, quick-copy contact, preferred toggle, loan-type coverage, add/edit drawer and
// a lightweight submission logger.
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Star, Plus, Phone, Mail, Pencil, Trash2, Copy, ExternalLink, X, Send } from 'lucide-react';
import { aePerformanceScore, scoreTier, LOAN_TYPE_OPTIONS } from '@/lib/lenderAe/score';

interface AE {
  id: string;
  lender_name: string;
  lender_website: string | null;
  lender_type: string;
  ae_name: string;
  ae_email: string;
  ae_phone: string | null;
  ae_cell: string | null;
  ae_linkedin: string | null;
  ae_title: string | null;
  loan_types: string[];
  preferred: boolean;
  notes: string | null;
  last_submission_at: string | null;
  response_time_avg_hours: number | null;
  is_active: boolean;
}

const TONE: Record<string, string> = {
  gold: 'var(--c-gold)', good: '#3FB68B', ok: '#E0A93B', low: 'var(--c-label3)',
};
const LT_LABEL: Record<string, string> = {
  conventional: 'Conv', fha: 'FHA', va: 'VA', usda: 'USDA', jumbo: 'Jumbo', dscr: 'DSCR',
  non_qm: 'Non-QM', heloc: 'HELOC', construction: 'Constr', reverse: 'Reverse', commercial: 'Comm',
};

type FormState = Partial<AE>;
const EMPTY_FORM: FormState = { lender_type: 'wholesale', loan_types: [], preferred: false };

export function LenderAEDirectory() {
  const [aes, setAes] = useState<AE[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [sort, setSort] = useState<'performance' | 'response' | 'alpha'>('performance');

  const [drawer, setDrawer] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [logFor, setLogFor] = useState<AE | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/lender-aes');
    if (res.ok) setAes((await res.json()).aes ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const scored = useMemo(() => {
    const withScore = aes.map((ae) => ({ ae, score: aePerformanceScore(ae) }));
    const filtered = filter === 'all' ? withScore : withScore.filter((x) => x.ae.loan_types.includes(filter));
    filtered.sort((a, b) => {
      if (sort === 'alpha') return a.ae.lender_name.localeCompare(b.ae.lender_name);
      if (sort === 'response') {
        const av = a.ae.response_time_avg_hours ?? Infinity;
        const bv = b.ae.response_time_avg_hours ?? Infinity;
        return av - bv;
      }
      return b.score - a.score;
    });
    return filtered;
  }, [aes, filter, sort]);

  function openAdd() { setEditId(null); setForm(EMPTY_FORM); setErr(null); setDrawer(true); }
  function openEdit(ae: AE) { setEditId(ae.id); setForm({ ...ae }); setErr(null); setDrawer(true); }

  async function save() {
    if (!form.lender_name || !form.ae_name || !form.ae_email) { setErr('Lender, AE name and email are required.'); return; }
    setSaving(true); setErr(null);
    try {
      const res = await fetch(editId ? `/api/lender-aes/${editId}` : '/api/lender-aes', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to save');
      setDrawer(false);
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setSaving(false); }
  }

  async function togglePreferred(ae: AE) {
    setAes((prev) => prev.map((x) => (x.id === ae.id ? { ...x, preferred: !x.preferred } : x)));
    await fetch(`/api/lender-aes/${ae.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preferred: !ae.preferred }) });
    load();
  }
  async function remove(ae: AE) {
    if (!confirm(`Remove ${ae.ae_name} (${ae.lender_name}) from your directory?`)) return;
    setAes((prev) => prev.filter((x) => x.id !== ae.id));
    await fetch(`/api/lender-aes/${ae.id}`, { method: 'DELETE' });
  }
  function toggleLoanType(lt: string) {
    setForm((f) => {
      const cur = f.loan_types ?? [];
      return { ...f, loan_types: cur.includes(lt) ? cur.filter((x) => x !== lt) : [...cur, lt] };
    });
  }
  function copy(text: string) { navigator.clipboard?.writeText(text).catch(() => {}); }

  if (loading) return <p className="text-[13px] text-[var(--c-label2)]">Loading directory…</p>;

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {['all', ...LOAN_TYPE_OPTIONS].map((lt) => (
            <button
              key={lt}
              onClick={() => setFilter(lt)}
              className={`text-[12px] px-2.5 py-1 rounded-full border transition-colors ${filter === lt ? 'border-[var(--c-gold)] bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]' : 'border-[var(--c-border)] text-[var(--c-label2)] hover:bg-[var(--c-fill)]'}`}
            >
              {lt === 'all' ? 'All' : LT_LABEL[lt] ?? lt}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="text-[12px] bg-[var(--c-fill)] rounded-[8px] px-2 py-1.5 focus:outline-none">
            <option value="performance">Sort: Performance</option>
            <option value="response">Sort: Response time</option>
            <option value="alpha">Sort: A–Z</option>
          </select>
          <Button onClick={openAdd}><Plus size={14} /> Add AE</Button>
        </div>
      </div>

      {/* Grid */}
      {scored.length === 0 ? (
        <div className="text-center py-16 text-[13px] text-[var(--c-label2)]">
          No AEs yet. Add your lender Account Executives to build your directory.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {scored.map(({ ae, score }) => {
            const tier = scoreTier(score);
            return (
              <div key={ae.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px] font-semibold text-[var(--c-text)] truncate">{ae.lender_name}</span>
                      <span className="text-[10px] uppercase tracking-wide text-[var(--c-label3)]">{ae.lender_type.replace('_', ' ')}</span>
                    </div>
                    <div className="text-[12px] text-[var(--c-label2)] truncate">{ae.ae_name}{ae.ae_title ? ` · ${ae.ae_title}` : ''}</div>
                  </div>
                  <button onClick={() => togglePreferred(ae)} aria-label="Toggle preferred" title="Preferred">
                    <Star size={16} className={ae.preferred ? 'fill-[var(--c-gold)] text-[var(--c-gold)]' : 'text-[var(--c-label3)]'} />
                  </button>
                </div>

                {/* Score bar */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-[var(--c-label2)]">{tier.label}</span>
                    <span className="font-medium text-[var(--c-text)]">{score}{ae.response_time_avg_hours != null && <span className="text-[var(--c-label3)]"> · ~{ae.response_time_avg_hours}h</span>}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--c-fill)] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${score}%`, background: TONE[tier.tone] }} />
                  </div>
                </div>

                {/* Loan types */}
                {ae.loan_types.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {ae.loan_types.map((lt) => (
                      <span key={lt} className="text-[10px] bg-[var(--c-fill)] text-[var(--c-label2)] rounded-full px-1.5 py-0.5">{LT_LABEL[lt] ?? lt}</span>
                    ))}
                  </div>
                )}

                {/* Contact actions */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <a href={`mailto:${ae.ae_email}`} className="flex items-center gap-1 text-[11px] text-[var(--c-label2)] hover:text-[var(--c-text)]" title={ae.ae_email}><Mail size={12} /> Email</a>
                  <button onClick={() => copy(ae.ae_email)} className="text-[var(--c-label3)] hover:text-[var(--c-text)]" title="Copy email"><Copy size={11} /></button>
                  {(ae.ae_cell || ae.ae_phone) && (
                    <>
                      <a href={`tel:${ae.ae_cell ?? ae.ae_phone}`} className="flex items-center gap-1 text-[11px] text-[var(--c-label2)] hover:text-[var(--c-text)] ml-1"><Phone size={12} /> {ae.ae_cell ? 'Cell' : 'Call'}</a>
                      <button onClick={() => copy(ae.ae_cell ?? ae.ae_phone ?? '')} className="text-[var(--c-label3)] hover:text-[var(--c-text)]" title="Copy phone"><Copy size={11} /></button>
                    </>
                  )}
                  {ae.lender_website && <a href={ae.lender_website} target="_blank" rel="noopener noreferrer" className="text-[var(--c-label3)] hover:text-[var(--c-text)] ml-1" title="Lender site"><ExternalLink size={12} /></a>}
                </div>

                {ae.notes && <p className="text-[11px] text-[var(--c-label2)] line-clamp-2">{ae.notes}</p>}

                <div className="flex items-center gap-3 pt-1 mt-auto border-t border-[var(--c-border)]">
                  <button onClick={() => setLogFor(ae)} className="flex items-center gap-1 text-[11px] text-[var(--c-gold-deep)] hover:underline"><Send size={11} /> Log submission</button>
                  <button onClick={() => openEdit(ae)} className="flex items-center gap-1 text-[11px] text-[var(--c-label2)] hover:text-[var(--c-text)]"><Pencil size={11} /> Edit</button>
                  <button onClick={() => remove(ae)} className="flex items-center gap-1 text-[11px] text-[var(--c-label2)] hover:text-[var(--c-danger)] ml-auto"><Trash2 size={11} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative w-full max-w-[420px] h-full bg-[var(--c-surface)] shadow-2xl overflow-y-auto p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[var(--c-text)]">{editId ? 'Edit AE' : 'Add AE'}</h3>
              <button onClick={() => setDrawer(false)} aria-label="Close"><X size={18} className="text-[var(--c-label2)]" /></button>
            </div>
            {err && <p className="text-[12px] text-[var(--c-danger)]">{err}</p>}
            {([
              ['lender_name', 'Lender name *'], ['lender_website', 'Lender website'],
              ['ae_name', 'AE name *'], ['ae_title', 'AE title'], ['ae_email', 'AE email *'],
              ['ae_phone', 'AE phone'], ['ae_cell', 'AE cell'], ['ae_linkedin', 'AE LinkedIn'],
            ] as const).map(([k, label]) => (
              <div key={k}>
                <label className="text-[11px] text-[var(--c-label2)]">{label}</label>
                <input
                  value={(form[k] as string) ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  className="w-full text-[13px] bg-[var(--c-fill)] rounded-[8px] px-2.5 py-2 mt-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]"
                />
              </div>
            ))}
            <div>
              <label className="text-[11px] text-[var(--c-label2)]">Lender type</label>
              <select value={form.lender_type ?? 'wholesale'} onChange={(e) => setForm((f) => ({ ...f, lender_type: e.target.value }))} className="w-full text-[13px] bg-[var(--c-fill)] rounded-[8px] px-2.5 py-2 mt-0.5 focus:outline-none">
                {['wholesale', 'correspondent', 'retail', 'bank', 'credit_union'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[var(--c-label2)]">Loan types covered</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {LOAN_TYPE_OPTIONS.map((lt) => (
                  <button key={lt} onClick={() => toggleLoanType(lt)} className={`text-[11px] px-2 py-0.5 rounded-full border ${(form.loan_types ?? []).includes(lt) ? 'border-[var(--c-gold)] bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]' : 'border-[var(--c-border)] text-[var(--c-label2)]'}`}>
                    {LT_LABEL[lt] ?? lt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-[var(--c-label2)]">Notes</label>
              <textarea value={form.notes ?? ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className="w-full text-[13px] bg-[var(--c-fill)] rounded-[8px] px-2.5 py-2 mt-0.5 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]" />
            </div>
            <label className="flex items-center gap-2 text-[12px] text-[var(--c-text)]">
              <input type="checkbox" checked={form.preferred ?? false} onChange={(e) => setForm((f) => ({ ...f, preferred: e.target.checked }))} /> Preferred AE
            </label>
            <Button onClick={save} disabled={saving} className="w-full">{saving ? 'Saving…' : editId ? 'Save changes' : 'Add AE'}</Button>
          </div>
        </div>
      )}

      {logFor && <LogSubmissionModal ae={logFor} onClose={() => setLogFor(null)} onDone={() => { setLogFor(null); load(); }} />}
    </div>
  );
}

function LogSubmissionModal({ ae, onClose, onDone }: { ae: AE; onClose: () => void; onDone: () => void }) {
  const [loanType, setLoanType] = useState(ae.loan_types[0] ?? 'conventional');
  const [amount, setAmount] = useState('');
  const [outcome, setOutcome] = useState('pending');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await fetch(`/api/lender-aes/${ae.id}/log-submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loan_type: loanType, loan_amount: amount ? Number(amount) : null, outcome }),
    });
    setSaving(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative w-full max-w-[360px] bg-[var(--c-surface)] rounded-[14px] shadow-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[15px] font-semibold text-[var(--c-text)]">Log submission to {ae.ae_name}</h3>
        <div>
          <label className="text-[11px] text-[var(--c-label2)]">Loan type</label>
          <select value={loanType} onChange={(e) => setLoanType(e.target.value)} className="w-full text-[13px] bg-[var(--c-fill)] rounded-[8px] px-2.5 py-2 mt-0.5 focus:outline-none">
            {LOAN_TYPE_OPTIONS.map((lt) => <option key={lt} value={lt}>{LT_LABEL[lt] ?? lt}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-[var(--c-label2)]">Loan amount</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="450000" className="w-full text-[13px] bg-[var(--c-fill)] rounded-[8px] px-2.5 py-2 mt-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]" />
        </div>
        <div>
          <label className="text-[11px] text-[var(--c-label2)]">Outcome</label>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="w-full text-[13px] bg-[var(--c-fill)] rounded-[8px] px-2.5 py-2 mt-0.5 focus:outline-none">
            {['pending', 'approved', 'suspended', 'denied', 'withdrawn'].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <Button onClick={submit} disabled={saving} className="w-full">{saving ? 'Logging…' : 'Log submission'}</Button>
      </div>
    </div>
  );
}
