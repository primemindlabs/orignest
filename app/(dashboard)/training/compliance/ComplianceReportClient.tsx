'use client';

/** Phase 54.7 — manager completion matrix + CSV export over the live LMS data. */
import { Download } from 'lucide-react';

interface Course { id: string; title: string }
interface Cell { status: string | null; score: number | null }
interface Row { name: string; role: string; cells: Record<string, Cell>; donePct: number }

export function ComplianceReportClient({ courses, rows }: { courses: Course[]; rows: Row[] }) {
  function exportCsv() {
    const header = ['Team member', 'Role', ...courses.map((c) => c.title), 'Completion %'];
    const lines = rows.map((r) => [r.name, r.role, ...courses.map((c) => { const cell = r.cells[c.id]; return cell ? `${cell.status ?? ''}${cell.score != null ? ` (${cell.score}%)` : ''}` : 'not enrolled'; }), `${r.donePct}%`]);
    const csv = [header, ...lines].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'training-compliance.csv'; a.click(); URL.revokeObjectURL(url);
  }

  const mark = (c: Cell | undefined) => {
    if (!c) return <span className="text-[var(--c-label2)]">—</span>;
    if (c.status === 'passed' || c.status === 'completed') return <span className="text-[#27AE60] font-semibold" title={c.score != null ? `${c.score}%` : undefined}>✓</span>;
    if (c.status === 'failed') return <span className="text-[var(--c-danger)] font-semibold">✗</span>;
    if (c.status === 'in_progress' || c.status === 'started') return <span className="text-[#F39C12]">⏳</span>;
    return <span className="text-[var(--c-label2)]">·</span>;
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button onClick={exportCsv} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-btn text-[12px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)]"><Download size={13} /> Export CSV</button></div>
      {rows.length === 0 ? <p className="text-[13px] text-[var(--c-label2)]">No team members found.</p> : (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="text-[10px] uppercase text-[var(--c-label2)] border-b border-[var(--c-border)]"><th className="text-left px-4 py-2">Team member</th>{courses.map((c) => <th key={c.id} className="px-2 py-2 text-center font-semibold" title={c.title}>{c.title.length > 16 ? c.title.slice(0, 16) + '…' : c.title}</th>)}<th className="px-4 py-2 text-right">Complete</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-[var(--c-border)] last:border-0">
                  <td className="px-4 py-2.5 text-[var(--c-text)]">{r.name}<span className="text-[11px] text-[var(--c-label2)]"> · {r.role}</span></td>
                  {courses.map((c) => <td key={c.id} className="px-2 py-2.5 text-center">{mark(r.cells[c.id])}</td>)}
                  <td className="px-4 py-2.5 text-right font-mono font-semibold" style={{ color: r.donePct === 100 ? '#27AE60' : r.donePct < 50 ? 'var(--c-danger)' : 'var(--c-text)' }}>{r.donePct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
