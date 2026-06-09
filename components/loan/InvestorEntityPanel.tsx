'use client';

/** Phase 55.2 — borrowing entities + prior-loan exposure for investor loans. */
import { useState, useEffect, useCallback } from 'react';
import { BadgeCheck, Plus, Building2 } from 'lucide-react';

interface Entity { id: string; relationship: string; ownership_percentage: number | null; is_primary_signer: boolean; investor_entities: { id: string; name: string; entity_type: string | null; state_of_formation: string | null; ein_last4: string | null; is_verified: boolean } }
interface PriorLoan { lead_id: string; loan_amount: number | null; name: string; stage: string }

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const ENTITY_TYPES = ['llc', 's_corp', 'c_corp', 'trust', 'partnership', 'lp', 'individual'];
const RELATIONSHIPS = ['owner', 'member', 'trustee', 'guarantor', 'manager', 'partner'];

export function InvestorEntityPanel({ leadId }: { leadId: string }) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [prior, setPrior] = useState<PriorLoan[]>([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: '', entity_type: 'llc', state_of_formation: '', ein: '', relationship: 'owner', ownership_percentage: '', link_to_loan: true });

  const load = useCallback(async () => {
    const r = await fetch(`/api/investor-entities?lead_id=${leadId}`);
    if (r.ok) { const d = await r.json(); setEntities(d.entities ?? []); setPrior(d.prior_loans ?? []); }
  }, [leadId]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!f.name) return;
    setBusy(true);
    try {
      const r = await fetch('/api/investor-entities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: leadId, ...f, ownership_percentage: f.ownership_percentage === '' ? undefined : Number(f.ownership_percentage) }) });
      if (r.ok) { setAdding(false); setF({ name: '', entity_type: 'llc', state_of_formation: '', ein: '', relationship: 'owner', ownership_percentage: '', link_to_loan: true }); await load(); }
    } finally { setBusy(false); }
  }

  const inp = 'w-full mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[var(--c-text)]';
  const totalExposure = prior.reduce((s, l) => s + Number(l.loan_amount ?? 0), 0);

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Building2 size={15} className="text-[var(--c-gold-deep)]" /><p className="text-[13px] font-semibold text-[var(--c-text)]">Borrowing entities</p></div>
        <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-1 text-[12px] text-[var(--c-gold-deep)] hover:underline"><Plus size={12} /> Add entity</button>
      </div>

      {entities.length === 0 && !adding ? <p className="text-[12px] text-[var(--c-label2)] italic">No entities added. Most DSCR loans close in an LLC or trust.</p> : null}

      <div className="space-y-2">
        {entities.map((e) => {
          const ie = e.investor_entities;
          return (
            <div key={e.id} className="bg-[var(--c-bg)] border border-[var(--c-border)] rounded-[10px] p-3 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-[var(--c-text)] flex items-center gap-1.5">{ie.name}{ie.is_verified && <BadgeCheck size={13} className="text-[#27AE60]" />}</p>
                <p className="text-[11px] text-[var(--c-label2)]">{ie.entity_type?.toUpperCase() ?? '—'}{ie.state_of_formation ? ` · ${ie.state_of_formation}` : ''}{e.ownership_percentage != null ? ` · ${e.ownership_percentage}% ownership` : ''}{ie.ein_last4 ? ` · EIN ••••${ie.ein_last4}` : ''}</p>
              </div>
              <span className="text-[10px] uppercase text-[var(--c-label2)]">{e.relationship}{e.is_primary_signer ? ' · signer' : ''}</span>
            </div>
          );
        })}
      </div>

      {adding && (
        <div className="border-t border-[var(--c-border)] pt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block col-span-2"><span className="text-[11px] text-[var(--c-label2)]">Entity name</span><input value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} placeholder="JRS Holdings LLC" className={inp} /></label>
            <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Type</span><select value={f.entity_type} onChange={(e) => setF((x) => ({ ...x, entity_type: e.target.value }))} className={inp}>{ENTITY_TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}</select></label>
            <label className="block"><span className="text-[11px] text-[var(--c-label2)]">State of formation</span><input value={f.state_of_formation} onChange={(e) => setF((x) => ({ ...x, state_of_formation: e.target.value }))} placeholder="TX" className={inp} /></label>
            <label className="block"><span className="text-[11px] text-[var(--c-label2)]">EIN (encrypted)</span><input value={f.ein} onChange={(e) => setF((x) => ({ ...x, ein: e.target.value }))} placeholder="12-3456789" className={inp} /></label>
            <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Relationship</span><select value={f.relationship} onChange={(e) => setF((x) => ({ ...x, relationship: e.target.value }))} className={inp}>{RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
            <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Ownership %</span><input type="number" value={f.ownership_percentage} onChange={(e) => setF((x) => ({ ...x, ownership_percentage: e.target.value }))} className={inp} /></label>
            <label className="flex items-center gap-2 col-span-2 mt-1"><input type="checkbox" checked={f.link_to_loan} onChange={(e) => setF((x) => ({ ...x, link_to_loan: e.target.checked }))} /><span className="text-[12px] text-[var(--c-text)]">Use this entity for this loan (vesting)</span></label>
          </div>
          <button onClick={save} disabled={busy || !f.name} className="h-8 px-4 rounded-btn text-[12px] font-medium bg-[var(--c-gold)] text-white disabled:opacity-60">{busy ? 'Saving…' : 'Add entity'}</button>
        </div>
      )}

      {prior.length > 0 && (
        <div className="border-t border-[var(--c-border)] pt-3">
          <p className="text-[12px] font-semibold text-[var(--c-text)] mb-2">Prior loans across these entities ({prior.length})</p>
          <div className="space-y-1">
            {prior.map((l) => (
              <a key={l.lead_id} href={`/leads/${l.lead_id}`} className="flex items-center justify-between text-[12px] hover:bg-[var(--c-fill)] rounded px-2 py-1"><span className="text-[var(--c-text)]">{l.name} · <span className="text-[var(--c-label2)]">{l.stage.replace(/_/g, ' ')}</span></span><span className="font-mono text-[var(--c-label2)]">{l.loan_amount ? usd(Number(l.loan_amount)) : '—'}</span></a>
            ))}
          </div>
          <p className="text-[11px] text-[var(--c-label2)] mt-2">Total exposure: <span className="font-mono text-[var(--c-gold-deep)]">{usd(totalExposure)}</span></p>
        </div>
      )}
    </div>
  );
}
