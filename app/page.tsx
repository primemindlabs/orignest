import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';

export default async function RootPage() {
  const { userId } = await auth();
  if (userId) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ── Nav ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M11 3L13.5 8.5H19L14.5 12L16.5 17.5L11 14L5.5 17.5L7.5 12L3 8.5H8.5L11 3Z" fill="white" stroke="white" strokeWidth="0.5"/>
                <circle cx="17" cy="5" r="2.5" fill="#2563EB"/>
              </svg>
            </div>
            <div>
              <span className="text-[16px] font-bold text-gray-900">Ashley</span>
              <span className="text-[16px] font-bold text-blue-600"> AI</span>
              <p className="text-[11px] text-gray-400 leading-none">Your AI Mortgage Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-500">Online</span>
            </div>
            <Link href="/sign-in" className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              Sign in
            </Link>
            <Link href="/sign-up" className="text-sm text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors font-medium">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-5xl font-black text-gray-900 leading-tight tracking-tight">
              Meet Ashley<span className="text-blue-600">.</span>
            </h1>
            <p className="text-2xl font-semibold text-gray-500 mt-2 leading-tight">
              The AI Mortgage Assistant<br />That Never Sleeps.
            </p>
            <p className="text-gray-500 mt-6 text-base leading-relaxed max-w-md">
              Ashley answers leads in seconds, follows up automatically, collects documents,
              updates your pipeline, and helps you close more loans.
            </p>
            <div className="flex items-center gap-4 mt-8">
              <Link
                href="/sign-up"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
              >
                Book a Demo
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
              <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 2L10 6L3 10V2Z" fill="currentColor"/>
                  </svg>
                </div>
                Watch how Ashley works
              </button>
            </div>
          </div>

          {/* Hero image + chat preview */}
          <div className="relative flex justify-center">
            <div className="relative">
              {/* Avatar circle */}
              <div className="w-72 h-72 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl">
                <div className="w-full h-full bg-gradient-to-br from-blue-200 to-indigo-300 flex items-center justify-center">
                  <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                    <circle cx="60" cy="45" r="28" fill="white" opacity="0.9"/>
                    <ellipse cx="60" cy="100" rx="50" ry="30" fill="white" opacity="0.7"/>
                    <circle cx="60" cy="42" r="22" fill="#1e3a5f"/>
                    <ellipse cx="52" cy="36" rx="8" ry="7" fill="#2563EB" opacity="0.5"/>
                    <circle cx="52" cy="44" r="7" fill="white"/>
                    <circle cx="68" cy="44" r="7" fill="white"/>
                    <circle cx="53" cy="43" r="3.5" fill="#1e3a5f"/>
                    <circle cx="69" cy="43" r="3.5" fill="#1e3a5f"/>
                    <circle cx="54" cy="41" r="1.5" fill="white"/>
                    <circle cx="70" cy="41" r="1.5" fill="white"/>
                    <path d="M52 55 Q60 62 68 55" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
              {/* Blue sparkle */}
              <div className="absolute top-4 right-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#2563EB">
                  <path d="M12 2L13.5 9.5L21 11L13.5 12.5L12 20L10.5 12.5L3 11L10.5 9.5L12 2Z"/>
                </svg>
              </div>
              {/* Chat preview card */}
              <div className="absolute -bottom-4 -right-8 bg-white rounded-2xl shadow-xl p-4 w-56 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">A</span>
                  </div>
                  <span className="text-[12px] font-semibold text-gray-900">Ashley</span>
                  <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">AI</span>
                </div>
                <p className="text-[12px] text-gray-700 leading-relaxed">
                  Good morning! 👋<br/>
                  Here&apos;s what I accomplished while you were away.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Dashboard preview ── */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Mini topbar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-[15px] font-semibold text-gray-900">Ashley Command Center</h3>
                <p className="text-[12px] text-gray-400">Here&apos;s what I accomplished while you were away.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-[12px] text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="#6B7280" strokeWidth="1.2"/>
                    <path d="M4 1V3M10 1V3M1 5H13" stroke="#6B7280" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  Today
                </div>
              </div>
            </div>
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-0 divide-x divide-gray-100">
              {[
                { icon: '💬', value: '47', label: 'Conversations Started', trend: '+18%' },
                { icon: '📅', value: '12', label: 'Appointments Booked', trend: '+33%' },
                { icon: '📋', value: '4', label: 'Applications Started', trend: '+14%' },
                { icon: '👥', value: '14', label: 'Leads Followed Up', trend: '+27%' },
              ].map((stat) => (
                <div key={stat.label} className="p-5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-lg mb-3">{stat.icon}</div>
                  <div className="text-[28px] font-black text-gray-900">{stat.value}</div>
                  <div className="text-[12px] text-gray-500 mt-0.5">{stat.label}</div>
                  <div className="text-[11px] text-green-600 font-semibold mt-1">↑ {stat.trend} vs yesterday</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Ashley works 24/7 banner ── */}
      <section className="py-12 max-w-6xl mx-auto px-6">
        <div className="bg-blue-50 rounded-2xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-xl">✨</div>
            <div>
              <h3 className="font-bold text-gray-900">Ashley works 24/7</h3>
              <p className="text-sm text-gray-500">Never misses a lead. Never forgets to follow up.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-600">Let Ashley grow your mortgage business.</p>
            <Link href="/sign-up" className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              Learn More
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7H11M11 7L8 4M11 7L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Feature cards ── */}
      <section className="pb-20 max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-5 gap-4">
          {[
            { icon: '⚡', title: 'Lead Response', desc: 'Responds in seconds so you never miss another opportunity.', color: 'bg-yellow-50' },
            { icon: '📅', title: 'Appointment Booking', desc: 'Books appointments directly to your calendar.', color: 'bg-green-50' },
            { icon: '📋', title: 'Document Collection', desc: 'Requests, collects, and organizes borrower documents.', color: 'bg-orange-50' },
            { icon: '🔍', title: 'Pipeline Management', desc: 'Keeps every loan moving forward and nothing falls through.', color: 'bg-purple-50' },
            { icon: '✨', title: 'AI Mortgage Assistant', desc: 'Available 24/7 to you and your borrowers.', color: 'bg-blue-50' },
          ].map((f) => (
            <div key={f.title} className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-shadow">
              <div className={`w-10 h-10 ${f.color} rounded-xl flex items-center justify-center text-xl mb-4`}>{f.icon}</div>
              <h4 className="font-semibold text-gray-900 text-[14px] leading-tight mb-2">{f.title}</h4>
              <p className="text-[12px] text-gray-500 leading-relaxed">{f.desc}</p>
              <div className="mt-4">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 9H14M14 9L10 5M14 9L10 13" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5" stroke="#2563EB" strokeWidth="1.5"/>
                <circle cx="7" cy="7" r="2" fill="#2563EB"/>
                <circle cx="13" cy="13" r="2" fill="#2563EB"/>
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-900">Ready to close more loans?</p>
              <p className="text-[11px] text-gray-400">Book a personalized demo with our team.</p>
            </div>
          </div>
          <Link
            href="/sign-up"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            Book a Demo
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7H11M11 7L8 4M11 7L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      </footer>
    </div>
  );
}
