'use client';

/** Phase 34.5 — Campaign Manager: stats + library + the org's campaigns. */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Sparkles, Check, Library, Layers } from 'lucide-react';

interface LibTpl { id: string; name: string; type: string; category: string | null; description: string | null; total_steps: number | null }
interface MyCampaign { id: string; name: string; type: string; category: string | null; status: string; total_steps: number | null; enrolled_count: number | null }
interface Stats { active_campaigns: number; enrolled_leads: number; sends_30d: number }

const TYPE_COLOR: Record<string, string> = {
  drip: '#3b82f6', milestone: '#8b5cf6', rate_drop: '#C9A95C', market_update: '#0ea5e9',
  birthday: '#ec4899', loan_anniversary: '#10b981', holiday: '#f59e0b', reactivation: '#ef4444',
  referral_ask: '#14b8a6', educational: '#6366f1', pre_approval_expiring: '#f97316',
};
function badge(type: string) { return TYPE_COLOR[type] ?? '#6B7B8D'; }

const CATEGORIES = ['all', 'nurture', 'lifecycle', 'retention', 'referral', 'education'];

export function CampaignManagerClient() {
  const [library, setLibrary] = useState<LibTpl[]>([]);
  const [mine, setMine] = useState<MyCampaign[]>([]);
  const [stats, setStats] = useState<Stats>({ active_campaigns: 0, enrolled_leads: 0, sends_30d: 0 });
  const [cat, setCat] = useState('all');
  const [activating, setActivating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch('/api/campaign-manager');
    if (res.ok) { const d = await res.json(); setLibrary(d.library ?? []); setMine(d.mine ?? []); setStats(d.stats ?? stats); }
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const activatedNames = new Set(mine.map((m) => m.name));
  const shown = library.filter((t) => cat === 'all' || t.category === cat);

  async function activate(id: string) {
    setActivating(id);
    try {
      const res = await fetch('/api/campaign-manager/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template_id: id }) });
      if (res.ok) await load();
    } finally { setActivating(null); }
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ['Active campaigns', stats.active_campaigns],
          ['Enrolled leads', stats.enrolled_leads],
          ['Sends (30d)', stats.sends_30d],
        ].map(([label, val]) => (
          <div key={String(label)} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] px-4 py-3.5">
            <p className="text-[11px] font-semibold text-[var(--c-label2)] uppercase tracking-wide mb-1">{label}</p>
            <p className="text-[22px] font-bold text-[var(--c-text)] font-mono tabular-nums leading-none">{val}</p>
          </div>
        ))}
      </div>

      {/* My campaigns */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Layers size={15} className="text-[var(--c-gold-deep)]" />
          <h2 className="text-[14px] font-semibold text-[var(--c-text)]">Your Campaigns</h2>
        </div>
        {mine.length === 0 ? (
          <p className="text-[13px] text-[var(--c-label2)] bg-[var(--c-fill)] rounded-[12px] px-4 py-3">No campaigns yet — activate one from the library below.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {mine.map((c) => (
              <Link key={c.id} href={`/campaigns/manager/${c.id}`} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] px-4 py-3 flex items-center justify-between gap-3 hover:bg-[var(--c-fill)] transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: badge(c.type) }} /><p className="text-[13px] font-medium text-[var(--c-text)] truncate">{c.name}</p></div>
                  <p className="text-[11px] text-[var(--c-label2)]">{c.total_steps ?? 0} steps · {c.enrolled_count ?? 0} enrolled · {c.status}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Library */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Library size={15} className="text-[var(--c-gold-deep)]" />
          <h2 className="text-[14px] font-semibold text-[var(--c-text)]">Campaign Library</h2>
          <span className="text-[11px] text-[var(--c-label2)]">· {library.length} ready-to-use templates</span>
        </div>
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`text-[11px] px-2.5 py-1 rounded-full border capitalize ${cat === c ? 'border-[var(--c-gold)] bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]' : 'border-[var(--c-border)] text-[var(--c-label2)]'}`}>{c}</button>
          ))}
        </div>
        {loading ? (
          <p className="text-[13px] text-[var(--c-label2)]">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {shown.map((t) => {
              const done = activatedNames.has(t.name);
              return (
                <div key={t.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-4 flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: badge(t.type) }}>{t.type.replace(/_/g, ' ')}</span>
                    <p className="text-[13px] font-semibold text-[var(--c-text)]">{t.name}</p>
                  </div>
                  <p className="text-[12px] text-[var(--c-label2)] flex-1">{t.description}</p>
                  <p className="text-[11px] text-[var(--c-label3)] mt-1.5">{t.total_steps ?? 0} steps</p>
                  {done ? (
                    <span className="mt-2 inline-flex items-center gap-1 text-[12px] text-green"><Check size={13} /> Activated</span>
                  ) : (
                    <Button variant="secondary" onClick={() => activate(t.id)} disabled={activating === t.id} className="mt-2 self-start">
                      <Sparkles size={13} /> {activating === t.id ? 'Activating…' : 'Activate'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
