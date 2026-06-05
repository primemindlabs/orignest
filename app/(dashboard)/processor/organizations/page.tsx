import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Building2, CheckCircle2, Clock, FileText, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ProcessorOrgActions } from '@/components/processor/ProcessorOrgActions';

export const metadata: Metadata = { title: 'My Organizations — Orignest' };

export default async function ProcessorOrganizationsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const sb = createAdminClient();

  // ── Load all assignments (including pending) ───────────────────────────────
  const { data: assignments } = await sb
    .from('processor_assignments')
    .select('id, org_id, status, permissions, accepted_at, created_at')
    .eq('processor_clerk_id', userId)
    .order('created_at', { ascending: false });

  const allAssignments = assignments ?? [];
  const orgIds = allAssignments.map((a) => a.org_id);

  let orgs: { id: string; name: string; nmls_company_id: string | null; billing_email: string | null }[] = [];
  if (orgIds.length > 0) {
    const { data } = await sb
      .from('organizations')
      .select('id, name, nmls_company_id, billing_email')
      .in('id', orgIds);
    orgs = data ?? [];
  }

  const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o]));

  // ── Count active files per org ─────────────────────────────────────────────
  const { data: fileAssignments } = await sb
    .from('processor_file_assignments')
    .select('org_id, lead_id')
    .eq('processor_clerk_id', userId)
    .eq('active', true);

  const filesByOrg: Record<string, number> = {};
  for (const fa of fileAssignments ?? []) {
    filesByOrg[fa.org_id] = (filesByOrg[fa.org_id] ?? 0) + 1;
  }

  // ── Load invited_by profiles ───────────────────────────────────────────────
  const { data: inviters } = await sb
    .from('profiles')
    .select('id, first_name, last_name, email')
    .in('org_id', orgIds);

  const inviterMap = Object.fromEntries((inviters ?? []).map((p) => [p.id, p]));

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link
          href="/processor"
          className="inline-flex items-center gap-1.5 text-sm text-label-2 hover:text-black transition-colors"
        >
          <ArrowLeft size={14} />
          Dashboard
        </Link>
      </div>

      <div>
        <h1 className="text-[22px] font-bold text-black tracking-tight">My Organizations</h1>
        <p className="text-label-2 text-sm mt-0.5">
          {allAssignments.filter((a) => a.status === 'active').length} active ·{' '}
          {allAssignments.filter((a) => a.status === 'pending').length} pending
        </p>
      </div>

      {/* ── Assignment Cards ───────────────────────────────────────────── */}
      {allAssignments.length === 0 ? (
        <div className="bg-surface rounded-card shadow-card border border-border p-10 text-center">
          <Building2 size={28} className="text-label-3 mx-auto mb-3" />
          <p className="text-sm font-medium text-black">No organizations yet</p>
          <p className="text-xs text-label-2 mt-1">
            When a brokerage invites you to process their loans, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {allAssignments.map((assignment) => {
            const org = orgMap[assignment.org_id];
            const fileCount = filesByOrg[assignment.org_id] ?? 0;
            const permissions = assignment.permissions as Record<string, boolean>;

            return (
              <div
                key={assignment.id}
                className="bg-surface rounded-card shadow-card border border-border p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {/* Org avatar */}
                    <div className="w-10 h-10 rounded-[8px] bg-navy/8 flex items-center justify-center flex-shrink-0">
                      <Building2 size={18} className="text-navy" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[15px] font-semibold text-black">
                          {org?.name ?? 'Unknown Organization'}
                        </h3>
                        <Badge
                          variant={
                            assignment.status === 'active'
                              ? 'success'
                              : assignment.status === 'pending'
                              ? 'warning'
                              : 'danger'
                          }
                          size="sm"
                          dot
                        >
                          {assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
                        </Badge>
                      </div>

                      {org?.nmls_company_id && (
                        <p className="text-xs text-label-3 mt-0.5">NMLS #{org.nmls_company_id}</p>
                      )}

                      <div className="flex items-center gap-4 mt-3 flex-wrap">
                        {/* File count */}
                        <div className="flex items-center gap-1.5 text-xs text-label-2">
                          <FileText size={12} />
                          <span>{fileCount} active {fileCount === 1 ? 'file' : 'files'}</span>
                        </div>

                        {/* Accepted date */}
                        {assignment.accepted_at && (
                          <div className="flex items-center gap-1.5 text-xs text-label-2">
                            <CheckCircle2 size={12} className="text-green" />
                            <span>Joined {format(new Date(assignment.accepted_at), 'MMM d, yyyy')}</span>
                          </div>
                        )}

                        {/* Invite date */}
                        {!assignment.accepted_at && (
                          <div className="flex items-center gap-1.5 text-xs text-label-3">
                            <Clock size={12} />
                            <span>Invited {format(new Date(assignment.created_at), 'MMM d, yyyy')}</span>
                          </div>
                        )}
                      </div>

                      {/* Permissions */}
                      {assignment.status === 'active' && (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {permissions.view_leads && (
                            <span className="text-[10px] bg-fill text-label-2 px-1.5 py-0.5 rounded-full">
                              View Leads
                            </span>
                          )}
                          {permissions.edit_conditions && (
                            <span className="text-[10px] bg-fill text-label-2 px-1.5 py-0.5 rounded-full">
                              Edit Conditions
                            </span>
                          )}
                          {permissions.upload_docs && (
                            <span className="text-[10px] bg-fill text-label-2 px-1.5 py-0.5 rounded-full">
                              Upload Docs
                            </span>
                          )}
                          {permissions.view_financials && (
                            <span className="text-[10px] bg-blue/10 text-blue px-1.5 py-0.5 rounded-full">
                              Financials
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <ProcessorOrgActions
                    assignmentId={assignment.id}
                    orgId={assignment.org_id}
                    status={assignment.status}
                    orgName={org?.name ?? 'this organization'}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
