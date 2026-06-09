import { getLoanSummary } from '@/lib/loans/getLoanSummary';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { FileText, Scale, RefreshCw, ShieldAlert, Download } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DisclosuresIndexPage({ params }: { params: { loanId: string } }) {
  const loan = await getLoanSummary(params.loanId);
  if (!loan) notFound();
  const base = `/loans/${loan.id}/disclosures`;

  const items = [
    { href: `${base}/loan-estimates`, label: 'Loan Estimates', desc: 'LE issuance & TRID timing', icon: FileText },
    { href: `${base}/cd-balancer`, label: 'CD Balancer', desc: 'Closing Disclosure reconciliation', icon: Scale },
    { href: `${base}/changed-circumstances`, label: 'Changed Circumstances', desc: 'Valid re-disclosure tracking', icon: RefreshCw },
    { href: `${base}/wire-safety`, label: 'Wire Safety', desc: 'Wire verification & fraud safeguards', icon: ShieldAlert },
    { href: `${base}/audit`, label: 'Audit Export', desc: 'TRID compliance audit trail', icon: Download },
  ];

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Disclosures</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">TRID disclosure tracking and closing reconciliation.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {items.map(({ href, label, desc, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] px-4 py-3 hover:bg-[var(--c-fill)] transition-colors">
            <div className="w-8 h-8 rounded-[9px] bg-[var(--c-fill)] flex items-center justify-center flex-shrink-0">
              <Icon size={15} className="text-[var(--c-label2)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[var(--c-text)]">{label}</p>
              <p className="text-[11px] text-[var(--c-label2)]">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
