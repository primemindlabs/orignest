'use client';

import { useState } from 'react';
import { TrendingDown, MessageSquare, X, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  leadId: string;
  leadName: string;
  monthlySavings: number;
  originalRate: number;
  currentRate: number;
  draftSMS?: string;
}

export function RateWatchBadge({
  monthlySavings,
  originalRate,
  currentRate,
  draftSMS,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copySMS() {
    if (!draftSMS) return;
    await navigator.clipboard.writeText(draftSMS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={cn('rounded-[10px] border overflow-hidden transition-all', expanded ? 'border-green/30 bg-green/[0.04]' : 'border-green/20 bg-green/10')}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left"
      >
        <TrendingDown size={15} className="text-green flex-shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-green">Refi Opportunity Detected</p>
          <p className="text-[11px] text-green/80">Est. savings: ${monthlySavings.toLocaleString()}/mo · {originalRate}% → {currentRate}%</p>
        </div>
        {expanded ? <X size={13} className="text-green/60" /> : <MessageSquare size={13} className="text-green/60" />}
      </button>

      {expanded && draftSMS && (
        <div className="px-3 pb-3 pt-1 border-t border-green/20">
          <p className="text-[10px] font-semibold text-label-3 uppercase tracking-wide mb-2">Draft SMS (review before sending)</p>
          <div className="bg-white rounded-[8px] border border-green/20 p-3 text-xs text-label leading-relaxed">
            {draftSMS}
          </div>
          <div className="flex justify-end mt-2">
            <button
              onClick={copySMS}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green text-white text-xs font-semibold rounded-[8px] hover:bg-green/90 transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy SMS'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
