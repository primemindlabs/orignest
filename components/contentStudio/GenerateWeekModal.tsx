'use client';

import { useState } from 'react';
import { IconX, IconSparkles } from '@tabler/icons-react';

export type GenerateOptions = { focusTopic?: string; marketArea?: string; recentCloseType?: string };

const CLOSE_TYPES = ['', 'Conventional', 'FHA', 'VA', 'DSCR', 'Jumbo'];

export function GenerateWeekModal({ onClose, onGenerate, busy }: { onClose: () => void; onGenerate: (o: GenerateOptions) => void; busy: boolean }) {
  const [focusTopic, setFocusTopic] = useState('');
  const [marketArea, setMarketArea] = useState('');
  const [recentCloseType, setRecentCloseType] = useState('');

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-[#E8E4DE] w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-[#1A1A1A]" style={{ fontFamily: 'var(--font-lora), Lora, serif' }}>Generate a week of content</h2>
          <button onClick={onClose} className="text-[#6B7B8D] hover:text-[#1A1A1A]"><IconX size={18} /></button>
        </div>
        <p className="text-sm text-[#6B7B8D] mb-4">Optional — Ashley fills in the rest. Leave blank for a balanced default week.</p>

        <label className="block text-xs font-medium text-[#6B7B8D] mb-1">Market area</label>
        <input value={marketArea} onChange={(e) => setMarketArea(e.target.value)} placeholder="e.g. Atlanta, GA" className="w-full text-sm border border-[#E8E4DE] rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-[#C9A95C]" />

        <label className="block text-xs font-medium text-[#6B7B8D] mb-1">Focus topic (optional)</label>
        <input value={focusTopic} onChange={(e) => setFocusTopic(e.target.value)} placeholder="e.g. first-time buyers, refis" className="w-full text-sm border border-[#E8E4DE] rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-[#C9A95C]" />

        <label className="block text-xs font-medium text-[#6B7B8D] mb-1">Closed a loan this week? (powers Thursday’s win post)</label>
        <select value={recentCloseType} onChange={(e) => setRecentCloseType(e.target.value)} className="w-full text-sm border border-[#E8E4DE] rounded-lg px-3 py-2 mb-5 bg-white focus:outline-none focus:border-[#C9A95C]">
          {CLOSE_TYPES.map((t) => <option key={t} value={t}>{t || 'No / skip'}</option>)}
        </select>

        <button
          onClick={() => onGenerate({ focusTopic: focusTopic || undefined, marketArea: marketArea || undefined, recentCloseType: recentCloseType || undefined })}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-[#C9A95C] text-white text-sm px-4 py-2.5 rounded-lg hover:brightness-95 disabled:opacity-50"
        >
          <IconSparkles size={15} /> {busy ? 'Generating your week…' : 'Generate 7 posts'}
        </button>
      </div>
    </div>
  );
}
