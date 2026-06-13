'use client';

// Phase 120 — AE Deal Desk board: pipeline columns, create modal, request drawer with thread.
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconPlus, IconX, IconCopy, IconCheck, IconSend, IconCircleCheck, IconCircleX, IconExternalLink,
} from '@tabler/icons-react';

interface Lead { id: string; first_name: string | null; last_name: string | null; loan_amount: number | null }
interface Ae { id: string; lender_name: string | null; ae_name: string | null; ae_email: string | null }
interface Req {
  id: string; status: string; lender_name: string | null; ae_name: string | null; ae_email: string | null;
  loan_type: string | null; loan_amount: number | null; ltv: number | null; fico_score: number | null;
  loan_purpose: string | null; occupancy: string | null; requested_rate: number | null; requested_price: number | null;
  lock_period_days: number | null; exception_reason: string | null; notes: string | null;
  ae_offered_rate: number | null; ae_offered_price: number | null; ae_response_notes: string | null;
  converted_to_scenario_id: string | null; created_at: string;
  lead?: { id: string; first_name: string | null; last_name: string | null } | null;
}
interface Msg { id: string; sender_type: string; sender_name: string | null; body: string; created_at: string }

const money = (n: number | null) => (n == null ? '—' : `$${Math.round(n).toLocaleString()}`);
const pct = (n: number | null) => (n == null ? '—' : `${n}%`);
const leadName = (l?: { first_name: string | null; last_name: string | null } | null) =>
  l ? [l.first_name, l.last_name].filter(Boolean).join(' ') || 'Borrower' : 'Borrower';

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-500' },
  submitted: { label: 'Awaiting AE', cls: 'bg-blue-50 text-blue-600' },
  in_review: { label: 'In review', cls: 'bg-blue-50 text-blue-600' },
  responded: { label: 'Responded', cls: 'bg-amber-50 text-amber-600' },
  approved: { label: 'Accepted', cls: 'bg-green-50 text-green-600' },
  declined: { label: 'Declined', cls: 'bg-red-50 text-red-500' },
  expired: { label: 'Expired', cls: 'bg-gray-100 text-gray-400' },
};

const COLUMNS: { key: string; label: string; match: (s: string) => boolean }[] = [
  { key: 'draft', label: 'Draft', match: (s) => s === 'draft' },
  { key: 'awaiting', label: 'Awaiting AE', match: (s) => s === 'submitted' || s === 'in_review' },
  { key: 'responded', label: 'Responded', match: (s) => s === 'responded' },
  { key: 'closed', label: 'Closed', match: (s) => ['approved', 'declined', 'expired'].includes(s) },
];

export function DealDeskBoard({ initialRequests, aes, leads, presetLeadId }: {
  initialRequests: Req[]; aes: Ae[]; leads: Lead[]; presetLeadId: string | null;
}) {
  const router = useRouter();
  const [requests] = useState<Req[]>(initialRequests);
  const [creating, setCreating] = useState(Boolean(presetLeadId));
  const [openId, setOpenId] = useState<string | null>(null);

  const open = requests.find((r) => r.id === openId) ?? null;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#C9A95C] px-4 py-2 text-sm font-semibold text-white hover:brightness-95">
          <IconPlus size={16} /> New pricing request
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const items = requests.filter((r) => col.match(r.status));
          return (
            <div key={col.key} className="bg-gray-50/60 rounded-2xl p-3 min-h-[120px]">
              <div className="flex items-center justify-between px-1 mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{col.label}</p>
                <span className="text-xs text-gray-400">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((r) => (
                  <button key={r.id} onClick={() => setOpenId(r.id)}
                    className="w-full text-left bg-white rounded-xl border border-gray-100 p-3 hover:border-[#C9A95C]/50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{leadName(r.lead)}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${(STATUS[r.status] ?? STATUS.draft).cls}`}>{(STATUS[r.status] ?? STATUS.draft).label}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{r.lender_name ?? 'No lender'}{r.ae_name ? ` · ${r.ae_name}` : ''}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
                      <span>{money(r.loan_amount)}</span>
                      {r.requested_rate != null && <span>req {pct(r.requested_rate)}</span>}
                      {r.ae_offered_rate != null && <span className="text-green-600 font-medium">AE {pct(r.ae_offered_rate)}</span>}
                    </div>
                  </button>
                ))}
                {items.length === 0 && <p className="text-xs text-gray-300 px-1 py-2">None</p>}
              </div>
            </div>
          );
        })}
      </div>

      {creating && (
        <CreateModal aes={aes} leads={leads} presetLeadId={presetLeadId}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); router.refresh(); }} />
      )}

      {open && (
        <RequestDrawer req={open} onClose={() => setOpenId(null)} onChanged={() => { setOpenId(null); router.refresh(); }} />
      )}
    </div>
  );
}

