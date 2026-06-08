export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import ReferralAttributionClient from './ReferralAttributionClient';

export const metadata: Metadata = { title: 'Referral Attribution' };

export default function ReferralAttributionPage() {
  return <ReferralAttributionClient />;
}
