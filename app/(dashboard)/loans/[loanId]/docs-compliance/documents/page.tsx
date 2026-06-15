import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type DocRow = {
  id: string;
  name: string;
  status: string;
  source: 'request' | 'condition';
  uploaded: boolean;
  sizeBytes: number | null;
  ts: string | null;
};

const REQUEST_STATUS: Record<string, { label: string; cls: string }> = {
  requested: { label: 'Requested', cls: 'border-[var(--c-border)] text-[var(--c-label2)]' },
  pending: { label: 'Pending', cls: 'border-[var(--c-border)] text-[var(--c-label2)]' },
  uploaded: { label: 'Uploaded', cls: 'border-blue-400/40 text-blue-600 bg-blue-500/5' },
  received: { label: 'Received', cls: 'border-blue-400/40 text-blue-600 bg-blue-500/5' },
  verified: { label: 'Verified', cls: 'border-emerald-400/40 text-emerald-600 bg-emerald-500/5' },
  rejected: { label: 'Rejected', cls: 'border-red-400/40 text-red-600 bg-red-500/5' },
};

function statusChip(status: string) {
  return (
    REQUEST_STATUS[status] ?? {
      label: status || 'Unknown',
      cls: 'border-[var(--c-border)] text-[var(--c-label3)]',
    }
  );
}

function fmtSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(ts: string | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function Page({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('*')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  const rows: DocRow[] = [];

  // Requested / borrower-uploaded documents (defensive: table/cols may vary).
  try {
    const { data: requests } = await sb
      .from('document_requests')
      .select('id, display_name, doc_type, status, file_size_bytes, uploaded_at, created_at')
      .eq('lead_id', params.loanId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    for (const r of requests ?? []) {
      const status = (r as { status?: string }).status ?? 'requested';
      rows.push({
        id: `req-${(r as { id: string }).id}`,
        name:
          (r as { display_name?: string }).display_name ||
          (r as { doc_type?: string }).doc_type ||
          'Document',
        status,
        source: 'request',
        uploaded: ['uploaded', 'received', 'verified'].includes(status),
        sizeBytes: (r as { file_size_bytes?: number | null }).file_size_bytes ?? null,
        ts:
          (r as { uploaded_at?: string | null }).uploaded_at ??
          (r as { created_at?: string | null }).created_at ??
          null,
      });
    }
  } catch {
    /* table may not exist in this environment — skip gracefully */
  }

  // Condition-attached documents (already uploaded files).
  try {
    const { data: condDocs } = await sb
      .from('condition_documents')
      .select('id, file_name, file_size, created_at')
      .eq('lead_id', params.loanId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    for (const d of condDocs ?? []) {
      rows.push({
        id: `cond-${(d as { id: string }).id}`,
        name: (d as { file_name?: string }).file_name || 'Condition document',
        status: 'uploaded',
        source: 'condition',
        uploaded: true,
        sizeBytes: (d as { file_size?: number | null }).file_size ?? null,
        ts: (d as { created_at?: string | null }).created_at ?? null,
      });
    }
  } catch {
    /* table may not exist — skip gracefully */
  }

  const total = rows.length;
  const uploadedCount = rows.filter((r) => r.uploaded).length;
  const outstanding = total - uploadedCount;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Documents</h1>
          <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
            Every document requested or attached to this loan, with its current status.
          </p>
        </div>
        <Link
          href={`/loans/${params.loanId}/docs-compliance/smart-checklist`}
          className="shrink-0 rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--c-text)] hover:bg-[var(--c-fill)] transition-colors"
        >
          Smart Checklist →
        </Link>
      </div>

      {total > 0 && (
        <div className="flex gap-3">
          {[
            { label: 'Total', value: total },
            { label: 'Uploaded', value: uploadedCount },
            { label: 'Outstanding', value: outstanding },
          ].map((s) => (
            <div
              key={s.label}
              className="flex-1 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2"
            >
              <div className="text-[18px] font-bold text-[var(--c-text)] leading-none">{s.value}</div>
              <div className="text-[11px] uppercase tracking-wide text-[var(--c-label3)] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] px-6 py-10 text-center">
          <div className="text-[14px] font-semibold text-[var(--c-text)]">No documents yet</div>
          <p className="text-[13px] text-[var(--c-label2)] mt-1 max-w-md mx-auto">
            Nothing has been requested or uploaded for this loan. Start with the Smart Checklist to see
            exactly which documents this file needs, then request them from the borrower.
          </p>
          <Link
            href={`/loans/${params.loanId}/docs-compliance/smart-checklist`}
            className="inline-block mt-4 rounded-md px-4 py-2 text-[13px] font-semibold text-white"
            style={{ backgroundColor: 'var(--c-gold-deep)' }}
          >
            Build the document checklist
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--c-border)] text-left">
                <th className="px-4 py-2.5 font-medium text-[var(--c-label3)] text-[11px] uppercase tracking-wide">
                  Document
                </th>
                <th className="px-4 py-2.5 font-medium text-[var(--c-label3)] text-[11px] uppercase tracking-wide">
                  Source
                </th>
                <th className="px-4 py-2.5 font-medium text-[var(--c-label3)] text-[11px] uppercase tracking-wide">
                  Date
                </th>
                <th className="px-4 py-2.5 font-medium text-[var(--c-label3)] text-[11px] uppercase tracking-wide text-right">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const chip = statusChip(r.status);
                const size = fmtSize(r.sizeBytes);
                return (
                  <tr key={r.id} className="border-b border-[var(--c-border)] last:border-0">
                    <td className="px-4 py-2.5 text-[var(--c-text)] font-medium">
                      {r.name}
                      {size && <span className="ml-2 text-[12px] font-normal text-[var(--c-label3)]">{size}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--c-label2)]">
                      {r.source === 'condition' ? 'Condition' : 'Requested'}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--c-label2)]">{fmtDate(r.ts) || '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${chip.cls}`}
                      >
                        {chip.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 && (
        <p className="text-[12px] text-[var(--c-label3)]">
          Need to request more from the borrower?{' '}
          <Link
            href={`/loans/${params.loanId}/docs-compliance/smart-checklist`}
            className="text-[var(--c-gold-deep)] font-medium hover:underline"
          >
            Open the Smart Checklist
          </Link>{' '}
          to generate the right list for this file.
        </p>
      )}
    </div>
  );
}
