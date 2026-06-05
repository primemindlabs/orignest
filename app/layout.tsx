import { ClerkProvider } from '@clerk/nextjs';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import type { Metadata } from 'next';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Orignest',
    template: '%s | Orignest',
  },
  description: 'The mortgage OS built for loan officers and brokers. TRID · TCPA · GLBA compliant. AI-powered pipeline, DSCR tools, and autopilot automation.',
  keywords: ['mortgage CRM', 'loan officer software', 'TRID compliance', 'DSCR calculator', 'mortgage pipeline', 'non-QM', 'mortgage broker software'],
  authors: [{ name: 'PrimeMind Labs' }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.orignest.com'),
  openGraph: {
    type: 'website',
    title: 'Orignest — Mortgage OS',
    description: 'Run your entire mortgage business on autopilot.',
    siteName: 'Orignest',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <body className="bg-bg font-sans antialiased">
          {children}
          <Toaster
            richColors
            position="top-right"
            expand={false}
            toastOptions={{
              style: {
                fontFamily: 'var(--font-inter), -apple-system, sans-serif',
                fontSize: '13px',
                borderRadius: '10px',
              },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
