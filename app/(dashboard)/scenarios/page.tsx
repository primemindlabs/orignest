export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import ScenariosClient from './ScenariosClient';

export const metadata: Metadata = { title: 'Scenario Comparison' };

export default function ScenariosPage() {
  return <ScenariosClient />;
}
