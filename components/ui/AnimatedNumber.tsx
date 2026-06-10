'use client';

/**
 * Phase 65.2.3 — count-up animation for metric values. Additive: drop into any
 * metric display. Uses framer-motion's smooth ease; respects prefers-reduced-motion.
 * Styling is passed via className (no globals.css dependency).
 */
import { useEffect } from 'react';
import { useMotionValue, useTransform, animate, motion, useReducedMotion } from 'framer-motion';

export interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  durationSeconds?: number;
  format?: (v: number) => string;
  className?: string;
}

export function AnimatedNumber({ value, decimals = 0, durationSeconds = 1.2, format, className }: AnimatedNumberProps) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const out = useTransform(mv, (v) => (format ? format(v) : decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString()));

  useEffect(() => {
    if (reduce) { mv.set(value); return; }
    const controls = animate(mv, value, { duration: durationSeconds, ease: [0.16, 1, 0.3, 1] });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);

  return <motion.span className={className}>{out}</motion.span>;
}

export default AnimatedNumber;
