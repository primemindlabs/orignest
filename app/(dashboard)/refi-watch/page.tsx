export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import RefiWatchClient from './RefiWatchClient';

export const metadata: Metadata = { title: 'Refi Watch' };

export default function RefiWatchPage() {
  return <RefiWatchClient />;
}
