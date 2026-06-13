'use client';

// Phase 123 — full-screen funded celebration (confetti + loan summary). Shows once.
import { useEffect, useState } from 'react';
import { IconHomeCheck } from '@tabler/icons-react';

interface Props { token: string; homePrice: number | null; rate: number | null; monthlyPayment: number | null; onContinue: () => void }

export function FundedCelebration({ token, homePrice, rate, monthlyPayment, onContinue }: Props) {
  const [dots, setDots] = useState<Array<{ x: number; y: number; size: number; color: string; opacity: number }>>([]);

  useEffect(() => {
    const colors = ['#C9A95C', '#D9B96E', '#E8D4A0', '#F5EDD8', '#FAFAF8'];
    setDots(Array.from({ length: 30 }, (_, i) => ({
      x: (i * 37) % 100, y: (i * 53) % 100, size: 3 + ((i * 7) % 8), color: colors[i % colors.length], opacity: 0.3 + ((i % 6) / 10),
    })));
  }, []);

  const handleContinue = async () => {
    try {
      await fetch(`/api/borrower-portal/${token}/celebration`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ celebrationType: 'funded' }) });
    } catch { /* non-blocking */ }
    onContinue();
  };

  return (
    <div className="fixed inset-0 bg-[#0F0D0B] flex flex-col items-center justify-center z-[70] overflow-hidden">
      {dots.map((d, i) => (
        <div key={i} className="absolute rounded-full pointer-events-none" style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.size, height: d.size, background: d.color, opacity: d.opacity }} />
      ))}
      <div className="relative z-10 text-center max-w-md px-6">
        <div className="w-[72px] h-[72px] rounded-full bg-[#C9A95C] flex items-center justify-center mx-auto mb-5"><IconHomeCheck size={34} color="#5A3E15" /></div>
        <h1 className="text-[32px] font-medium text-[#F5F3F0] tracking-tight mb-2">Congratulations!</h1>
        <p className="text-[16px] text-[#C9A95C] mb-8">Your loan is funded. You&rsquo;re a homeowner.</p>
        <div className="flex justify-center gap-8 mb-8">
          {homePrice != null && (<div><p className="text-[20px] font-medium text-[#F5F3F0] font-mono">${homePrice.toLocaleString()}</p><p className="text-[11px] text-white/40 mt-1">Home price</p></div>)}
          {rate != null && (<><div className="w-px bg-white/10" /><div><p className="text-[20px] font-medium text-[#F5F3F0] font-mono">{rate.toFixed(3)}%</p><p className="text-[11px] text-white/40 mt-1">Your rate</p></div></>)}
          {monthlyPayment != null && (<><div className="w-px bg-white/10" /><div><p className="text-[20px] font-medium text-[#C9A95C] font-mono">${monthlyPayment.toLocaleString()}</p><p className="text-[11px] text-white/40 mt-1">Monthly payment</p></div></>)}
        </div>
        <button onClick={handleContinue} className="px-8 py-3 bg-[#C9A95C] rounded-xl text-[14px] font-medium text-[#5A3E15] hover:bg-[#D9B96E] transition-colors">Go to my Wealth Map →</button>
      </div>
    </div>
  );
}
