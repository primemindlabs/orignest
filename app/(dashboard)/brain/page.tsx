import type { Metadata } from 'next';
import { FeatureGate } from '@/components/billing/FeatureGate';
import { BrainGlobalSearch } from '@/components/brain/BrainGlobalSearch';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ashley Brain™' };

export default function BrainPage() {
  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-[22px] font-bold text-black tracking-tight">Ashley Brain™</h1>
        <p className="text-[14px] text-label-2 mt-0.5">
          Everything Ashley remembers across your borrowers, realtors, and partners — searchable in one place.
        </p>
      </div>

      <FeatureGate feature="ashley_brain">
        <BrainGlobalSearch />
      </FeatureGate>
    </div>
  );
}
