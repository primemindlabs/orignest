import { ClerkProvider } from '@clerk/nextjs';
import { Lora, Instrument_Sans, DM_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import type { Metadata } from 'next';
import './globals.css';

// Display — headings, product names, metric callouts
const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-lora',
  display: 'swap',
});

// UI — all labels, body copy, inputs
const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-instrument-sans',
  display: 'swap',
});

// Data — numbers, percentages, dates, IDs, codes
const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'AshleyIQ — Your AI Mortgage Assistant',
    template: '%s | AshleyIQ',
  },
  description: 'AshleyIQ answers leads in seconds, follows up automatically, collects documents, updates your pipeline, and helps you close more loans.',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/apple-icon.png',
  },
  keywords: ['mortgage CRM', 'AI mortgage assistant', 'loan officer software', 'TRID compliance', 'mortgage pipeline', 'mortgage broker software'],
  authors: [{ name: 'PrimeMind Labs' }],
  // Use `||` (not `??`) so an empty-string env var also falls back — an empty
  // NEXT_PUBLIC_APP_URL would otherwise crash the build with `new URL("")`.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://ashleyiq.com'),
  openGraph: {
    type: 'website',
    title: 'AshleyIQ — Your AI Mortgage Assistant',
    description: 'The AI mortgage assistant that never sleeps.',
    siteName: 'AshleyIQ',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      // Route sign-ins through /onboarding, which activates the user's Clerk
      // organization (Clerk doesn't auto-activate one on sign-in) and then hard-
      // navigates to /dashboard with the org claim in the session cookie. Sending
      // sign-ins straight to /dashboard caused a blink loop: the dashboard pages
      // require auth().orgId, which is null until an org is activated.
      afterSignInUrl="/onboarding"
      afterSignUpUrl="/onboarding"
    >
      <html lang="en" className={`${lora.variable} ${instrumentSans.variable} ${dmMono.variable}`}>
        <body className="bg-bg font-sans antialiased">
          {children}
          <Toaster
            richColors
            position="top-right"
            expand={false}
            toastOptions={{
              style: {
                fontFamily: 'var(--font-instrument-sans), system-ui, sans-serif',
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
