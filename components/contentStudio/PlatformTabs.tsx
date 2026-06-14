'use client';

import { IconBrandLinkedin, IconBrandInstagram, IconBrandFacebook, IconLayoutGrid } from '@tabler/icons-react';
import type { Platform } from '@/lib/contentStudio/types';

export type PlatformFilter = 'all' | Platform;

const TABS: { key: PlatformFilter; label: string; Icon: typeof IconLayoutGrid }[] = [
  { key: 'all', label: 'All', Icon: IconLayoutGrid },
  { key: 'linkedin', label: 'LinkedIn', Icon: IconBrandLinkedin },
  { key: 'instagram', label: 'Instagram', Icon: IconBrandInstagram },
  { key: 'facebook', label: 'Facebook', Icon: IconBrandFacebook },
];

export function PlatformTabs({ value, onChange, counts }: { value: PlatformFilter; onChange: (p: PlatformFilter) => void; counts: Record<string, number> }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {TABS.map(({ key, label, Icon }) => {
        const n = key === 'all' ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[key] ?? 0;
        const active = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${active ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-white text-[#4A4A4A] border-[#E8E4DE] hover:bg-[#FAFAF8]'}`}
          >
            <Icon size={13} /> {label}
            {n > 0 && <span className={active ? 'text-white/60' : 'text-[#6B7B8D]'}>{n}</span>}
          </button>
        );
      })}
    </div>
  );
}
