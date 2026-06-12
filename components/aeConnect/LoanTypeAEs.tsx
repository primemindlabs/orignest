'use client';

/**
 * Phase 89 integration — surfaces the LO's preferred AEs for a given loan type at the
 * point of pricing. Reusable across tools (DSCR calc, scenario, deal desk). Consumes
 * GET /api/lender-aes/for-loan-type/[loanType]. The "Email this deal" action opens a
 * prefilled mailto so the LO can fire the scenario to their AE in one click.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail, Phone, Star, Copy, ArrowUpRight } from 'lucide-react';

interface AE {
  id: string;
  lender_name: string;
  ae_name: string;
  ae_email: string;
  ae_phone: string | null;
  ae_cell: string | null;
  preferred: boolean;
  response_time_avg_hours: number | null;
}

export function LoanTypeAEs({
  loanType,
  title = 'Send this to a lender',
  emailSubject,
  emailBody,
  limit = 4,
}: {
  loanType: string;
  title?: string;
  emailSubject?: string;
  emailBody?: string;
  limit?: number;
}) {
  const [aes, setAes] = useState<AE[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/lender-aes/for-loan-type/${encodeURIComponent(loanType)}`)
      .then((r) => (r.ok ? r.json() : { aes: [] }))
      .then((d) => { if (alive) { setAes(d.aes ?? []); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [loanType]);

  function mailto(ae: AE) {
    const params = new URLSearchParams();
    if (emailSubject) params.set('subject', emailSubject);
    if (emailBody) params.set('body', emailBody);
    const qs = params.toString();
    return `mailto:${ae.ae_email}${qs ? `?${qs}` : ''}`;
  }

  if (!loaded) return null;

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-label2)]">{title}</p>
        <Link href="/ae-connect" className="text-[11px] text-[var(--c-gold-deep)] hover:underline flex items-center gap-0.5">
          AE Connect <ArrowUpRight size={11} />
        </Link>
      </div>

      {aes.length === 0 ? (
        <p className="text-[12px] text-[var(--c-label2)]">
          No {loanType.toUpperCase()} lenders in your directory yet.{' '}
          <Link href="/ae-connect" className="text-[var(--c-gold-deep)] hover:underline">Add your AEs</Link> to send deals in one click.
        </p>
      ) : (
        <div className="space-y-1.5">
          {aes.slice(0, limit).map((ae) => (
            <div key={ae.id} className="flex items-center justify-between gap-2 rounded-[10px] border border-[var(--c-border)] px-2.5 py-1.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {ae.preferred && <Star size={11} className="fill-[var(--c-gold)] text-[var(--c-gold)] flex-shrink-0" />}
                  <span className="text-[13px] font-medium text-[var(--c-text)] truncate">{ae.ae_name}</span>
                  <span className="text-[11px] text-[var(--c-label2)] truncate">· {ae.lender_name}</span>
                </div>
                {ae.response_time_avg_hours != null && (
                  <span className="text-[10px] text-[var(--c-label3)]">~{ae.response_time_avg_hours}h avg response</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => navigator.clipboard?.writeText(ae.ae_email).catch(() => {})} className="text-[var(--c-label3)] hover:text-[var(--c-text)]" title="Copy email"><Copy size={12} /></button>
                {(ae.ae_cell || ae.ae_phone) && (
                  <a href={`tel:${ae.ae_cell ?? ae.ae_phone}`} className="text-[var(--c-label2)] hover:text-[var(--c-text)]" title="Call"><Phone size={13} /></a>
                )}
                <a href={mailto(ae)} className="flex items-center gap-1 text-[11px] text-white bg-[var(--c-gold)] rounded-full px-2 py-1 hover:opacity-90" title="Email this deal">
                  <Mail size={11} /> Email
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
