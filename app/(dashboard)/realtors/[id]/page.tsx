import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Building2, Mail, Phone, Gift, StickyNote, PhoneCall, Users } from 'lucide-react';
import { computePartnershipScore, TIER_LABELS, TIER_COLORS, type PartnershipTier } from '@/lib/realtors/partnershipScore';
import { NotesEditor } from './NotesEditor';
import { RealtorEngagement } from './RealtorEngagement';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Realtor' };

const TOUCH_LABEL: Record<string, string> = { email: 'Email', sms: 'SMS', call: 'Call', in_person: 'In person', co_marketing_send: 'Co-marketing', referral_received: 'Referral received', note: 'Note' };

export default async function RealtorDetailPage({ params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: r } = await sb.from('realtors').select('*').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!r) notFound();
  const { data: touches } = await sb.from('realtor_touches').select('id, touch_type, created_at').eq('realtor_id', params.id).order('created_at', { ascending: false }).limit(50);
  const { factors } = computePartnershipScore(r);
  const tier = r.partnership_tier as PartnershipTier;

  const FACTORS: [string, number, number][] = [
    ['Production', factors.production_score, 40],
    ['Buyer focus', factors.buyer_focus_score, 20],
    ['Relationship', factors.relationship_score, 25],
    ['Recency', factors.recency_score, 15],
  ];

  return (
    <div className="max-w-2xl space-y-5">
      <Link href="/realtors" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)]"><ArrowLeft size={14} /> Realtor Intelligence</Link>

      <div className="flex items-start gap-4">
        <div className="text-center flex-shrink-0 w-16">
          <p className="text-[28px] font-bold font-mono tabular-nums leading-none" style={{ color: TIER_COLORS[tier] }}>{r.partnership_score}</p>
          <p className="text-[9px] uppercase tracking-wide text-[var(--c-label2)] mt-0.5">score</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">{r.first_name} {r.last_name}</h1>
            <span className="text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: TIER_COLORS[tier] }}>{TIER_LABELS[tier]}</span>
          </div>
          <p className="text-[12px] text-[var(--c-label2)] flex items-center gap-1.5 mt-0.5"><Building2 size={12} /> {r.brokerage_name ?? '—'}{r.primary_city ? ` · ${r.primary_city}` : ''}</p>
          <div className="flex items-center gap-3 mt-1 text-[12px] text-[var(--c-label2)]">
            {r.email && <span className="inline-flex items-center gap-1"><Mail size={12} /> {r.email}</span>}
            {r.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {r.phone}</span>}
          </div>
        </div>
      </div>

      {/* Production stats */}
      <div className="grid grid-cols-4 gap-3">
        {[['Transactions 12m', String(r.transactions_12m)], ['Volume 12m', `$${(Number(r.volume_12m) / 1_000_000).toFixed(1)}M`], ['Buyer side', r.buyer_side_pct != null ? `${r.buyer_side_pct}%` : '—'], ['Referred to me', String(r.deals_referred_12m)]].map(([l, v]) => (
          <div key={String(l)} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] px-3 py-3"><p className="text-[10px] uppercase tracking-wide text-[var(--c-label2)] mb-1">{l}</p><p className="text-[17px] font-bold font-mono tabular-nums text-[var(--c-text)]">{v}</p></div>
        ))}
      </div>

      {/* Partnership health */}
      <div>
        <h2 className="text-[14px] font-semibold text-[var(--c-text)] mb-2">Partnership health</h2>
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-2.5">
          {FACTORS.map(([label, val, max]) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-[12px] text-[var(--c-label2)] w-24">{label}</span>
              <div className="h-2 rounded-full bg-[var(--c-fill)] flex-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(val / max) * 100}%`, background: 'var(--c-gold)' }} /></div>
              <span className="text-[11px] font-mono tabular-nums text-[var(--c-text)] w-12 text-right">{val}/{max}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Activity timeline */}
      <div>
        <h2 className="text-[14px] font-semibold text-[var(--c-text)] mb-2">Activity</h2>
        {(touches ?? []).length === 0 ? (
          <p className="text-[13px] text-[var(--c-label2)] bg-[var(--c-fill)] rounded-[12px] px-4 py-3">No touches logged yet. Use the quick actions on the hub to log calls, emails, and referrals.</p>
        ) : (
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden divide-y divide-[var(--c-border)]">
            {(touches ?? []).map((t) => {
              const Icon = t.touch_type === 'referral_received' ? Gift : t.touch_type === 'call' ? PhoneCall : t.touch_type === 'email' ? Mail : t.touch_type === 'in_person' ? Users : StickyNote;
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Icon size={14} className="text-[var(--c-label2)] flex-shrink-0" />
                  <span className="text-[13px] text-[var(--c-text)] flex-1">{TOUCH_LABEL[t.touch_type] ?? t.touch_type}</span>
                  <span className="text-[11px] text-[var(--c-label2)]">{new Date(t.created_at).toLocaleDateString()}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Meetings & cadence (Phase 48) */}
      <div>
        <h2 className="text-[14px] font-semibold text-[var(--c-text)] mb-2">Meetings &amp; co-marketing</h2>
        <RealtorEngagement realtorId={r.id} initialCadence={(r as { comarketing_cadence?: string }).comarketing_cadence ?? 'monthly'} />
      </div>

      {/* Notes */}
      <div>
        <h2 className="text-[14px] font-semibold text-[var(--c-text)] mb-2">Notes</h2>
        <NotesEditor realtorId={r.id} initial={r.relationship_notes ?? ''} />
      </div>
    </div>
  );
}
