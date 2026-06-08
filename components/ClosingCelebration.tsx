'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { CelebrationData } from '@/hooks/useClosingCelebration';

interface ClosingCelebrationProps {
  celebration: CelebrationData | null;
  onDismiss: () => void;
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

// CSS-only confetti — 50 colored divs with random animations
function Confetti() {
  const colors = [
    '#C9A95C', '#34C759', '#C9A95C', '#FF9500', '#FF3B30',
    '#AF52DE', '#5AC8FA', '#FFCC00', '#FF2D55', '#4CD964',
  ];

  const pieces = Array.from({ length: 60 }, (_, i) => {
    const color = colors[i % colors.length];
    const left = Math.random() * 100;
    const delay = Math.random() * 1.2;
    const duration = 1.8 + Math.random() * 1.4;
    const size = 6 + Math.random() * 8;
    const rotation = Math.random() * 360;
    const isRect = Math.random() > 0.5;

    return (
      <div
        key={i}
        className="absolute top-0 pointer-events-none"
        style={{
          left: `${left}%`,
          width: size,
          height: isRect ? size * 0.5 : size,
          backgroundColor: color,
          borderRadius: isRect ? 2 : '50%',
          animation: `confetti-fall ${duration}s ${delay}s ease-in forwards`,
          transform: `rotate(${rotation}deg)`,
          opacity: 0,
        }}
      />
    );
  });

  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">{pieces}</div>
    </>
  );
}

export function ClosingCelebration({ celebration, onDismiss }: ClosingCelebrationProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (celebration) {
      timerRef.current = setTimeout(onDismiss, 5500);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [celebration, onDismiss]);

  return (
    <AnimatePresence>
      {celebration && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          aria-live="assertive"
          aria-label={`Loan closed for ${celebration.name}`}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm pointer-events-none" />

          {/* Confetti */}
          <Confetti />

          {/* Card */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -10 }}
            transition={{ delay: 0.1, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            className="relative z-10 bg-white rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.25)] border border-black/[0.06] px-10 py-8 text-center max-w-sm w-full mx-4 pointer-events-auto"
            onClick={onDismiss}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onDismiss()}
          >
            {/* Emoji */}
            <div className="text-5xl mb-4 select-none">🎉</div>

            {/* Title */}
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#C9A95C] mb-1">
              Loan Closed
            </p>

            {/* Borrower name */}
            <h2 className="text-xl font-semibold text-black mb-4 tracking-tight">
              {celebration.name}
            </h2>

            {/* Amount with glow */}
            <div className="relative inline-block mb-5">
              {/* Gold glow behind amount */}
              <div
                className="absolute inset-0 blur-2xl opacity-30 rounded-full"
                style={{ background: 'radial-gradient(ellipse at center, #C9A95C 0%, transparent 70%)' }}
              />
              <p
                className="relative text-5xl font-thin tracking-tight text-black tabular-nums"
                style={{ fontFamily: 'Inter, -apple-system, sans-serif' }}
              >
                {formatCurrency(celebration.amount)}
              </p>
            </div>

            {/* Date */}
            <p className="text-sm text-[#6C6C70]">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>

            <p className="text-[11px] text-[#AEAEB2] mt-5">Tap to dismiss</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
