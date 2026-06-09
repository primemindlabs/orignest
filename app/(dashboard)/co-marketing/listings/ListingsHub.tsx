'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Download, Plus, Link2, Home, Sparkles } from 'lucide-react';

interface Listing {
  id: string;
  address_line1: string;
  address_city: string;
  address_state: string;
  list_price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  primary_photo_url: string | null;
  listing_status: string;
  source: string;
}

const TEMPLATES = [
  { value: 'flyer_just_listed', label: 'Just Listed' },
  { value: 'flyer_open_house', label: 'Open House' },
  { value: 'flyer_just_sold', label: 'Just Sold' },
  { value: 'rate_spotlight', label: 'Rate Spotlight' },
];
const SIZES = [
  { value: 'square', label: 'Square 1080×1080' },
  { value: 'story', label: 'Story 1080×1920' },
  { value: 'landscape', label: 'Landscape 1200×628' },
];
const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const EMPTY = { address_line1: '', address_city: '', address_state: '', address_zip: '', list_price: '', bedrooms: '', bathrooms: '', sqft: '', year_built: '', mls_number: '', primary_photo_url: '', description: '' };

export function ListingsHub({ initial }: { initial: Listing[] }) {
  const [listings, setListings] = useState<Listing[]>(initial);
  const [mode, setMode] = useState<'none' | 'import' | 'manual'>('none');
  const [zillowUrl, setZillowUrl] = useState('');
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [importMeta, setImportMeta] = useState<{ photo_urls?: string[]; zillow_url?: string; zillow_zpid?: string; source?: string }>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Flyer generation state per listing.
  const [gen, setGen] = useState<{ listingId: string; type: string; size: string } | null>(null);

  async function runImport() {
    setBusy(true); setNotice(null);
    try {
      const res = await fetch('/api/listings/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zillow_url: zillowUrl }) });
      const json = await res.json();
      if (json.fallback) {
        setNotice(json.reason ?? 'Auto-import unavailable — enter details manually.');
        setMode('manual');
      } else {
        const l = json.listing;
        setForm({ ...EMPTY, address_line1: l.address_line1 ?? '', address_city: l.address_city ?? '', address_state: l.address_state ?? '', address_zip: l.address_zip ?? '', list_price: String(l.list_price ?? ''), bedrooms: String(l.bedrooms ?? ''), bathrooms: String(l.bathrooms ?? ''), sqft: String(l.sqft ?? ''), year_built: String(l.year_built ?? ''), mls_number: l.mls_number ?? '', primary_photo_url: l.primary_photo_url ?? '', description: l.description ?? '' });
        setImportMeta({ photo_urls: l.photo_urls, zillow_url: l.zillow_url, zillow_zpid: l.zillow_zpid, source: 'zillow_url' });
        setMode('manual');
        setNotice('Imported from Zillow — review and save.');
      }
    } catch { setNotice('Import failed — enter details manually.'); setMode('manual'); }
    finally { setBusy(false); }
  }

  async function save() {
    setBusy(true);
    try {
      const res = await fetch('/api/listings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, ...importMeta }) });
      if (res.ok) {
        const { listing } = await res.json();
        setListings((l) => [{ id: listing.id, ...form, list_price: Number(form.list_price), bedrooms: Number(form.bedrooms) || null, bathrooms: Number(form.bathrooms) || null, sqft: Number(form.sqft) || null, primary_photo_url: form.primary_photo_url || importMeta.photo_urls?.[0] || null, listing_status: 'active', source: importMeta.source ?? 'manual' } as Listing, ...l]);
        setForm(EMPTY); setImportMeta({}); setMode('none'); setNotice(null);
      }
    } finally { setBusy(false); }
  }

  function flyerUrl(listingId: string, type: string, size: string) {
    return `/api/comarketing/flyer?listing=${listingId}&type=${type}&size=${size}`;
  }
  async function recordDownload(listingId: string, type: string, size: string) {
    void fetch('/api/comarketing/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listing_id: listingId, asset_type: type, storage_url: flyerUrl(listingId, type, size) }) });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" leftIcon={<Link2 size={14} />} onClick={() => { setMode('import'); setNotice(null); }}>Import from Zillow</Button>
        <Button size="sm" variant="outline" leftIcon={<Plus size={14} />} onClick={() => { setMode('manual'); setForm(EMPTY); setImportMeta({}); setNotice(null); }}>Add manually</Button>
      </div>

      {notice && <p className="text-[12px] text-label-2 bg-fill rounded-[8px] px-3 py-2">{notice}</p>}

      {mode === 'import' && (
        <div className="bg-surface border border-gold/40 rounded-card p-4 space-y-3">
          <Input label="Zillow listing URL" value={zillowUrl} onChange={(e) => setZillowUrl(e.target.value)} placeholder="https://www.zillow.com/homedetails/..." />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setMode('none')} disabled={busy}>Cancel</Button>
            <Button size="sm" onClick={runImport} loading={busy}>Import</Button>
          </div>
        </div>
      )}

      {mode === 'manual' && (
        <div className="bg-surface border border-gold/40 rounded-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Address" value={form.address_line1} onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))} />
            <Input label="City" value={form.address_city} onChange={(e) => setForm((f) => ({ ...f, address_city: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="State" value={form.address_state} onChange={(e) => setForm((f) => ({ ...f, address_state: e.target.value }))} />
            <Input label="ZIP" value={form.address_zip} onChange={(e) => setForm((f) => ({ ...f, address_zip: e.target.value }))} />
            <Input label="List price" type="number" value={form.list_price} onChange={(e) => setForm((f) => ({ ...f, list_price: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Beds" type="number" value={form.bedrooms} onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))} />
            <Input label="Baths" type="number" value={form.bathrooms} onChange={(e) => setForm((f) => ({ ...f, bathrooms: e.target.value }))} />
            <Input label="Sqft" type="number" value={form.sqft} onChange={(e) => setForm((f) => ({ ...f, sqft: e.target.value }))} />
          </div>
          <Input label="Primary photo URL" value={form.primary_photo_url} onChange={(e) => setForm((f) => ({ ...f, primary_photo_url: e.target.value }))} placeholder="https://…/photo.jpg" />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setMode('none')} disabled={busy}>Cancel</Button>
            <Button size="sm" onClick={save} loading={busy}>Save listing</Button>
          </div>
        </div>
      )}

      {/* Listings grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {listings.length === 0 && <p className="text-[13px] text-label-3 col-span-2 text-center py-8">No listings yet. Import one from Zillow or add it manually.</p>}
        {listings.map((l) => (
          <div key={l.id} className="bg-surface border border-border rounded-card overflow-hidden shadow-card">
            {l.primary_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.primary_photo_url} alt="" className="w-full h-36 object-cover" />
            ) : (
              <div className="w-full h-36 bg-fill flex items-center justify-center"><Home size={24} className="text-label-3" /></div>
            )}
            <div className="p-3">
              <p className="text-[14px] font-semibold text-black">{usd(Number(l.list_price))}</p>
              <p className="text-[12px] text-label-2 truncate">{l.address_line1}, {l.address_city} {l.address_state}</p>
              <button onClick={() => setGen({ listingId: l.id, type: 'flyer_just_listed', size: 'square' })} className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-gold-700 hover:opacity-80">
                <Sparkles size={13} /> Create flyer
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Flyer generator modal */}
      {gen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setGen(null)}>
          <div className="bg-surface rounded-[14px] w-full max-w-lg p-5 shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-black mb-3">Co-marketing flyer</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Select label="Template" options={TEMPLATES} value={gen.type} onChange={(e) => setGen((g) => g && { ...g, type: e.target.value })} />
              <Select label="Size" options={SIZES} value={gen.size} onChange={(e) => setGen((g) => g && { ...g, size: e.target.value })} />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={flyerUrl(gen.listingId, gen.type, gen.size)} alt="Flyer preview" className="w-full rounded-[10px] border border-border" />
            <div className="flex gap-2 justify-end mt-3">
              <Button size="sm" variant="outline" onClick={() => setGen(null)}>Close</Button>
              <a href={flyerUrl(gen.listingId, gen.type, gen.size)} download onClick={() => recordDownload(gen.listingId, gen.type, gen.size)}>
                <Button size="sm" leftIcon={<Download size={14} />}>Download PNG</Button>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
