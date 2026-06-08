import type { Metadata } from 'next';
import PricingClient from './PricingClient';

export const metadata: Metadata = {
  title: 'Pricing Engine — AshleyIQ',
};

export default function PricingPage() {
  return <PricingClient />;
}
