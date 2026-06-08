import type { Metadata } from 'next';
import DSCRClient from './DSCRClient';

export const metadata: Metadata = {
  title: 'DSCR / Non-QM — AshleyIQ',
};

export default function DSCRPage() {
  return <DSCRClient />;
}
