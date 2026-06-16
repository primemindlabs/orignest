import type { Metadata } from 'next';
import PricingClient from './PricingClient';
import { PricingTabs } from '@/components/layout/HubTabs';

export const metadata: Metadata = {
  title: 'Pricing Engine — AshleyIQ',
};

export default function PricingPage() {
  return (<><PricingTabs /><PricingClient /></>);
}
