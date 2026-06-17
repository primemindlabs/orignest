import type { Metadata } from 'next';
import { PricingTabs } from '@/components/layout/HubTabs';
import { BestExecutionClient } from './BestExecutionClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Best Execution — AshleyIQ' };

export default function BestExecutionPage() {
  return (
    <>
      <PricingTabs />
      <BestExecutionClient />
    </>
  );
}
