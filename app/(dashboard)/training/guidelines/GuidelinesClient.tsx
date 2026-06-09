'use client';

/** Phase 54.8 — Product Guidelines knowledge base: search + category filter +
 * expandable entries. Replaces emailing PDFs around. */
import { useState, useMemo } from 'react';
import { Search, FileText, ChevronDown } from 'lucide-react';

export interface Guideline { id: string; category: string; title: string; content: string; tags: string[]; last_reviewed_date: string | null; next_review_date: string | null; is_platform: boolean }

const CATEGORY_LABELS: Record<string, string> = {
  conventional: 'Conventional', fha: 'FHA', va: 'VA', usda: 'USDA', jumbo: 'Jumbo', dscr: 'DSCR', bank_statement: 'Bank Statement', '1099': '1099', itin: 'ITIN', non_qm: 'Non-QM', state_compliance: 'State Compliance', tcpa: 'TCPA', respa: 'RESPA', trid: 'TRID', cfpb: 'CFPB', general: 'General',
};

function render(md: string) {
  // Light markdown: ## headings, - bullets, **bold**, otherwise paragraphs.
  return md.split('\n').map((line, i) => {
    const t = line.trim();
    if (t.startsWith('### ')) return <h4 key={i} className="text-[13px] font-semibold text-[var(--c-text)] mt-2">{t.slice(4)}</h4>;
    if (t.startsWith('## ')) return <h3 key={i} className="text-[14px] font-bold text-[var(--c-text)] mt-2">{t.slice(3)}</h3>;
    if (t.startsWith('- ')) return <li key={i} className="text-[12px] text-[var(--c-label2)] ml-4 list-disc">{t.slice(2).replace(/\*\*/g, '')}</li>;
    if (!t) return null;
    return <p key={i} className="text-[12px] text-[var(--c-label2)] leading-relaxed">{t.replace(/\*\*/g, '')}</p>;
  });
}

export function GuidelinesClient({ guidelines }: { guidelines: Guideline[] }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [open, setOpen] = useState<string | null>(null);

  const cats = useMemo(() => Array.from(new Set(guidelines.map((g) => g.category))).sort(), [guidelines]);
  const filtered = guidelines.filter((g) => (cat === 'all' || g.category === cat) && (!q || (g.title + g.content + g.tags.join(' ')).toLowerCase().includes(q.toLowerCase())));
  const grouped = filtered.reduce<Record<string, Guideline[]>>((acc, g) => { (acc[g.category] ??= []).push(g); return acc; }, {});

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-label2)]" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guidelines…" className="w-full h-9 pl-9 pr-3 text-[13px] rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text)]" /></div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-9 px-3 text-[13px] rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text)]"><option value="all">All categories</option>{cats.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}</select>
      </div>

      {filtered.length === 0 ? <p className="text-[13px] text-[var(--c-label2)]">No guidelines match.</p> : Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-2">{CATEGORY_LABELS[category] ?? category}</p>
          <div className="space-y-2">
            {items.map((g) => {
              const stale = g.next_review_date && new Date(g.next_review_date) < new Date();
              return (
                <div key={g.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] overflow-hidden">
                  <button onClick={() => setOpen(open === g.id ? null : g.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--c-fill)]">
                    <div className="flex items-center gap-2.5 text-left min-w-0"><FileText size={15} className="text-[var(--c-gold-deep)] flex-shrink-0" /><div className="min-w-0"><p className="text-[13px] font-semibold text-[var(--c-text)]">{g.title}{g.is_platform && <span className="ml-2 text-[9px] uppercase text-[var(--c-label2)] border border-[var(--c-border)] rounded px-1 py-0.5">Platform</span>}</p>{g.tags.length > 0 && <p className="text-[10px] text-[var(--c-label2)] mt-0.5">{g.tags.join(' · ')}</p>}</div></div>
                    <div className="flex items-center gap-2 flex-shrink-0">{stale && <span className="text-[9px] bg-[rgba(243,156,18,0.15)] text-[#B45309] px-1.5 py-0.5 rounded-full">Review</span>}<ChevronDown size={15} className={`text-[var(--c-label2)] ${open === g.id ? 'rotate-180' : ''}`} /></div>
                  </button>
                  {open === g.id && <div className="border-t border-[var(--c-border)] px-4 py-3 bg-[var(--c-bg)] space-y-1">{render(g.content)}{g.last_reviewed_date && <p className="text-[10px] text-[var(--c-label2)] mt-2">Last reviewed {g.last_reviewed_date}</p>}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
