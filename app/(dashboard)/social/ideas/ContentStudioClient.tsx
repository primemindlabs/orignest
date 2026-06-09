'use client';

/** Phase 56.4 — AI Content Studio: idea generator + LinkedIn note composer. */
import { useState, useEffect } from 'react';
import { Sparkles, Copy, Check, Linkedin, Lightbulb } from 'lucide-react';

interface Idea { type: string; title: string; caption: string; hashtags: string[]; image_concept?: string }
interface SeedIdea { id: string; content_type: string; title: string; caption_template: string; suggested_hashtags: string[] }

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return <button onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }} className="text-[var(--c-gold-deep)] hover:opacity-80">{done ? <Check size={14} /> : <Copy size={14} />}</button>;
}

export function ContentStudioClient() {
  const [tab, setTab] = useState<'ideas' | 'linkedin'>('ideas');
  const [seeds, setSeeds] = useState<SeedIdea[]>([]);
  // ideas
  const [ctx, setCtx] = useState({ market_conditions: 'stable', target_audience: 'first_time_buyers', recent_closings: '' });
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [busy, setBusy] = useState(false);
  // linkedin
  const [li, setLi] = useState({ prospect_name: '', prospect_title: '', prospect_company: '', connection_context: 'realtor_in_target_market' });
  const [note, setNote] = useState<{ note: string; length: number } | null>(null);
  const [liBusy, setLiBusy] = useState(false);

  useEffect(() => { fetch('/api/social/content-ideas').then((r) => (r.ok ? r.json() : null)).then((d) => d && setSeeds(d.ideas ?? [])); }, []);

  async function gen() {
    setBusy(true); setIdeas([]);
    try { const r = await fetch('/api/social/content-ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'ideas', ...ctx, recent_closings: Number(ctx.recent_closings) || 0 }) }); if (r.ok) setIdeas((await r.json()).ideas ?? []); }
    finally { setBusy(false); }
  }
  async function compose() {
    if (!li.prospect_name) return;
    setLiBusy(true); setNote(null);
    try { const r = await fetch('/api/social/content-ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'linkedin', ...li }) }); if (r.ok) setNote(await r.json()); }
    finally { setLiBusy(false); }
  }

  const inp = 'w-full mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[var(--c-text)]';

  return (
    <div className="space-y-5">
      <div className="flex gap-2 border-b border-[var(--c-border)]">
        {([['ideas', 'Content ideas', Lightbulb], ['linkedin', 'LinkedIn note', Linkedin]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 -mb-px ${tab === k ? 'border-[var(--c-gold)] text-[var(--c-text)]' : 'border-transparent text-[var(--c-label2)]'}`}><Icon size={14} /> {label}</button>
        ))}
      </div>

      {tab === 'ideas' && (
        <div className="space-y-4">
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 grid grid-cols-3 gap-2">
            <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Market</span><select value={ctx.market_conditions} onChange={(e) => setCtx((x) => ({ ...x, market_conditions: e.target.value }))} className={inp}>{['stable', 'rates_rising', 'rates_falling', 'inventory_low'].map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}</select></label>
            <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Audience</span><select value={ctx.target_audience} onChange={(e) => setCtx((x) => ({ ...x, target_audience: e.target.value }))} className={inp}>{['first_time_buyers', 'move_up', 'investors', 'refinance'].map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}</select></label>
            <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Closings (mo)</span><input type="number" value={ctx.recent_closings} onChange={(e) => setCtx((x) => ({ ...x, recent_closings: e.target.value }))} className={inp} /></label>
            <button onClick={gen} disabled={busy} className="col-span-3 inline-flex items-center justify-center gap-1.5 h-9 rounded-btn text-[13px] font-medium bg-[var(--c-gold)] text-white disabled:opacity-60"><Sparkles size={14} /> {busy ? 'Generating…' : 'Generate ideas'}</button>
          </div>
          {ideas.map((i, n) => (
            <div key={n} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-4">
              <div className="flex items-start justify-between gap-2"><div><span className="text-[9px] uppercase text-[var(--c-label2)] border border-[var(--c-border)] rounded px-1 py-0.5">{i.type?.replace(/_/g, ' ')}</span><p className="text-[14px] font-semibold text-[var(--c-text)] mt-1">{i.title}</p></div><CopyBtn text={`${i.caption}\n\n${(i.hashtags ?? []).map((h) => '#' + h).join(' ')}`} /></div>
              <p className="text-[12px] text-[var(--c-label2)] whitespace-pre-wrap mt-2 leading-relaxed">{i.caption}</p>
              {i.hashtags?.length > 0 && <p className="text-[11px] text-[var(--c-gold-deep)] mt-2">{i.hashtags.map((h) => '#' + h).join(' ')}</p>}
              {i.image_concept && <p className="text-[11px] text-[var(--c-label2)] italic mt-1">📷 {i.image_concept}</p>}
            </div>
          ))}
          {seeds.length > 0 && ideas.length === 0 && !busy && (
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-2">Starter library</p><div className="space-y-2">{seeds.map((s) => (
              <div key={s.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-4"><div className="flex items-start justify-between"><p className="text-[13px] font-semibold text-[var(--c-text)]">{s.title}</p><CopyBtn text={s.caption_template} /></div><p className="text-[12px] text-[var(--c-label2)] whitespace-pre-wrap mt-1 leading-relaxed">{s.caption_template}</p></div>
            ))}</div></div>
          )}
        </div>
      )}

      {tab === 'linkedin' && (
        <div className="space-y-3">
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 grid grid-cols-2 gap-2">
            <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Prospect name</span><input value={li.prospect_name} onChange={(e) => setLi((x) => ({ ...x, prospect_name: e.target.value }))} className={inp} /></label>
            <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Title</span><input value={li.prospect_title} onChange={(e) => setLi((x) => ({ ...x, prospect_title: e.target.value }))} placeholder="Realtor" className={inp} /></label>
            <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Company</span><input value={li.prospect_company} onChange={(e) => setLi((x) => ({ ...x, prospect_company: e.target.value }))} className={inp} /></label>
            <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Context</span><select value={li.connection_context} onChange={(e) => setLi((x) => ({ ...x, connection_context: e.target.value }))} className={inp}>{['realtor_in_target_market', 'past_client_network', 'recruiting'].map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}</select></label>
            <button onClick={compose} disabled={liBusy || !li.prospect_name} className="col-span-2 inline-flex items-center justify-center gap-1.5 h-9 rounded-btn text-[13px] font-medium bg-[var(--c-gold)] text-white disabled:opacity-60"><Sparkles size={14} /> {liBusy ? 'Composing…' : 'Compose note'}</button>
          </div>
          {note && (
            <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-4">
              <div className="flex items-start justify-between gap-2"><p className="text-[13px] text-[var(--c-text)] leading-relaxed">{note.note}</p><CopyBtn text={note.note} /></div>
              <p className="text-[11px] mt-2" style={{ color: note.length > 300 ? 'var(--c-danger)' : 'var(--c-label2)' }}>{note.length}/300 characters</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
