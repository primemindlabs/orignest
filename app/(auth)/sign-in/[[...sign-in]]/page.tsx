import { SignIn } from '@clerk/nextjs';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Conduit CRM account.',
};

const FEATURES = [
  {
    icon: '⚡',
    text: 'Speed-to-contact tracking with instant alerts',
  },
  {
    icon: '📊',
    text: 'Full pipeline visibility from new lead to close',
  },
  {
    icon: '🤝',
    text: 'Referral partner management and scoring',
  },
  {
    icon: '🔒',
    text: 'TRID, TCPA, and GLBA compliance built in',
  },
] as const;

export default function SignInPage() {
  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ──────────────────────────────────────────── */}
      <div className="hidden lg:flex w-3/5 bg-navy flex-col p-14 relative overflow-hidden">
        {/* Diagonal line texture */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(-45deg, #fff 0px, #fff 1px, transparent 1px, transparent 40px)',
          }}
        />
        {/* Gold radial glow */}
        <div className="absolute -bottom-44 -right-44 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(201,169,92,0.18)_0%,transparent_70%)]" />

        {/* Wordmark */}
        <div className="text-[26px] font-bold text-white tracking-tight z-10">
          Conduit<span className="text-gold">.</span>
        </div>

        {/* Headline */}
        <div className="flex-1 flex flex-col justify-center z-10 max-w-lg">
          <h1 className="text-[36px] font-bold text-white leading-tight tracking-tight mb-4">
            The CRM built for mortgage teams that close.
          </h1>
          <p className="text-white/70 text-base leading-relaxed mb-10">
            From first contact to funded — manage every lead, every partner, every touchpoint.
            TRID deadlines, TCPA consent, and GLBA compliance handled automatically.
          </p>

          {/* Feature list */}
          <div className="space-y-4">
            {FEATURES.map((feature) => (
              <div key={feature.text} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-[10px] bg-white/10 flex items-center justify-center flex-shrink-0 text-lg">
                  {feature.icon}
                </div>
                <span className="text-white/85 text-sm">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/40 text-xs z-10">
          TRID · TCPA · GLBA compliant · SOC 2 Type II ready
        </p>
      </div>

      {/* ── Right sign-in panel ───────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile wordmark */}
          <div className="lg:hidden text-[22px] font-bold text-navy tracking-tight mb-8">
            Conduit<span className="text-gold">.</span>
          </div>

          <h2 className="text-2xl font-bold text-black mb-1 tracking-tight">Welcome back</h2>
          <p className="text-label-2 text-sm mb-6">Sign in to your team&apos;s CRM</p>

          <SignIn
            appearance={{
              variables: {
                colorPrimary: '#007AFF',
                fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
                borderRadius: '10px',
              },
              elements: {
                card: {
                  boxShadow: 'none',
                  border: 'none',
                  padding: 0,
                },
                rootBox: {
                  width: '100%',
                },
              },
            }}
          />

          <p className="mt-6 text-xs text-label-3 text-center">
            By signing in, you agree to Conduit&apos;s{' '}
            <a href="/terms" className="underline hover:text-label-2">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="underline hover:text-label-2">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
