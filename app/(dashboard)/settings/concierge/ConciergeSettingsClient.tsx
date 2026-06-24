'use client';

/**
 * Phase 144 — Ashley Concierge persona + autonomy configuration (per LO).
 */
import { useEffect, useState } from 'react';
import { Loader2, Bot, ShieldCheck, Zap } from 'lucide-react';

interface Settings {
  enabled: boolean;
  autonomy_default: 'off' | 'suggest' | 'autonomous';
  allow_autonomous: boolean;
  speed_to_lead: boolean;
  persona_tone: string;
  persona_specialties: string | null;
  products: string | null;
  business_goal: string;
  booking_url: string | null;
  application_url: string | null;
  max_ai_replies: number;
  custom_instructions: string | null;
}

export function ConciergeSettingsClient() {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { fetch('/api/concierge/settings').then((r) => r.json()).then((j) => setS(j.settings)); }, []);

  const save = async () => {
    if (!s) return;
    setSaving(true); setSaved(false);
    const r = await fetch('/api/concierge/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
    setSaving(false);
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  };

  if (!s) return <div className="flex items-center gap-2 text-[13px] text-[var(--c-label2)] py-6"><Loader2 size={14} className="animate-spin" /> Loading…</div>;
  const set = (patch: Partial<Settings>) => setS({ ...s, ...patch });

  return (
    <div className="space-y-5 max-w-2xl">
      <Card>
        <Toggle label="Enable Ashley Concierge" desc="Let Ashley respond to inbound borrower texts on your behalf." checked={s.enabled} onChange={(v) => set({ enabled: v })} icon={<Bot size={15} />} />
        <Field label="Default mode for new conversations">
          <select value={s.autonomy_default} onChange={(e) => set({ autonomy_default: e.target.value as Settings['autonomy_default'] })} className={input}>
            <option value="off">Off — never reply automatically</option>
            <option value="suggest">Suggest — draft replies for me to approve</option>
            <option value="autonomous">Autonomous — send replies automatically</option>
          </select>
        </Field>
        <Toggle label="Allow autonomous sending" desc="Master switch. Off = Ashley only ever drafts, even on autonomous leads. Every auto-send still passes the TCPA gate and the compliance guard." checked={s.allow_autonomous} onChange={(v) => set({ allow_autonomous: v })} icon={<ShieldCheck size={15} />} />
        <Toggle label="Speed-to-lead first touch" desc="When a new lead comes in with SMS consent, Ashley sends the very first text within ~a minute and opens the conversation in your default mode." checked={s.speed_to_lead} onChange={(v) => set({ speed_to_lead: v })} icon={<Zap size={15} />} />
      </Card>

      <Card title="Persona">
        <Field label="Tone"><input value={s.persona_tone} onChange={(e) => set({ persona_tone: e.target.value })} className={input} /></Field>
        <Field label="Specialties (optional)"><input value={s.persona_specialties ?? ''} onChange={(e) => set({ persona_specialties: e.target.value })} placeholder="FHA, VA, first-time buyers, self-employed" className={input} /></Field>
        <Field label="Products / programs to mention (no pricing)"><textarea value={s.products ?? ''} onChange={(e) => set({ products: e.target.value })} rows={2} placeholder="Conventional, FHA, VA, DSCR, bank-statement" className={input} /></Field>
        <Field label="Goal of the conversation"><input value={s.business_goal} onChange={(e) => set({ business_goal: e.target.value })} className={input} /></Field>
        <Field label="Extra instructions (optional)"><textarea value={s.custom_instructions ?? ''} onChange={(e) => set({ custom_instructions: e.target.value })} rows={2} className={input} /></Field>
      </Card>

      <Card title="Links Ashley can share">
        <Field label="Booking link (for book a call)"><input value={s.booking_url ?? ''} onChange={(e) => set({ booking_url: e.target.value })} placeholder="https://calendly.com/you" className={input} /></Field>
        <Field label="Application link (to start a 1003)"><input value={s.application_url ?? ''} onChange={(e) => set({ application_url: e.target.value })} placeholder="https://yourbrokerage.ashleyiq.com/you" className={input} /></Field>
        <Field label="Max AI replies per conversation"><input type="number" min={1} max={20} value={s.max_ai_replies} onChange={(e) => set({ max_ai_replies: Number(e.target.value) })} className={`${input} w-24`} /></Field>
      </Card>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-[13px] font-medium bg-[var(--c-text)] text-[var(--c-surface)] hover:opacity-90 disabled:opacity-50">{saving && <Loader2 size={14} className="animate-spin" />} Save</button>
        {saved && <span className="text-[13px] text-emerald-600">Saved.</span>}
      </div>
    </div>
  );
}

const input = 'w-full px-2.5 py-2 rounded-btn border border-[var(--c-border)] bg-[var(--c-surface)] text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-gold-deep)]';
function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return <div className="border border-[var(--c-border)] rounded-[14px] p-4 space-y-3">{title && <h2 className="text-[14px] font-semibold text-[var(--c-text)]">{title}</h2>}{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[12px] font-medium text-[var(--c-label2)] mb-1 block">{label}</span>{children}</label>;
}
function Toggle({ label, desc, checked, onChange, icon }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[var(--c-text)] flex items-center gap-1.5">{icon && <span className="text-[var(--c-gold-deep)]">{icon}</span>}{label}</div>
        <p className="text-[12px] text-[var(--c-label2)] mt-0.5">{desc}</p>
      </div>
      <button onClick={() => onChange(!checked)} className={`shrink-0 w-10 h-6 rounded-full transition-colors ${checked ? 'bg-[var(--c-gold-deep)]' : 'bg-[var(--c-border)]'}`}>
        <span className={`block w-4 h-4 bg-white rounded-full transition-transform mt-1 ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}
