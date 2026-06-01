import { SignUp } from '@clerk/nextjs';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create your Conduit CRM account.',
};

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ──────────────────────────────────────────── */}
      <div className="hidden lg:flex w-3/5 bg-navy flex-col p-14 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(-45deg, #fff 0px, #fff 1px, transparent 1px, transparent 40px)',
          }}
        />
        <div className="absolute -bottom-44 -right-44 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(201,169,92,0.18)_0%,transparent_70%)]" />

        <div className="text-[26px] font-bold text-white tracking-tight z-10">
          Conduit<span className="text-gold">.</span>
        </div>

        <div className="flex-1 flex flex-col justify-center z-10 max-w-lg">
          <h1 className="text-[36px] font-bold text-white leading-tight tracking-tight mb-4">
            Start your free 14-day trial.
          </h1>
          <p className="text-white/70 text-base leading-relaxed mb-10">
            No credit card required. Full access to all features during your trial. Cancel
            anytime.
          </p>

          <div className="space-y-3">
            {[
              'TRID compliance tracking — automatic deadline calculation',
              'TCPA consent management — documented, auditable',
              'AI Coach powered by Claude — close more, faster',
              'Multi-user pipeline with role-based access',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-gold" />
                </div>
                <span className="text-white/80 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/40 text-xs z-10">TRID · TCPA · GLBA compliant</p>
      </div>

      {/* ── Right sign-up panel ───────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12 bg-white">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-[22px] font-bold text-navy tracking-tight mb-8">
            Conduit<span className="text-gold">.</span>
          </div>

          <h2 className="text-2xl font-bold text-black mb-1 tracking-tight">
            Create your account
          </h2>
          <p className="text-label-2 text-sm mb-6">14-day free trial · No credit card required</p>

          <SignUp
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
            By creating an account, you agree to Conduit&apos;s{' '}
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
