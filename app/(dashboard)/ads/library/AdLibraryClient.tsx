'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Copy, Check, Files, Archive, Sparkles, Plus, Megaphone, Wand2, LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';
import { AdPreview, AdCreativeImage } from '@/components/ads/AdPreview';
import { AD_TEMPLATES, type AdTemplate } from '@/lib/ads/templates';

export interface Creative {
  id: string;
  ad_type: string;
  platform: string;
  headline: string;
  primary_text: string | null;
  description: string | null;
  cta_type: string | null;
  nmls_number: string | null;
  apr_disclosure: string | null;
  created_at: string;
}

const AD_TYPES = ['purchase', 'refinance', 'fha', 'va', 'heloc', 'coop'];
const PLATFORMS = ['meta', 'google', 'both'];

const TYPE_LABEL: Record<string, string> = {
  purchase: 'Purchase', refinance: 'Refinance', fha: 'FHA', va: 'VA', heloc: 'HELOC', coop: 'Co-Marketing',
};
const PLATFORM_LABEL: Record<string, string> = { meta: 'Meta', google: 'Google', both: 'Meta + Google' };
const TYPE_COLOR: Record<string, string> = {
  purchase: 'bg-blue/10 text-blue', refinance: 'bg-green/10 text-green', fha: 'bg-gold/15 text-[#8A6310]',
  va: 'bg-[#ede9fe] text-[#6d28d9]', heloc: 'bg-orange/10 text-orange', coop: 'bg-[#1877F2]/10 text-[#1877F2]',
};

function fullText(c: Creative): string {
  return [c.headline, c.primary_text, c.description, c.apr_disclosure, c.nmls_number ? `NMLS #${c.nmls_number}` : null]
    .filter(Boolean)
    .join('\n\n');
}