function CreateModal({ aes, leads, presetLeadId, onClose, onCreated }: {
  aes: Ae[]; leads: Lead[]; presetLeadId: string | null; onClose: () => void; onCreated: () => void;
}) {
  const [leadId, setLeadId] = useState(presetLeadId ?? '');
  const [aeId, setAeId] = useState('');
  const [form, setForm] = useState({ loan_type: '', loan_amount: '', ltv: '', fico_score: '', loan_purpose: '', occupancy: '', requested_rate: '', lock_period_days: '30', exception_reason: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Prefill loan amount from the chosen lead.
  useEffect(() => {
    const l = leads.find((x) => x.id === leadId);
    if (l?.loan_amount != null) setForm((f) => (f.loan_amount ? f : { ...f, loan_amount: String(l.loan_amount) }));
  }, [leadId, leads]);

  async function submit() {
    setErr(null);
    if (!leadId) { setErr('Choose a loan/borrower.'); return; }
    setBusy(true);
    const res = await fetch('/api/deal-desk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId, lender_ae_id: aeId || null, ...form }),
    });
    setBusy(false);
    if (res.ok) { onCreated(); return; }
    const j = await res.json().catch(() => ({}));
    setErr(j.error ?? 'Could not create request.');
  }

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">New pricing request</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><IconX size={18} /></button>
      </div>
      <div className="space-y-3">
        <Field label="Loan / borrower">
          <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className={inputCls}>
            <option value="">Select…</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{leadName(l)}{l.loan_amount ? ` — ${money(l.loan_amount)}` : ''}</option>)}
          </select>
        </Field>
        <Field label="Lender AE">
          <select value={aeId} onChange={(e) => setAeId(e.target.value)} className={inputCls}>
            <option value="">No specific AE</option>
            {aes.map((a) => <option key={a.id} value={a.id}>{[a.lender_name, a.ae_name].filter(Boolean).join(' · ')}{a.ae_email ? '' : ' (no email)'}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Loan type"><input value={form.loan_type} onChange={set('loan_type')} placeholder="Conventional" className={inputCls} /></Field>
          <Field label="Purpose">
            <select value={form.loan_purpose} onChange={set('loan_purpose')} className={inputCls}>
              <option value="">—</option>
              <option value="purchase">Purchase</option>
              <option value="rate_term_refi">Rate/term refi</option>
              <option value="cash_out">Cash-out</option>
              <option value="dscr">DSCR</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Loan amount"><input value={form.loan_amount} onChange={set('loan_amount')} inputMode="decimal" placeholder="450000" className={inputCls} /></Field>
          <Field label="LTV (%)"><input value={form.ltv} onChange={set('ltv')} inputMode="decimal" placeholder="80" className={inputCls} /></Field>
          <Field label="FICO"><input value={form.fico_score} onChange={set('fico_score')} inputMode="numeric" placeholder="740" className={inputCls} /></Field>
          <Field label="Occupancy"><input value={form.occupancy} onChange={set('occupancy')} placeholder="Primary" className={inputCls} /></Field>
          <Field label="Requested rate (%)"><input value={form.requested_rate} onChange={set('requested_rate')} inputMode="decimal" placeholder="6.25" className={inputCls} /></Field>
          <Field label="Lock (days)"><input value={form.lock_period_days} onChange={set('lock_period_days')} inputMode="numeric" className={inputCls} /></Field>
        </div>
        <Field label="Exception / ask"><textarea value={form.exception_reason} onChange={set('exception_reason')} rows={2} placeholder="e.g. Requesting LLPA exception for 740 FICO at 80 LTV" className={`${inputCls} resize-none`} /></Field>
        {err && <p className="text-xs text-red-500">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={busy} className="rounded-xl bg-[#C9A95C] px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50">{busy ? 'Saving…' : 'Create draft'}</button>
        </div>
      </div>
    </Overlay>
  );
}

function RequestDrawer({ req, onClose, onChanged }: { req: Req; onClose: () => void; onChanged: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadMsgs = useCallback(async () => {
    const res = await fetch(`/api/deal-desk/${req.id}/messages`);
    if (res.ok) { const j = await res.json(); setMsgs(j.messages ?? []); }
  }, [req.id]);
  useEffect(() => { loadMsgs(); }, [loadMsgs]);

  async function act(path: string, body?: object): Promise<unknown> {
    setErr(null); setBusy(true);
    const res = await fetch(`/api/deal-desk/${req.id}/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setErr((j as { error?: string }).error ?? 'Action failed.'); return null; }
    return j;
  }

  async function submit() {
    const j = (await act('submit')) as { respondUrl?: string; emailed?: boolean } | null;
    if (j?.respondUrl) setLink(j.respondUrl);
    await loadMsgs();
  }
  async function postNote() {
    if (!note.trim()) return;
    await act('messages', { body: note });
    setNote(''); await loadMsgs();
  }
  async function copyLink() {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
  }

  const s = STATUS[req.status] ?? STATUS.draft;
  const open = !['approved', 'declined', 'expired'].includes(req.status);

  return (
    <Overlay onClose={onClose} wide>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-gray-900">{leadName(req.lead)}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><IconX size={18} /></button>
      </div>
      <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>

      <div className="mt-4 grid grid-cols-2 gap-y-1.5 gap-x-4 text-sm">
        <Row k="Lender" v={req.lender_name ?? '—'} />
        <Row k="AE" v={req.ae_name ?? '—'} />
        <Row k="Loan type" v={req.loan_type ?? '—'} />
        <Row k="Purpose" v={req.loan_purpose ?? '—'} />
        <Row k="Loan amount" v={money(req.loan_amount)} />
        <Row k="LTV" v={pct(req.ltv)} />
        <Row k="FICO" v={req.fico_score != null ? String(req.fico_score) : '—'} />
        <Row k="Requested rate" v={pct(req.requested_rate)} />
      </div>
      {req.exception_reason && <p className="mt-3 text-sm text-gray-700"><span className="text-gray-400">Ask: </span>{req.exception_reason}</p>}

      {(req.ae_offered_rate != null || req.ae_offered_price != null || req.ae_response_notes) && (
        <div className="mt-4 rounded-xl border border-green-100 bg-green-50/50 p-3">
          <p className="text-xs font-semibold text-green-700 mb-1">AE response</p>
          <div className="flex gap-4 text-sm text-gray-900">
            {req.ae_offered_rate != null && <span>Rate {pct(req.ae_offered_rate)}</span>}
            {req.ae_offered_price != null && <span>Price {req.ae_offered_price}</span>}
          </div>
          {req.ae_response_notes && <p className="text-sm text-gray-700 mt-1">{req.ae_response_notes}</p>}
        </div>
      )}

      {link && (
        <div className="mt-4">
          <p className="text-xs text-gray-400 mb-1">AE response link (share if email wasn&apos;t delivered)</p>
          <div className="flex items-center gap-2">
            <input readOnly value={link} className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600" />
            <button onClick={copyLink} className="inline-flex items-center gap-1 rounded-xl bg-gray-900 px-3 py-2 text-xs font-medium text-white">{copied ? <IconCheck size={13} /> : <IconCopy size={13} />}{copied ? 'Copied' : 'Copy'}</button>
            <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-xl border border-gray-200 px-2 py-2 text-gray-500 hover:bg-gray-50"><IconExternalLink size={14} /></a>
          </div>
        </div>
      )}

      {/* Thread */}
      <div className="mt-4 border-t border-gray-100 pt-3">
        <p className="text-xs font-semibold text-gray-500 mb-2">Activity</p>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {msgs.map((m) => (
            <div key={m.id} className="text-sm">
              <span className={`text-[11px] font-medium ${m.sender_type === 'ae' ? 'text-green-600' : m.sender_type === 'system' ? 'text-gray-400' : 'text-[#C9A95C]'}`}>{m.sender_type === 'system' ? 'System' : (m.sender_name ?? (m.sender_type === 'ae' ? 'AE' : 'LO'))}</span>
              <span className="text-gray-700"> — {m.body}</span>
            </div>
          ))}
          {msgs.length === 0 && <p className="text-xs text-gray-300">No activity yet.</p>}
        </div>
        {open && (
          <div className="flex items-center gap-2 mt-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30" />
            <button onClick={postNote} disabled={busy || !note.trim()} className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">Post</button>
          </div>
        )}
      </div>

      {err && <p className="text-xs text-red-500 mt-3">{err}</p>}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
        {req.status === 'draft' && (
          <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-[#C9A95C] px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"><IconSend size={15} /> Submit to AE</button>
        )}
        {(req.status === 'submitted' || req.status === 'in_review') && (
          <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"><IconSend size={15} /> Resend / get AE link</button>
        )}
        {req.status === 'responded' && (
          <>
            <button onClick={() => act('accept').then((j) => j && onChanged())} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"><IconCircleCheck size={15} /> Accept → add scenario</button>
            <button onClick={() => act('decline').then((j) => j && onChanged())} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-sm text-red-500 hover:bg-red-50 disabled:opacity-50"><IconCircleX size={15} /> Decline</button>
          </>
        )}
        {open && req.status !== 'responded' && req.status !== 'draft' && (
          <button onClick={() => act('decline').then((j) => j && onChanged())} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50"><IconCircleX size={15} /> Close request</button>
        )}
      </div>
    </Overlay>
  );
}

const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs text-gray-400">{label}</span><div className="mt-1">{children}</div></label>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-2"><span className="text-gray-400">{k}</span><span className="text-gray-900 font-medium text-right">{v}</span></div>;
}
function Overlay({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 overflow-y-auto" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-xl' : 'max-w-lg'} my-8 p-5`} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}
