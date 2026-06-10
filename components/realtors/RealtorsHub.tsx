'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { differenceInCalendarDays } from 'date-fns';
import {
  IconAlertCircle,
  IconPlus,
  IconSearch,
  IconUsers,
  IconCompass,
  IconSparkles,
  IconExternalLink,
} from '@tabler/icons-react';
import { RealtorRow, type Realtor } from './RealtorRow';

interface CobrandAsset {
  id: string;
  realtor_id: string | null;
  asset_type: string | null;
  title: string | null;
  file_url: string | null;
  created_at: string;
}

type Tab = 'partners' | 'discovery' | 'comarketing';
type SortKey = 'volume_12m' | 'deals_referred_12m' | 'last_contact_at';
type FilterKey = 'all' | 'active' | 'stale';

const GOLD = '#C9A95C';

function daysSince(d: string | null): number | null {
  return d ? differenceInCalendarDays(new Date(), new Date(d)) : null;
}

export function RealtorsHub({ realtors, assets }: { realtors: Realtor[]; assets: CobrandAsset[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('partners');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('volume_12m');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [adding, setAdding] = useState(false);

  const staleCount = useMemo(
    () => realtors.filter((r) => { const d = daysSince(r.last_contact_at); return d === null || d > 21; }).length,
    [realtors]
  );

  const visible = useMemo(() => {
    let list = realtors;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        `${r.first_name ?? ''} ${r.last_name ?? ''} ${r.brokerage_name ?? ''}`.toLowerCase().includes(q)
      );
    }
    if (filter !== 'all') {
      list = list.filter((r) => {
        const d = daysSince(r.last_contact_at);
        const stale = d === null || d > 21;
        return filter === 'stale' ? stale : !stale;
      });
    }
    return [...list].sort((a, b) => {
      if (sort === 'last_contact_at') {
        const ad = a.last_contact_at ? new Date(a.last_contact_at).getTime() : 0;
        const bd = b.last_contact_at ? new Date(b.last_contact_at).getTime() : 0;
        return bd - ad;
      }
      return (Number(b[sort] ?? 0)) - (Number(a[sort] ?? 0));
    });
  }, [realtors, search, sort, filter]);

  const tabBtn = (key: Tab, label: string) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
        tab === key ? 'text-[#8A6310]' : 'border-transparent text-label-2 hover:text-black'
      }`}
      style={tab === key ? { borderColor: GOLD } : { borderColor: 'transparent' }}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black tracking-tight">Realtors</h1>
          <p className="text-label-2 text-sm mt-0.5">
            {realtors.length} partner{realtors.length !== 1 ? 's' : ''} · your referral network
          </p>
        </div>
        {tab === 'partners' && (
          <button
            onClick={() => setAdding((a) => !a)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-sm font-medium text-white"
            style={{ background: GOLD }}
          >
            <IconPlus size={15} /> Add partner
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-border flex gap-0 overflow-x-auto">
        {tabBtn('partners', 'All partners')}
        {tabBtn('discovery', 'Discovery')}
        {tabBtn('comarketing', 'Co-marketing')}
      </div>

      {/* ── ALL PARTNERS ── */}
      {tab === 'partners' && (
        <div className="space-y-3">
          {adding && <AddPartnerForm onDone={() => { setAdding(false); router.refresh(); }} />}

          {/* Stale banner */}
          {staleCount > 0 && (
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm"
              style={{ background: '#fdf0ea', border: '0.5px solid rgba(196,114,74,0.3)', color: '#b85c20' }}
            >
              <IconAlertCircle size={15} className="flex-shrink-0" />
              <span className="flex-1">
                {staleCount} partner{staleCount !== 1 ? 's' : ''} haven&apos;t been contacted in 21+ days.
              </span>
              <button
                onClick={() => { setFilter('stale'); setTab('partners'); }}
                className="font-medium underline"
                style={{ color: '#b85c20' }}
              >
                Show them
              </button>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-label-3" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or brokerage…"
                className="w-full h-9 pl-8 pr-3 rounded-btn text-sm bg-surface border border-border text-black placeholder:text-label-3 focus:outline-none focus:ring-1 focus:ring-[#C9A95C]"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 px-2.5 rounded-btn text-sm bg-surface border border-border text-black"
            >
              <option value="volume_12m">Sort: Volume</option>
              <option value="deals_referred_12m">Sort: Referrals</option>
              <option value="last_contact_at">Sort: Last contact</option>
            </select>
            <div className="flex rounded-btn border border-border overflow-hidden">
              {(['all', 'active', 'stale'] as FilterKey[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="h-9 px-3 text-sm font-medium capitalize transition-colors"
                  style={
                    filter === f
                      ? { background: GOLD, color: '#fff' }
                      : { background: '#fff', color: '#6E6E73' }
                  }
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="bg-surface rounded-card shadow-card border border-border overflow-hidden">
            {visible.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-label-2">
                {realtors.length === 0
                  ? 'No partners yet. Add your top agents to start tracking referrals.'
                  : 'No partners match these filters.'}
              </div>
            ) : (
              visible.map((r) => <RealtorRow key={r.id} realtor={r} />)
            )}
          </div>
        </div>
      )}

      {/* ── DISCOVERY ── */}
      {tab === 'discovery' && (
        <div className="bg-surface rounded-card shadow-card border border-border p-8 text-center">
          <IconCompass size={28} className="mx-auto text-[#8A6310]" />
          <h2 className="text-[15px] font-semibold text-black mt-3">Find new partners</h2>
          <p className="text-sm text-label-2 mt-1 max-w-md mx-auto">
            Match with high-producing agents in your market — scored by geography, price band, volume, and
            buyer-side focus.
          </p>
          <Link
            href="/discover"
            className="inline-flex items-center gap-1.5 h-9 px-4 mt-4 rounded-btn text-sm font-medium text-white"
            style={{ background: GOLD }}
          >
            Open Discovery <IconExternalLink size={14} />
          </Link>
          <p className="text-xs text-label-3 mt-3">
            Market data sync is configured per organization.
          </p>
        </div>
      )}

      {/* ── CO-MARKETING ── */}
      {tab === 'comarketing' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-black">Shared content</h2>
            <Link
              href="/social/ideas"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-btn text-sm font-medium text-white"
              style={{ background: GOLD }}
            >
              <IconSparkles size={14} /> Create co-branded content
            </Link>
          </div>
          {assets.length === 0 ? (
            <div className="bg-surface rounded-card shadow-card border border-border px-4 py-10 text-center">
              <IconUsers size={24} className="mx-auto text-label-3" />
              <p className="text-sm text-label-2 mt-2">No co-branded pieces yet.</p>
              <p className="text-xs text-label-3 mt-1">
                Co-branded flyers and posts you create with partners will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {assets.map((a) => {
                const r = realtors.find((x) => x.id === a.realtor_id);
                return (
                  <div key={a.id} className="bg-surface rounded-card shadow-card border border-border p-4">
                    <p className="text-sm font-medium text-black">{a.title || a.asset_type || 'Co-branded asset'}</p>
                    <p className="text-xs text-label-2 mt-0.5 capitalize">
                      {(a.asset_type ?? '').replace(/_/g, ' ')}
                      {r ? ` · ${r.first_name ?? ''} ${r.last_name ?? ''}`.trimEnd() : ''}
                    </p>
                    {a.file_url && (
                      <a
                        href={a.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium mt-2 text-[#8A6310]"
                      >
                        Open <IconExternalLink size={12} />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddPartnerForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ first_name: '', last_name: '', brokerage_name: '', primary_city: '', phone: '', email: '', transactions_12m: '', volume_12m: '', deals_referred_12m: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!f.first_name.trim() || !f.last_name.trim()) { setErr('First and last name are required.'); return; }
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch('/api/realtors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...f,
          transactions_12m: Number(f.transactions_12m) || 0,
          volume_12m: Number(f.volume_12m) || 0,
          deals_referred_12m: Number(f.deals_referred_12m) || 0,
        }),
      });
      if (!r.ok) { setErr('Could not save. Try again.'); return; }
      onDone();
    } finally {
      setSaving(false);
    }
  }

  const inp = 'h-9 px-3 rounded-btn text-sm bg-surface border border-border text-black placeholder:text-label-3 focus:outline-none focus:ring-1 focus:ring-[#C9A95C]';

  return (
    <div className="bg-surface rounded-card shadow-card border border-border p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input className={inp} placeholder="First name *" value={f.first_name} onChange={(e) => set('first_name', e.target.value)} />
        <input className={inp} placeholder="Last name *" value={f.last_name} onChange={(e) => set('last_name', e.target.value)} />
        <input className={inp} placeholder="Brokerage" value={f.brokerage_name} onChange={(e) => set('brokerage_name', e.target.value)} />
        <input className={inp} placeholder="City" value={f.primary_city} onChange={(e) => set('primary_city', e.target.value)} />
        <input className={inp} placeholder="Phone" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        <input className={inp} placeholder="Email" value={f.email} onChange={(e) => set('email', e.target.value)} />
        <input className={inp} placeholder="Transactions (12mo)" inputMode="numeric" value={f.transactions_12m} onChange={(e) => set('transactions_12m', e.target.value)} />
        <input className={inp} placeholder="Volume (12mo $)" inputMode="numeric" value={f.volume_12m} onChange={(e) => set('volume_12m', e.target.value)} />
      </div>
      {err && <p className="text-xs text-red">{err}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="h-9 px-4 rounded-btn text-sm font-medium bg-fill text-black border border-border">Cancel</button>
        <button onClick={save} disabled={saving} className="h-9 px-4 rounded-btn text-sm font-medium text-white disabled:opacity-50" style={{ background: GOLD }}>
          {saving ? 'Saving…' : 'Add partner'}
        </button>
      </div>
    </div>
  );
}
