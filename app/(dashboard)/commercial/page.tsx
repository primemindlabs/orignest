import type { Metadata } from 'next';
import CommercialClient from './CommercialClient';

export const metadata: Metadata = {
  title: 'Commercial — AshleyIQ',
};

export default function CommercialPage() {
  return <CommercialClient />;
}