export function AdLibraryClient({ initial, companyName, nmls }: { initial: Creative[]; companyName: string; nmls: string | null }) {
  const [creatives, setCreatives] = useState<Creative[]>(initial);
  const [tab, setTab] = useState<'templates' | 'mine'>(initial.length > 0 ? 'mine' : 'templates');
  const [q, setQ] = useState('');
  const [type, setType] = useState<string>('all');
  const [platform, setPlatform] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const matches = (ad_type: string, plat: string, text: string) => {
    if (type !== 'all' && ad_type !== type) return false;
    if (platform !== 'all' && plat !== platform) return false;
    const needle = q.trim().toLowerCase();
    if (needle && !text.toLowerCase().includes(needle)) return false;
    return true;
  };

  const filtered = useMemo(
    () => creatives.filter((c) => matches(c.ad_type, c.platform, `${c.headline} ${c.primary_text ?? ''} ${c.description ?? ''}`)),
    [creatives, q, type, platform],
  );
  const filteredTemplates = useMemo(
    () => AD_TEMPLATES.filter((t) => matches(t.ad_type, t.platform, `${t.name} ${t.headline} ${t.primary_text} ${t.description} ${t.tags.join(' ')}`)),
    [q, type, platform],
  );

  async function copy(c: Creative) {
    await navigator.clipboard.writeText(fullText(c));
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Ad copy copied');
  }

  async function saveCreative(payload: Record<string, unknown>, successMsg: string) {
    const res = await fetch('/api/ad-center', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? 'Save failed');
    setCreatives((prev) => [j.creative as Creative, ...prev]);
    toast.success(successMsg);
  }

  async function applyTemplate(t: AdTemplate) {
    setBusyId(t.id);
    try {
      await saveCreative(
        { ad_type: t.ad_type, platform: t.platform, headline: t.headline, primary_text: t.primary_text, description: t.description, cta_type: t.cta_type },
        'Template added to your creatives',
      );
      setTab('mine');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(c: Creative) {
    setBusyId(c.id);
    try {
      await saveCreative(
        { ad_type: c.ad_type, platform: c.platform, headline: `${c.headline} (copy)`, primary_text: c.primary_text, description: c.description, cta_type: c.cta_type, nmls_number: c.nmls_number, apr_disclosure: c.apr_disclosure },
        'Duplicated',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  async function archive(c: Creative) {
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/ad-center/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: true }),
      });
      if (!res.ok) throw new Error('Archive failed');
      setCreatives((prev) => prev.filter((x) => x.id !== c.id));
      toast.success('Archived');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${active ? 'bg-[#C9A95C] text-white' : 'bg-[rgba(60,60,67,0.07)] text-label-2 hover:bg-[rgba(60,60,67,0.12)]'}`;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-5 border-b border-black/[0.07]">
        {([
          { key: 'templates', label: 'Templates', icon: LayoutTemplate, count: AD_TEMPLATES.length },
          { key: 'mine', label: 'My Creatives', icon: Megaphone, count: creatives.length },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative -mb-px flex items-center gap-1.5 pb-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
              tab === t.key ? 'text-[#C9A95C] border-b-2 border-[#C9A95C]' : 'text-label-2 hover:text-black border-b-2 border-transparent'
            }`}
          >
            <t.icon size={15} /> {t.label}
            <span className="text-[11px] text-label-3">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-label-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === 'templates' ? 'Search templates…' : 'Search saved creatives…'}
            className="w-full h-9 pl-9 pr-3 rounded-[10px] border border-border bg-white text-[13px] outline-none focus:border-[#C9A95C]"
          />
        </div>
        <Link href="/ads/builder" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] bg-blue text-white text-[13px] font-semibold hover:bg-blue/90">
          <Plus size={14} /> New creative
        </Link>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={() => setType('all')} className={pill(type === 'all')}>All types</button>
        {AD_TYPES.map((t) => <button key={t} onClick={() => setType(t)} className={pill(type === t)}>{TYPE_LABEL[t]}</button>)}
        <span className="mx-1 text-border">|</span>
        <button onClick={() => setPlatform('all')} className={pill(platform === 'all')}>All platforms</button>
        {PLATFORMS.map((p) => <button key={p} onClick={() => setPlatform(p)} className={pill(platform === p)}>{PLATFORM_LABEL[p]}</button>)}
      </div>

      {/* Templates tab */}
      {tab === 'templates' && (
        filteredTemplates.length === 0 ? (
          <EmptyState title="No templates match your filters" body="Try clearing a filter to see the full starter library." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredTemplates.map((t) => (
              <div key={t.id} className="bg-[rgba(60,60,67,0.025)] border border-black/[0.06] rounded-2xl p-4 flex flex-col items-center gap-3">
                <AdPreview creative={{ ...t, nmls_number: nmls }} companyName={companyName} />
                <div className="w-full flex items-center gap-2 pt-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-black truncate">{t.name}</p>
                    <p className="text-[11px] text-label-3">{t.category} · {PLATFORM_LABEL[t.platform]}</p>
                  </div>
                  <Link href={`/ads/builder?template=${t.id}`} className="inline-flex items-center gap-1 text-[12px] font-medium text-label-2 hover:text-black transition-colors">
                    <Wand2 size={13} /> Customize
                  </Link>
                  <button
                    onClick={() => applyTemplate(t)}
                    disabled={busyId === t.id}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-white bg-[#C9A95C] hover:bg-[#b8975093] disabled:opacity-50 px-3 py-1.5 rounded-[9px]"
                  >
                    {busyId === t.id ? 'Adding…' : 'Use this'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* My Creatives tab */}
      {tab === 'mine' && (
        filtered.length === 0 ? (
          <EmptyState
            title={creatives.length === 0 ? 'No saved creatives yet' : 'No creatives match your filters'}
            body="Start from a Template above, or generate compliant ad copy in the builder and save it here to reuse and adapt."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((c) => (
              <div key={c.id} className="bg-white border border-black/[0.06] shadow-sm rounded-2xl overflow-hidden flex flex-col">
                <AdCreativeImage creative={{ ad_type: c.ad_type, platform: c.platform, headline: c.headline }} height={120} />
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${TYPE_COLOR[c.ad_type] ?? 'bg-fill text-label-2'}`}>{TYPE_LABEL[c.ad_type] ?? c.ad_type}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-fill text-label-2">{PLATFORM_LABEL[c.platform] ?? c.platform}</span>
                    <span className="ml-auto text-[11px] text-label-3">{new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                  <h3 className="text-[14px] font-bold text-black leading-snug">{c.headline}</h3>
                  {c.primary_text && <p className="text-[12.5px] text-label-2 mt-1.5 leading-relaxed line-clamp-4">{c.primary_text}</p>}
                  {c.description && <p className="text-[12px] text-label-3 mt-1.5 italic line-clamp-2">{c.description}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {c.cta_type && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue/8 text-blue">{c.cta_type}</span>}
                    {c.nmls_number && <span className="text-[11px] text-label-3">NMLS #{c.nmls_number}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-black/[0.05]">
                    <button onClick={() => copy(c)} className="inline-flex items-center gap-1 text-[12px] font-medium text-label-2 hover:text-black transition-colors">
                      {copiedId === c.id ? <Check size={13} className="text-green" /> : <Copy size={13} />} {copiedId === c.id ? 'Copied' : 'Copy'}
                    </button>
                    <button onClick={() => duplicate(c)} disabled={busyId === c.id} className="inline-flex items-center gap-1 text-[12px] font-medium text-label-2 hover:text-black transition-colors disabled:opacity-40">
                      <Files size={13} /> Duplicate
                    </button>
                    <button onClick={() => archive(c)} disabled={busyId === c.id} className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-label-3 hover:text-red transition-colors disabled:opacity-40">
                      <Archive size={13} /> Archive
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[#C9A95C]/12 flex items-center justify-center">
        <Megaphone size={22} className="text-[#C9A95C]" />
      </div>
      <p className="text-[15px] font-semibold text-black">{title}</p>
      <p className="text-[13px] text-label-2 max-w-sm">{body}</p>
      <Link href="/ads/builder" className="inline-flex items-center gap-1.5 mt-1 px-4 py-2 rounded-[10px] bg-[#C9A95C] text-white text-[13px] font-semibold">
        <Sparkles size={14} /> Open Ad Builder
      </Link>
    </div>
  );
}
