'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { IconSparkles, IconPlus } from '@tabler/icons-react';
import { ContentPackageCard } from './ContentPackageCard';
import { PlatformTabs, type PlatformFilter } from './PlatformTabs';
import { GenerateWeekModal, type GenerateOptions } from './GenerateWeekModal';
import { BufferConnectBanner } from './BufferConnectBanner';
import { WEEKLY_TOPICS, type ContentPackageRow, type ContentPostRow } from '@/lib/contentStudio/types';

const DAY_ORDER = WEEKLY_TOPICS.map((t) => t.day);

function weekLabel(weekOf: string): string {
  const d = new Date(weekOf + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function ContentStudioPage({ initialPackage, initialPosts }: { initialPackage: ContentPackageRow | null; initialPosts: ContentPostRow[] }) {
  const [pkg, setPkg] = useState(initialPackage);
  const [posts, setPosts] = useState<ContentPostRow[]>(initialPosts);
  const [modal, setModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<PlatformFilter>('all');

  const generate = async (opts: GenerateOptions) => {
    setGenerating(true);
    try {
      const r = await fetch('/api/content-studio/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? 'Generation failed'); return; }
      setPkg(d.package);
      setPosts(d.posts as ContentPostRow[]);
      setModal(false);
      toast.success('Your week of content is ready to review.');
    } finally {
      setGenerating(false);
    }
  };

  const onAction = async (id: string, action: 'edit' | 'skip' | 'publish', editedText?: string) => {
    const r = await fetch(`/api/content-studio/post/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, edited_text: editedText }) });
    const d = await r.json();
    if (!r.ok) { toast.error(d.error ?? 'Could not update'); return; }
    setPosts((ps) => ps.map((p) => (p.id === id ? (d.post as ContentPostRow) : p)));
    if (action === 'skip') toast.success('Skipped');
    if (action === 'publish') toast.success('Marked as posted');
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of posts) c[p.platform] = (c[p.platform] ?? 0) + 1;
    return c;
  }, [posts]);

  const visible = useMemo(
    () => posts
      .filter((p) => filter === 'all' || p.platform === filter)
      .sort((a, b) => DAY_ORDER.indexOf(a.post_day) - DAY_ORDER.indexOf(b.post_day)),
    [posts, filter],
  );

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <IconSparkles size={20} className="text-[#C9A95C]" />
            <h1 className="text-xl font-semibold text-[#1A1A1A]" style={{ fontFamily: 'var(--font-lora), Lora, serif' }}>Content Studio</h1>
          </div>
          {pkg && <p className="text-sm text-[#6B7B8D] mt-0.5">Week of {weekLabel(pkg.week_of)}</p>}
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-1.5 bg-[#C9A95C] text-white text-sm px-4 py-2 rounded-lg hover:brightness-95">
          <IconPlus size={15} /> Generate new week
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E4DE] px-6 py-12 text-center">
          <IconSparkles size={26} className="text-[#C9A95C] mx-auto mb-3" />
          <p className="text-sm text-[#1A1A1A] font-medium mb-1">No content yet</p>
          <p className="text-sm text-[#6B7B8D] mb-4 max-w-sm mx-auto">Ashley will generate a full week of compliant, pre-branded posts across LinkedIn, Instagram, and Facebook.</p>
          <button onClick={() => setModal(true)} className="inline-flex items-center gap-1.5 bg-[#C9A95C] text-white text-sm px-5 py-2.5 rounded-lg hover:brightness-95">
            <IconSparkles size={15} /> Generate my first week
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <BufferConnectBanner />
          <PlatformTabs value={filter} onChange={setFilter} counts={counts} />
          <div className="space-y-3">
            {visible.map((p) => (
              <ContentPackageCard
                key={p.id}
                post={p}
                onAction={onAction}
                onUpdated={(np) => setPosts((ps) => ps.map((x) => (x.id === np.id ? np : x)))}
              />
            ))}
          </div>
        </div>
      )}

      {modal && <GenerateWeekModal onClose={() => setModal(false)} onGenerate={generate} busy={generating} />}
    </div>
  );
}
