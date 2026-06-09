'use client';

/** Phase 61.2 — Text-to-Apply keyword setup + flow preview. */
import { useState, useEffect, useCallback } from 'react';
import { Plus, MessageSquare, Power } from 'lucide-react';

interface KW { id: string; twilio_number: string; keyword: string; is_active: boolean; leads: number }

export function TextToApplyClient() {
  const [kws, setKws] = useState<KW[]>([]);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ twilio_number: '', keyword: '' });
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => { const r = await fetch('/api/text-to-apply/keywords'); if (r.ok) setKws((await r.json()).keywords ?? []); }, []);
  useEffect(() => { load(); }, [load]);

  async function add() {
    setErr(null);
    const r = await fetch('/api/text-to-apply/keywords', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    const d = await r.json();
    if (r.ok) { setAdding(false); setF({ twilio_number: '', keyword: '' }); await load(); }
    else setErr(d.error ?? 'Could not add');
  }
  async function toggle(k: KW) { await fetch('/api/text-to-apply/keywords', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id, is_active: !k.is_active }) }); load(); }

  const inp = 'w-full mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[var(--c-text)]';

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2"><p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-label2)]">Keywords</p><button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-1 text-[12px] text-[var(--c-gold-deep)] hover:underline"><Plus size={12} /> Add keyword</button></div>
        {kws.length === 0 && !adding ? <p className="text-[13px] text-[var(--c-label2)]">No keywords yet. Add one to let prospects text to pre-qualify.</p> : (
          <div className="space-y-2">
            {kws.map((k) => (
              <div key={k.id} className="flex items-center justify-between bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[10px] px-3 py-2.5">
                <div><p className="text-[13px] font-semibold text-[var(--c-text)]">{k.keyword} <span className="text-[11px] text-[var(--c-label2)] font-normal">→ {k.twilio_number}</span></p><p className="text-[11px] text-[var(--c-label2)]">{k.leads} lead{k.leads === 1 ? '' : 's'}</p></div>
                <button onClick={() => toggle(k)} className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: k.is_active ? '#27AE60' : 'var(--c-label2)' }}><Power size={12} /> {k.is_active ? 'Active' : 'Disabled'}</button>
              </div>
            ))}
          </div>
        )}
        {adding && (
          <div className="mt-2 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-3 grid grid-cols-2 gap-2">
            <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Twilio number</span><input value={f.twilio_number} onChange={(e) => setF((x) => ({ ...x, twilio_number: e.target.value }))} placeholder="+15558675309" className={inp} /></label>
            <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Keyword</span><input value={f.keyword} onChange={(e) => setF((x) => ({ ...x, keyword: e.target.value }))} placeholder="APPLY" className={inp} /></label>
            {err && <p className="text-[11px] text-[var(--c-danger)] col-span-2">{err}</p>}
            <button onClick={add} disabled={!f.twilio_number || !f.keyword} className="col-span-2 h-8 rounded-btn text-[12px] font-medium bg-[var(--c-gold)] text-white disabled:opacity-60">Add</button>
          </div>
        )}
      </div>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
        <div className="flex items-center gap-2 mb-2"><MessageSquare size={15} className="text-[var(--c-gold-deep)]" /><p className="text-[13px] font-semibold text-[var(--c-text)]">Your pre-qual flow</p></div>
        <ol className="text-[12px] text-[var(--c-label2)] space-y-1 list-decimal ml-4">
          <li>Prospect texts your keyword → receives a TCPA consent request.</li>
          <li>After they reply YES: 5 questions (purpose, amount, credit, employment, timeline).</li>
          <li>Name + email collected, lead created in your pipeline with a pre-qual score.</li>
          <li>You get an instant notification; they get a white-labeled confirmation.</li>
        </ol>
        <p className="text-[11px] text-[var(--c-label2)] mt-2 italic">SMS delivery activates once Twilio is connected; STOP replies always suppress + add to DNC.</p>
      </div>
    </div>
  );
}
