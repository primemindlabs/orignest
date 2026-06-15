export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { ScenariosTabs } from './ScenariosTabs';

export const metadata: Metadata = { title: 'Scenario AI' };

export default function ScenariosPage() {
  return <ScenariosTabs />;
}
