import { SignUp } from '@clerk/nextjs';
import { AshleyAvatar } from '@/components/brand/AshleyAvatar';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create your AshleyIQ account.',
};

/** Ashley character — reused from sign-in */
function AshleyCharacter() {
  return (
    <svg
      width="140"
      height="156"
      viewBox="0 0 180 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Ashley, your AI mortgage assistant"
    >
      <ellipse cx="90" cy="188" rx="48" ry="8" fill="rgba(201,169,92,0.18)" />
      <rect x="54" y="120" width="72" height="62" rx="20" fill="white" fillOpacity="0.12" />
      <path d="M78 140 L90 154 L102 140 C102 140 96 136 90 136 C84 136 78 140 78 140Z" fill="#C9A95C" />
      <ellipse cx="90" cy="96" rx="38" ry="42" fill="white" fillOpacity="0.15" />
      <ellipse cx="90" cy="96" rx="34" ry="38" fill="#F5E6CC" />
      <path d="M56 86 C56 60 68 50 90 50 C112 50 124 60 124 86" fill="#3D2B1F" />
      <ellipse cx="90" cy="54" rx="34" ry="12" fill="#3D2B1F" />
      <path d="M58 80 C55 68 57 56 62 52 C58 58 56 70 58 80Z" fill="#2A1D14" />
      <path d="M122 80 C125 68 123 56 118 52 C122 58 124 70 122 80Z" fill="#2A1D14" />
      <ellipse cx="56" cy="98" rx="7" ry="9" fill="#F0D9BB" />
      <ellipse cx="124" cy="98" rx="7" ry="9" fill="#F0D9BB" />
      <ellipse cx="56" cy="98" rx="4" ry="5.5" fill="#E8C9A8" />
      <ellipse cx="124" cy="98" rx="4" ry="5.5" fill="#E8C9A8" />
      <ellipse cx="77" cy="94" rx="8" ry="9" fill="white" />
      <ellipse cx="103" cy="94" rx="8" ry="9" fill="white" />
      <ellipse cx="78" cy="95" rx="5" ry="6" fill="#3D2B1F" />
      <ellipse cx="104" cy="95" rx="5" ry="6" fill="#3D2B1F" />
      <circle cx="79.5" cy="93.5" r="1.8" fill="white" />
      <circle cx="105.5" cy="93.5" r="1.8" fill="white" />
      <path d="M69 88 L71 85" stroke="#3D2B1F" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M73 86 L74 83" stroke="#3D2B1F" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M77 86 L77 82" stroke="#3D2B1F" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M95 86 L95 82" stroke="#3D2B1F" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M99 86 L100 83" stroke="#3D2B1F" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M103 88 L105 85" stroke="#3D2B1F" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M68 83 Q77 79 84 82" stroke="#3D2B1F" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M96 82 Q103 79 112 83" stroke="#3D2B1F" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M88 102 Q90 107 92 102" stroke="#C4906A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M78 112 Q90 120 102 112" stroke="#C4906A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <ellipse cx="67" cy="108" rx="8" ry="5" fill="#F4A0A0" fillOpacity="0.35" />
      <ellipse cx="113" cy="108" rx="8" ry="5" fill="#F4A0A0" fillOpacity="0.35" />
      <circle cx="118" cy="56" r="13" fill="#C9A95C" />
      <text x="118" y="61" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white" fontFamily="system-ui">IQ</text>
    </svg>
  );
}

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

        <div className="flex items-center gap-3 z-10">
          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 22 22" fill="none">
              <path
                d="M11 3L13.5 8.5H19L14.5 12L16.5 17.5L11 14L5.5 17.5L7.5 12L3 8.5H8.5L11 3Z"
                fill="white"
                stroke="white"
                strokeWidth="0.5"
              />
              <circle cx="17" cy="5" r="2.5" fill="#C9A95C" />
            </svg>
          </div>
          <span className="text-[26px] font-bold text-white tracking-tight">
            Ashley<span className="text-gold">IQ</span>
          </span>
        </div>

        <div className="flex-1 flex flex-col justify-center z-10 max-w-lg">
          <div className="flex items-end gap-6 mb-8">
            <AshleyAvatar size={96} ring />
            <div>
              <h1 className="text-[32px] font-bold text-white leading-tight tracking-tight mb-3">
                Start your free 14-day trial.
              </h1>
              <p className="text-white/70 text-sm leading-relaxed">
                No credit card required. Full access to all features. Cancel anytime.
              </p>
            </div>
          </div>

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
            Ashley<span className="text-gold">IQ</span>
          </div>

          <h2 className="text-2xl font-bold text-black mb-1 tracking-tight">
            Create your account
          </h2>
          <p className="text-label-2 text-sm mb-6">14-day free trial · No credit card required</p>

          <SignUp
            afterSignUpUrl="/onboarding"
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
            By creating an account, you agree to AshleyIQ&apos;s{' '}
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