import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Lead = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
};

const CHECKLIST: { title: string; detail: string }[] = [
  {
    title: 'Call a phone number you already trust',
    detail:
      'Use the closing agent or title company number from a document you received earlier — not the number printed on the wire instructions email. Fraudsters spoof both the email and the phone number.',
  },
  {
    title: 'Verbally confirm the bank name, account, and routing number',
    detail:
      'Read each digit of the account and routing number back to the verified person on the phone. Do not rely on a written reply or text message to confirm.',
  },
  {
    title: 'Be suspicious of any last-minute changes',
    detail:
      'Wire instructions almost never change. A sudden "updated banking details" message — especially close to closing — is the most common sign of a fraud attempt. Stop and call to verify.',
  },
  {
    title: 'Verify the email sender address character by character',
    detail:
      'Look-alike domains (an extra letter, .net vs .com, swapped characters) are common. When in doubt, type the address yourself instead of hitting reply.',
  },
  {
    title: 'Confirm receipt after you send',
    detail:
      'Call the verified number again a few hours after wiring to confirm the funds arrived. Early detection gives the bank the best chance to recover a misdirected wire.',
  },
  {
    title: 'Never share login codes or full account credentials',
    detail:
      'No legitimate closing agent, lender, or title company will ask for your online banking password or a one-time login code.',
  },
];

export default async function WireSafetyPage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, last_name, property_address, property_city, property_state')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle<Lead>();
  if (!lead) notFound();

  const borrowerName = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
  const property = [lead.property_address, [lead.property_city, lead.property_state].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Wire Safety</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Protect {borrowerName || 'this borrower'}&rsquo;s closing funds from wire-transfer fraud.
        </p>
      </div>

      {/* Loan context banner */}
      <div className="bg-[var(--c-fill)] border border-[var(--c-border)] rounded-[14px] px-5 py-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--c-label3)]">Borrower</p>
            <p className="text-[14px] font-semibold text-[var(--c-text)] mt-0.5">{borrowerName || 'Not on file'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--c-label3)]">Subject property</p>
            <p className="text-[14px] font-semibold text-[var(--c-text)] mt-0.5">{property || 'Not on file'}</p>
          </div>
        </div>
      </div>

      {/* Primary warning */}
      <div
        className="rounded-[14px] p-5"
        style={{
          background: 'color-mix(in srgb, var(--c-danger) 8%, var(--c-surface))',
          border: '1px solid color-mix(in srgb, var(--c-danger) 35%, var(--c-border))',
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex-none w-8 h-8 rounded-full flex items-center justify-center text-[16px] font-bold"
            style={{ background: 'var(--c-danger)', color: '#fff' }}
            aria-hidden
          >
            !
          </div>
          <div>
            <p className="text-[15px] font-bold" style={{ color: 'var(--c-danger)' }}>
              Never wire funds without calling a known, trusted number first.
            </p>
            <p className="text-[13px] text-[var(--c-label2)] mt-1.5 leading-relaxed">
              Email wire instructions are a leading target for fraud. Before sending any money for this closing, call the
              closing or title company using a phone number you have independently verified — never a number or link
              from the instructions email itself. Wired funds are often unrecoverable once sent.
            </p>
          </div>
        </div>
      </div>

      {/* Verification checklist */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--c-border)]">
          <p className="text-[13px] font-semibold text-[var(--c-text)]">Verification checklist</p>
          <p className="text-[12px] text-[var(--c-label3)] mt-0.5">
            Walk through every step before sending funds for this loan.
          </p>
        </div>
        <ul className="divide-y divide-[var(--c-border)]">
          {CHECKLIST.map((item, i) => (
            <li key={i} className="flex items-start gap-3 px-5 py-3.5">
              <span
                className="flex-none mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold tabular-nums"
                style={{ background: 'var(--c-fill)', color: 'var(--c-gold-deep)', border: '1px solid var(--c-border)' }}
              >
                {i + 1}
              </span>
              <div>
                <p className="text-[14px] font-medium text-[var(--c-text)]">{item.title}</p>
                <p className="text-[13px] text-[var(--c-label2)] mt-0.5 leading-relaxed">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Red flags */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
        <p className="text-[13px] font-semibold text-[var(--c-text)]">Common red flags</p>
        <ul className="mt-2.5 space-y-1.5">
          {[
            'Urgent or last-minute change to where funds should be sent.',
            'A reply-to or sender email address that differs slightly from earlier messages.',
            'Pressure to act fast or to keep the transaction confidential.',
            'Requests to wire to a different bank, state, or individual’s name.',
            'Instructions that arrive only by email with no way to verify by phone.',
          ].map((flag, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-[var(--c-label2)] leading-relaxed">
              <span className="flex-none mt-1.5 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--c-danger)' }} />
              {flag}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[12px] text-[var(--c-label3)] leading-relaxed">
        If you suspect a fraudulent wire request on this file, do not respond to it. Contact your title or closing agent
        at a verified number immediately, and if funds were already sent, ask your bank to issue a wire recall and report
        the incident to the FBI&rsquo;s IC3 (ic3.gov) right away.
      </p>
    </div>
  );
}
