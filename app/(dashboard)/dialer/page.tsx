export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import DialerClient from './DialerClient';

export const metadata: Metadata = { title: 'Dialer' };

export default function DialerPage() {
  return <DialerClient />;
}
