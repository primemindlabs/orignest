import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type CardDef = {
  href: string;
  title: string;
  desc: string;
};

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'No activity yet';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'No activity yet';
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function Page({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, last_name')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  // --- Comms summary (defensive: tables/columns may be absent) ---
  let lastComm: { created_at: string | null; channel: string | null; direction: string | null } | null = null;
  let commCount = 0;
  try {
    const { data, count } = await sb
      .from('communications')
      .select('created_at, channel, direction', { count: 'exact' })
      .eq('lead_id', params.loanId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1);
    lastComm = data?.[0] ?? null;
    commCount = count ?? 0;
  } catch {
    lastComm = null;
  }

  let lastChatAt: string | null = null;
  try {
    const { data: thread } = await sb
      .from('loan_chat_threads')
      .select('id')
      .eq('lead_id', params.loanId)
      .eq('org_id', orgId)
      .maybeSingle();
    if (thread?.id) {
      const { data: msg } = await sb
        .from('chat_messages')
        .select('created_at')
        .eq('thread_id', thread.id)
        .order('created_at', { ascending: false })
        .limit(1);
      lastChatAt = msg?.[0]?.created_at ?? null;
    }
  } catch {
    lastChatAt = null;
  }

  const base = `/loans/${params.loanId}`;
  const cards: CardDef[] = [
    { href: `${base}/portal-comms/chat`, title: 'Loan Chat', desc: 'Three-way thread with the borrower, co-borrower, and realtor.' },
    { href: `${base}/portal-comms/borrower-portal`, title: 'Borrower Portal', desc: 'Manage portal access, document requests, and status visibility.' },
    { href: `${base}/internal-chat`, title: 'Internal Team Chat', desc: 'Private thread for your team — never visible to outside parties.' },
    { href: `${base}/portal-comms/competitor-analysis`, title: 'Competitor Analysis', desc: 'Compare this offer against a competing Loan Estimate.' },
  ];

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Portal &amp; Comms</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Borrower portal, realtor access, and every conversation on this file.
        </p>
      </div>

      {/* Comms summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
          <p className="text-[11px] text-[var(--c-label3)] uppercase tracking-wide">Last touch</p>
          <p className="text-[15px] font-semibold text-[var(--c-text)] mt-1">{timeAgo(lastComm?.created_at)}</p>
          <p className="text-[12px] text-[var(--c-label2)] mt-0.5 capitalize">
            {lastComm ? `${lastComm.direction ?? ''} ${lastComm.channel ?? 'contact'}`.trim() : 'No logged emails, calls, or texts'}
          </p>
        </div>
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
          <p className="text-[11px] text-[var(--c-label3)] uppercase tracking-wide">Last chat message</p>
          <p className="text-[15px] font-semibold text-[var(--c-text)] mt-1">{timeAgo(lastChatAt)}</p>
          <p className="text-[12px] text-[var(--c-label2)] mt-0.5">Borrower / realtor thread</p>
        </div>
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
          <p className="text-[11px] text-[var(--c-label3)] uppercase tracking-wide">Logged touches</p>
          <p className="text-[15px] font-semibold text-[var(--c-text)] mt-1 tabular-nums">{commCount}</p>
          <p className="text-[12px] text-[var(--c-label2)] mt-0.5">Total on this file</p>
        </div>
      </div>

      {/* Hub link cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 hover:bg-[var(--c-fill)] transition-colors block"
          >
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold text-[var(--c-text)] group-hover:text-[var(--c-gold-deep)] transition-colors">
                {c.title}
              </p>
              <span className="text-[var(--c-label3)] group-hover:text-[var(--c-gold-deep)] transition-colors" aria-hidden>
                &rarr;
              </span>
            </div>
            <p className="text-[13px] text-[var(--c-label2)] mt-1 leading-relaxed">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
