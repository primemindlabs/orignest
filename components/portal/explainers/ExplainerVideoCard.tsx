'use client';

// Phase 123 — AI explainer video card (static UI; real video arrives in a later phase).
import { IconPlayerPlayFilled } from '@tabler/icons-react';

export function ExplainerVideoCard({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <button className="w-full text-left bg-[#0F0D0B] rounded-2xl overflow-hidden group">
      <div className="relative aspect-video flex items-center justify-center">
        <div className="absolute inset-0 opacity-[0.12]" style={{ background: 'radial-gradient(circle at 30% 30%, #C9A95C, transparent 60%)' }} />
        <div className="w-12 h-12 rounded-full bg-[#C9A95C] flex items-center justify-center group-hover:scale-105 transition-transform">
          <IconPlayerPlayFilled size={20} color="#5A3E15" />
        </div>
        <span className="absolute bottom-2 right-3 text-[10px] text-white/40">Coming soon</span>
      </div>
      <div className="px-4 py-3">
        <p className="text-[13px] font-medium text-[#F5F3F0]">{title}</p>
        {subtitle && <p className="text-[11px] text-white/40 mt-0.5">{subtitle}</p>}
      </div>
    </button>
  );
}
