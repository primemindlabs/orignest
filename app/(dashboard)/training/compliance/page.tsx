import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ComplianceReportClient } from './ComplianceReportClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Training Compliance' };

export default async function CompliancePage() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  if (!['admin', 'branch_manager', 'manager'].includes(role)) notFound();

  const sb = createAdminClient();
  const [{ data: courses }, { data: profiles }, { data: enrollments }] = await Promise.all([
    sb.from('lms_courses').select('id, title').eq('org_id', orgId).eq('is_compliance', true).eq('is_published', true).order('title'),
    sb.from('profiles').select('id, first_name, last_name, role').eq('org_id', orgId).order('first_name'),
    sb.from('lms_enrollments').select('course_id, profile_id, status, score').eq('org_id', orgId),
  ]);

  const courseList = (courses ?? []).map((c) => ({ id: c.id, title: c.title }));
  const enrByPair = new Map((enrollments ?? []).map((e) => [`${e.profile_id}:${e.course_id}`, { status: e.status, score: e.score }]));
  const done = (s: string | null) => s === 'passed' || s === 'completed';

  const rows = (profiles ?? []).map((p) => {
    const cells: Record<string, { status: string | null; score: number | null }> = {};
    let completed = 0;
    for (const c of courseList) {
      const cell = enrByPair.get(`${p.id}:${c.id}`) ?? { status: null, score: null };
      cells[c.id] = cell;
      if (done(cell.status)) completed += 1;
    }
    return { name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Member', role: p.role ?? '—', cells, donePct: courseList.length ? Math.round((completed / courseList.length) * 100) : 0 };
  });
  const overall = rows.length ? Math.round(rows.reduce((s, r) => s + r.donePct, 0) / rows.length) : 0;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/training" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3"><ArrowLeft size={14} /> Training Center</Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Training Compliance</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">{rows.length} team members · {courseList.length} compliance course{courseList.length === 1 ? '' : 's'} · {overall}% overall completion. Export the matrix for audit evidence.</p>
      </div>
      {courseList.length === 0 ? (
        <p className="text-[13px] text-[var(--c-label2)]">No compliance-flagged courses yet. Mark a course as compliance in the Training Center to track required completion here.</p>
      ) : (
        <ComplianceReportClient courses={courseList} rows={rows} />
      )}
    </div>
  );
}
