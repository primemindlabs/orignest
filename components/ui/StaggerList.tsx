'use client';

/**
 * Phase 65.5 — staggered list entry. Additive: wrap a list, wrap each item.
 * Respects prefers-reduced-motion. No globals.css dependency.
 *
 *   <StaggerList><StaggerItem>…</StaggerItem>…</StaggerList>
 */
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

const CONTAINER: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } } };
const ITEM: Variants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } } };

export function StaggerList({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return <motion.div className={className} variants={CONTAINER} initial="hidden" animate="show">{children}</motion.div>;
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return <motion.div className={className} variants={ITEM}>{children}</motion.div>;
}

export default StaggerList;
