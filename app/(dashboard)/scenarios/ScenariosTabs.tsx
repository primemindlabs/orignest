'use client';

import { useState } from 'react';
import { Sparkles, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import ScenariosClient from './ScenariosClient';
import { ScenarioAIConsole } from './ScenarioAIConsole';

export function ScenariosTabs() {
  const [tab, setTab] = useState<'ai' | 'compare'>('ai');
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[24px] font-bold text-label tracking-tight">Scenario AI</h1>
        <p className="text-[13px] text-label-2 mt-0.5">Match a borrower scenario to your lenders & guidelines — or compare program payments side by side.</p>
      </div>

      <div className="flex gap-1 bg-black/[0.04] rounded-xl p-1 w-fit">
        {([['ai', 'AI Scenario', Sparkles], ['compare', 'Payment Comparison', LayoutGrid]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-[10px] text-sm font-medium transition-all',
              tab === key ? 'bg-white text-label shadow-sm' : 'text-label-2 hover:text-label'
            )}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'ai' ? <ScenarioAIConsole /> : <ScenariosClient />}
    </div>
  );
}
