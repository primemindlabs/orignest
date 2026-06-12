export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import RefiWatchClient from './RefiWatchClient';
import { RefiBlastPanel } from '@/components/refi/RefiBlastPanel';

export const metadata: Metadata = { title: 'Refi Watch' };

export default function RefiWatchPage() {
  return (
    <>
      {/* Phase 86 — RESPA-compliant rate-trigger blast (additive). */}
      <RefiBlastPanel />
      <RefiWatchClient />
    </>
  );
}
