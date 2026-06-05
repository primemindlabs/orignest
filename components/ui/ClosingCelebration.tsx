'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X, Share2, Check } from 'lucide-react';

interface ClosingData {
  borrowerFirstName: string;
  borrowerLastName: string;
  loanAmount: number | null;
  loName?: string;
}

interface ClosingCelebrationProps {
  data: ClosingData | null;
  onDismiss: () => void;
}

const CONFETTI_COLORS = ['#007AFF', '#34C759', '#C9A95C', '#FF9500', '#FF3B30', '#AF52DE'];
const PARTICLE_COUNT = 60;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

interface Particle {
  id: number;
  color: string;
  x: number;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
}

function Confetti() {
  const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    x: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 2 + Math.random() * 2,
    size: 6 + Math.random() * 6,
    rotation: Math.random() * 720,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute top-0 rounded-sm"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size * 0.5,
            backgroundColor: p.color,
            animationName: 'confetti-fall',
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            animationTimingFunction: 'ease-in',
            animationFillMode: 'both',
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export function ClosingCelebration({ data, onDismiss }: ClosingCelebrationProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!data) return;
    setCopied(false);
    timerRef.current = setTimeout(onDismiss, 6000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, onDismiss]);

  function handleShare() {
    if (!data) return;
    const lastInitial = data.borrowerLastName?.[0] ?? '';
    const amount = data.loanAmount ? formatCurrency(data.loanAmount) : 'a new loan';
    const text = `Just closed another one! 🏠 ${amount} for ${data.borrowerFirstName} ${lastInitial}. #mortgage #closing`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[4px]"
            onClick={onDismiss}
          />

          {/* Confetti */}
          <Confetti />

          {/* Card */}
          <motion.div
            className="relative z-10 bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] p-8 mx-4 max-w-[420px] w-full text-center border border-black/[0.06]"
            initial={{ opacity: 0, scale: 0.8, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28, delay: 0.05 }}
          >
            {/* Close */}
            <button
              onClick={onDismiss}
              className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/[0.06] transition-colors text-[#AEAEB2]"
            >
              <X size={14} />
            </button>

            {/* Trophy */}
            <motion.div
              animate={{ scale: [1, 1.15, 1], rotate: [-5, 5, -3, 3, 0] }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-6xl mb-4 select-none"
              aria-hidden="true"
            >
              🎉
            </motion.div>

            {/* Label */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6C6C70] mb-1"
            >
              Loan Closed
            </motion.p>

            {/* Headline */}
            <motion.h2
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-[28px] font-thin tracking-tight text-[#1C1C1E] leading-tight"
            >
              {data.borrowerFirstName} {data.borrowerLastName}
            </motion.h2>

            {/* Amount */}
            {data.loanAmount && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-[38px] font-thin tracking-tight tabular-nums mt-1"
                style={{
                  background: 'linear-gradient(135deg, #C9A95C 0%, #E8C97A 50%, #C9A95C 100%)',
                  backgroundSize: '200% 100%',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'gold-shimmer 2s infinite linear',
                }}
              >
                {formatCurrency(data.loanAmount)}
              </motion.p>
            )}

            {/* LO name */}
            {data.loName && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-[13px] text-[#AEAEB2] mt-2"
              >
                Closed by {data.loName}
              </motion.p>
            )}

            {/* Trophy icon */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="flex items-center justify-center gap-2 mt-5"
            >
              <Trophy size={14} className="text-[#C9A95C]" />
              <span className="text-[12px] text-[#AEAEB2]">Another one closed!</span>
              <Trophy size={14} className="text-[#C9A95C]" />
            </motion.div>

            {/* Share button */}
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              onClick={handleShare}
              className="mt-5 flex items-center gap-2 mx-auto h-9 px-5 rounded-xl bg-[#1C1C1E] text-white text-[13px] font-medium hover:bg-black transition-colors"
            >
              {copied ? (
                <>
                  <Check size={13} className="text-green" />
                  Copied to clipboard!
                </>
              ) : (
                <>
                  <Share2 size={13} />
                  Share this win
                </>
              )}
            </motion.button>

            <style>{`
              @keyframes gold-shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
              }
            `}</style>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
