'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconFlame, IconMessage } from '@tabler/icons-react';

type Band = 'hot' | 'warm' | 'cooling' | 'cold';

interface HeatBorrower {
  lead_id: string;
  name: string;
  phone: string | null;
  score: number;
  band: Band;
  days_since_last_contact: number | null;
  top_signal: string | null;
}

const BANDS: { key: Band; label: string; color: string; tint: string }[] = [
  { key: 'cooling', label: 'Cooling', color: '#C27B2A', tint: 'rgba(194,123,42,0.08)' },
  { key: 'hot', label: 'Hot', color: '#3B6D11', tint: 'rgba(59,109,17,0.08)' },
  { key: 'warm', label: 'Warm', color: '#C9A95C', tint: 'rgba(201,169,92,0.10)' },
  { key: 'cold', label: 'Cold', color: '#9B9590', tint: 'rgba(155,149,144,0.10)' },
];

export function BorrowerHeatGrid() {
  const router = useRouter();
  const [borrowers, setBorrowers] = useState<HeatBorrower[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/borrowers/heat-scores')
      .then((r) => r.json())
      .then((d) => {
        setBorrowers(d.borrowers ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-400 py-10 text-center">Loading…</p>;

  if (borrowers.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl py-12 text-center">
        <IconFlame size={26} className="text-[#C9A95C] mx-auto" />
        <p className="mt-3 text-sm font-medium text-gray-900">No heat scores yet</p>
        <p className="mt-1 text-xs text-gray-500">Scores populate after the daily borrower-heat refresh runs.</p>
      </div>
    );
  }

  const byBand = (b: Band) => borrowers.filter((x) => x.band === b);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {BANDS.map((band) => {
        const list = byBand(band.key);
        return (
          <div key={band.key} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between" style={{ background: band.tint }}>
              <span className="text-sm font-semibold" style={{ color: band.color }}>
                {band.label}
              </span>
              <span className="text-xs font-medium" style={{ color: band.color }}>
                {list.length}
              </span>
            </div>
            <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto">
              {list.length === 0 ? (
                <p className="text-xs text-gray-300 text-center py-6">None</p>
              ) : (
                list.map((b) => (
                  <div key={b.lead_id} className="px-3 py-3">
                    <button onClick={() => router.push(`/leads/${b.lead_id}`)} className="w-full text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{b.name}</span>
                        <span className="text-xs font-bold tabular-nums" style={{ color: band.color }}>
                          {b.score}
                        </span>
                      </div>
                      {b.top_signal && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{b.top_signal}</p>}
                      {b.days_since_last_contact != null && (
                        <p className="text-[11px] text-gray-300 mt-0.5">{b.days_since_last_contact}d since contact</p>
                      )}
                    </button>
                    {b.phone && (
                      <a
                        href={`sms:${b.phone}`}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[#C9A95C] hover:underline"
                      >
                        <IconMessage size={12} /> Reach out
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
