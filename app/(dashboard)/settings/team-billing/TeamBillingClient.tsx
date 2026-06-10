'use client';

/** Phase 67 — team seat-billing controls: mode, usage metering, per-LO comp. */
import { useState, useEffect, useCallback } from 'react';

interface Config { seat_billing_mode: string; usage_billing_enabled: boolean; included_sms_per_seat: number; included_voice_minutes_per_seat: number; overage_sms_price_cents: number; overage_voice_price_cents: number }
interface LO { user_id: string; name: string; status: string; branch_covers_seat: boolean; branch_covers_usage: boolean; sms: number; voice_minutes: number }

const MODES = [
  { value: 'branch_pays_all', label: 'Branch pays everything', desc: 'Your subscription covers all LO seats and usage. One invoice.' },
  { value: 'lo_pays_seat', label: 'Each LO pays their own seat', desc: 'You invite LOs; they subscribe independently. You see status, not their card.' },
  { value: 'branch_pays_seat_lo_pays_usage', label: 'Branch pays seat, LO pays usage', desc: 'You cover the monthly seat. LOs are billed for calls/texts above their bundle.' },
];
const STATUS: Record<string, { label: string; color: string }> = { active: { label: 'Active', color: '#27AE60' }, comped: { label: 'Comped', color: 'var(--c-gold-deep)' }, invited: { label: 'Invite sent', color: '#3A5C7A' }, trial: { label: 'Trial', color: '#6450B4' }, grace_period: { label: 'Grace', color: '#F39C12' }, lapsed: { label: 'Lapsed', color: 'var(--c-danger)' } };

export function TeamBillingClient() {
  const [config, setConfig] = useState<Config | null>(null);
  const [los, setLos] = useState<LO[]>([]);
  const [buckets, setBuckets] = useState<{ automated_events: number; manual_events: number } | null>(null);

  const load = useCallback(async () => { const r = await fetch('/api/billing/seat-config'); if (r.ok) { const d = await r.json(); setConfig(d.config); setLos(d.los ?? []); setBuckets(d.buckets); } }, []);
  useEffect(() => { load(); }, [load]);

  async function setMode(mode: string) { await fetch('/api/billing/seat-config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seat_billing_mode: mode }) }); load(); }
  async function toggleUsage(v: boolean) { await fetch('/api/billing/seat-config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usage_billing_enabled: v }) }); load(); }
  async function comp(lo: LO) { await fetch(`/api/team/${lo.user_id}/billing-override`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branch_covers_seat: !lo.branch_covers_seat }) }); load(); }

  if (!config) return <p className="text-[13px] text-[var(--c-label2)]">Loading…</p>;

  return (
    <div className="space-y-5">
      {buckets && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-4"><p className="text-[10px] uppercase tracking-wide text-[var(--c-label3)]">Automated comms (branch absorbs)</p><p className="text-[20px] font-bold text-[var(--c-text)] mt-0.5">{buckets.automated_events}</p></div>
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-4"><p className="text-[10px] uppercase tracking-wide text-[var(--c-label3)]">Manual comms (bundle/overage)</p><p className="text-[20px] font-bold text-[var(--c-text)] mt-0.5">{buckets.manual_events}</p></div>
        </div>
      )}

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
        <p className="text-[13px] font-semibold text-[var(--c-text)] mb-3">Who pays for LO seats?</p>
        <div className="space-y-2">
          {MODES.map((m) => (
            <label key={m.value} className="flex items-start gap-3 cursor-pointer">
              <input type="radio" name="mode" checked={config.seat_billing_mode === m.value} onChange={() => setMode(m.value)} className="mt-1 accent-[var(--c-gold)]" />
              <div><p className="text-[13px] font-medium text-[var(--c-text)]">{m.label}</p><p className="text-[12px] text-[var(--c-label2)]">{m.desc}</p></div>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 flex items-center justify-between">
        <div><p className="text-[13px] font-semibold text-[var(--c-text)]">Meter call &amp; text usage</p><p className="text-[12px] text-[var(--c-label2)]">{config.included_sms_per_seat} SMS + {config.included_voice_minutes_per_seat} min/seat included. Overage ${(config.overage_sms_price_cents / 100).toFixed(2)}/SMS, ${(config.overage_voice_price_cents / 100).toFixed(2)}/min. Automated comms never count.</p></div>
        <input type="checkbox" checked={config.usage_billing_enabled} onChange={(e) => toggleUsage(e.target.checked)} className="w-5 h-5 accent-[var(--c-gold)]" />
      </div>

      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-2">LO billing status</p>
        {los.length === 0 ? <p className="text-[13px] text-[var(--c-label2)]">No LO billing records yet.</p> : (
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead><tr className="text-[10px] uppercase text-[var(--c-label2)] border-b border-[var(--c-border)]"><th className="text-left px-4 py-2">LO</th><th className="text-left px-4 py-2">Status</th><th className="text-right px-4 py-2">SMS</th><th className="text-right px-4 py-2">Voice</th><th className="text-right px-4 py-2"></th></tr></thead>
              <tbody>
                {los.map((lo) => { const s = STATUS[lo.status] ?? { label: lo.status, color: 'var(--c-label2)' }; return (
                  <tr key={lo.user_id} className="border-b border-[var(--c-border)] last:border-0">
                    <td className="px-4 py-2.5 text-[var(--c-text)]">{lo.name}</td>
                    <td className="px-4 py-2.5"><span className="text-[11px] font-semibold" style={{ color: s.color }}>{s.label}</span></td>
                    <td className="px-4 py-2.5 text-right font-mono text-[var(--c-label2)]">{lo.sms}<span className="text-[var(--c-label3)]">/{config.included_sms_per_seat}</span></td>
                    <td className="px-4 py-2.5 text-right font-mono text-[var(--c-label2)]">{lo.voice_minutes}<span className="text-[var(--c-label3)]">/{config.included_voice_minutes_per_seat}</span></td>
                    <td className="px-4 py-2.5 text-right"><button onClick={() => comp(lo)} className="text-[11px] text-[var(--c-gold-deep)] hover:underline">{lo.branch_covers_seat ? 'Uncomp' : 'Comp seat'}</button></td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[11px] text-[var(--c-label2)] italic">Stripe metered billing + LO self-pay checkout activate once Stripe meter IDs + seat prices are configured. Payment methods are never visible to the branch.</p>
    </div>
  );
}
