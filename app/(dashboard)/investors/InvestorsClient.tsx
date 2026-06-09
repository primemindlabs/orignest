'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, Plus, X, Link2, Lock, Home, Sparkles } from 'lucide-react';

export interface Entity {
  id: string;
  name: string;
  entity_type: string;
  contact_email: string | null;
  portfolio: { properties: number; loanVolume: number; totalValue: number; equity: number };
  properties: { lead_id: string; label: string }[];
}
export interface LeadOption { id: string; label: string }

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function InvestorsClient({ entities, leads, deedmineEnabled }: { entities: Entity[]; leads: LeadOption[]; deedmineEnabled: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [attachTo, setAttachTo] = useState<Entity | null>(null);

  const totals = entities.reduce(
    (s, e) => ({
      loanVolume: s.loanVolume + e.portfolio.loanVolume,
      equity: s.equity + e.portfolio.equity,
      properties: s.properties + e.portfolio.properties,
    }),
    { loanVolume: 0, equity: 0, properties: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-label tracking-tight">Investors</h1>
          <p className="text-[13px] text-label-2 mt-0.5">Entity resolution &amp; portfolio aggregation</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary inline-flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2">
          <Plus className="w-4 h-4" /> New entity
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          ['Entities', String(entities.length)],
          ['Properties', String(totals.properties)],
          ['Portfolio equity', usd(totals.equity)],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface rounded-2xl border border-border p-5 card-shadow">
            <div className="flex items-center gap-2 text-label-2 text-[12px] font-medium mb-2"><Building2 className="w-4 h-4 text-gold-600" strokeWidth={1.75} /> {label}</div>
            <div className="font-mono text-[26px] font-semibold text-label tracking-tight">{value}</div>
          </div>
        ))}
      </div>

      {/* DeedMine multi-property enrichment — credential-gated real disabled state */}
      {!deedmineEnabled && (
        <div className="bg-surface rounded-2xl border border-border p-4 card-shadow flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-black/[0.05] flex items-center justify-center"><Lock className="w-4 h-4 text-label-3" /></div>
          <div className="flex-1">
            <p className="text-[13px] font-medium text-label">DeedMine multi-property enrichment</p>
            <p className="text-[12px] text-label-2">Auto-discover an entity's full property portfolio via ATTOM. <span className="font-mono text-label-3">TODO: set DEEDMINE_API_KEY</span></p>
          </div>
          <span className="text-[11px] font-semibold text-label-3 border border-border rounded-full px-2.5 py-1">Not connected</span>
        </div>
      )}

      {entities.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-10 text-center card-shadow">
          <Building2 className="w-8 h-8 text-label-3 mx-auto mb-3" />
          <p className="text-sm font-medium text-label">No investor entities yet</p>
          <p className="text-xs text-label-2 mt-1">Create an entity (LLC, trust, individual) and attach their loans to aggregate the portfolio.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entities.map((e) => (
            <div key={e.id} className="bg-surface rounded-2xl border border-border p-5 card-shadow">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[15px] font-semibold text-label">{e.name}</p>
                    <span className="text-[10px] uppercase font-semibold bg-gold-50 text-gold-700 px-1.5 py-0.5 rounded">{e.entity_type}</span>
                  </div>
                  {e.contact_email && <p className="text-[12px] text-label-3">{e.contact_email}</p>}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {deedmineEnabled && <EnrichButton entityId={e.id} />}
                  <button onClick={() => setAttachTo(e)} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gold-700 hover:text-gold-600">
                    <Link2 className="w-3.5 h-3.5" /> Attach loan
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mt-3">
                {[
                  ['Properties', String(e.portfolio.properties)],
                  ['Loan volume', usd(e.portfolio.loanVolume)],
                  ['Total value', usd(e.portfolio.totalValue)],
                  ['Equity', usd(e.portfolio.equity)],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-[10px] uppercase tracking-wide text-label-3">{l}</p>
                    <p className="font-mono text-[15px] font-semibold text-label">{v}</p>
                  </div>
                ))}
              </div>

              {e.properties.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border space-y-1">
                  {e.properties.map((p) => (
                    <div key={p.lead_id} className="flex items-center gap-2 text-[12px] text-label-2">
                      <Home className="w-3.5 h-3.5 text-label-3" /> {p.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {creating && <EntityForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); router.refresh(); }} />}
      {attachTo && <AttachForm entity={attachTo} leads={leads} onClose={() => setAttachTo(null)} onSaved={() => { setAttachTo(null); router.refresh(); }} />}
    </div>
  );
}

function EnrichButton({ entityId }: { entityId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function enrich() {
    setBusy(true);
    try {
      const res = await fetch(`/api/investors/${entityId}/enrich`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Enrichment failed');
      toast.success(`Found ${json.discovered ?? 0} properties via ATTOM`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Enrichment failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <button onClick={enrich} disabled={busy} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gold-700 hover:text-gold-600 disabled:opacity-50">
      <Sparkles className="w-3.5 h-3.5" /> {busy ? 'Enriching…' : 'Enrich (ATTOM)'}
    </button>
  );
}

function EntityForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', entity_type: 'llc', contact_email: '' });
  const inputCls = 'w-full text-[13px] rounded-lg border border-border px-3 py-2 bg-surface text-label focus:outline-none';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name required');
    setSaving(true);
    try {
      const res = await fetch('/api/investors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed');
      toast.success('Entity created');
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 card-shadow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-[17px] font-semibold text-label">New investor entity</h2><button onClick={onClose} className="text-label-3 hover:text-label"><X className="w-5 h-5" /></button></div>
        <form onSubmit={submit} className="space-y-3">
          <input className={inputCls} placeholder="Entity name (e.g. Sunbelt Holdings LLC)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className={inputCls} value={form.entity_type} onChange={(e) => setForm({ ...form, entity_type: e.target.value })}>
            {['individual', 'llc', 'lp', 'trust', 'corporation', 'partnership'].map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
          </select>
          <input className={inputCls} type="email" placeholder="Contact email (optional)" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="text-[13px] font-medium text-label-2 px-4 py-2">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-[13px] font-semibold px-4 py-2 disabled:opacity-50">{saving ? 'Saving…' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AttachForm({ entity, leads, onClose, onSaved }: { entity: Entity; leads: LeadOption[]; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [leadId, setLeadId] = useState('');
  const attached = new Set(entity.properties.map((p) => p.lead_id));
  const available = leads.filter((l) => !attached.has(l.id));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!leadId) return toast.error('Pick a loan to attach');
    setSaving(true);
    try {
      const res = await fetch(`/api/investors/${entity.id}/properties`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: leadId }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed');
      toast.success('Loan attached');
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 card-shadow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-[17px] font-semibold text-label">Attach loan to {entity.name}</h2><button onClick={onClose} className="text-label-3 hover:text-label"><X className="w-5 h-5" /></button></div>
        <form onSubmit={submit} className="space-y-3">
          <select className="w-full text-[13px] rounded-lg border border-border px-3 py-2 bg-surface text-label focus:outline-none" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">Select a loan…</option>
            {available.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="text-[13px] font-medium text-label-2 px-4 py-2">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-[13px] font-semibold px-4 py-2 disabled:opacity-50">{saving ? 'Attaching…' : 'Attach'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
