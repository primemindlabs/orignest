import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'State Disclosures' };

interface Disclosure { id: string; disclosure_type: string; title: string; content: string; citation: string | null }

const STATE_NAMES: Record<string, string> = {
  CA: 'California', TX: 'Texas', FL: 'Florida', NY: 'New York', GA: 'Georgia',
  IL: 'Illinois', WA: 'Washington', OR: 'Oregon', VA: 'Virginia', NC: 'North Carolina',
};

export default async function StateDisclosuresPage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('property_state').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) notFound();

  const state = String(lead.property_state ?? '').toUpperCase().slice(0, 2);

  let disclosures: Disclosure[] = [];
  if (state.length === 2) {
    try {
      const { data } = await sb
        .from('state_disclosures')
        .select('id, disclosure_type, title, content, citation')
        .eq('state_code', state)
        .eq('is_active', true)
        .order('disclosure_type');
      disclosures = (data ?? []) as Disclosure[];
    } catch {
      disclosures = []; // migration may not be applied yet
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">State Disclosures</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          State-specific disclosures required for the subject property{state ? ` in ${STATE_NAMES[state] ?? state}` : ''}.
        </p>
      </div>

      {!state ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-6 text-[13px] text-[var(--c-label2)]">
          No property state on file for this loan — set the subject property state to see required disclosures.
        </div>
      ) : disclosures.length === 0 ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-6 text-[13px] text-[var(--c-label2)]">
          No state-specific disclosures on file for {STATE_NAMES[state] ?? state}. Federal disclosures still apply.
        </div>
      ) : (
        <div className="space-y-3">
          {disclosures.map((d) => (
            <div key={d.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
              <p className="text-[15px] font-semibold text-[var(--c-text)]">{d.title}</p>
              <p className="text-[13px] text-[var(--c-text)] mt-2 leading-relaxed whitespace-pre-wrap">{d.content}</p>
              {d.citation && <p className="text-[12px] text-[var(--c-label3)] mt-2">Citation: {d.citation}</p>}
            </div>
          ))}
          <p className="text-[12px] text-[var(--c-label3)] leading-relaxed">
            Reference content only — confirm current statutory text and delivery requirements with your compliance policy before relying on these.
          </p>
        </div>
      )}
    </div>
  );
}
