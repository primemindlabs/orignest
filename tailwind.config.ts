import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── PrimeMind Brand System ─────────────────────────────────────────
        // Primary interactive — use these for CTAs, links, active states
        navy: {
          DEFAULT: '#0F1D2E',
          50:  '#E8ECF0',
          100: '#C5CDD7',
          200: '#9EAEBB',
          300: '#778F9F',
          400: '#4F6F84',
          500: '#2B4F69',
          600: '#1A3550',
          700: '#0F1D2E', // DEFAULT
          800: '#091422',
          900: '#040B14',
        },
        gold: {
          DEFAULT: '#C9A95C',
          50:  '#FDF8EE',
          100: '#F7EDCF',
          200: '#EEDFA0',
          300: '#E4CE71',
          400: '#D9BC47',
          500: '#C9A95C', // DEFAULT
          600: '#A88840',
          700: '#876830',
          800: '#654D22',
          900: '#433215',
        },
        // Surfaces — Apple: cool neutral page bg, pure-white cards
        bg: '#F5F5F7',          // Apple system gray — page bg
        surface: '#FFFFFF',     // pure white — cards
        ivory: '#F5F5F7',       // alias for bg
        // Text hierarchy — Apple near-black + system grays
        label: '#1D1D1F',
        'label-1': '#1D1D1F',   // primary — Apple near-black
        'label-2': '#6E6E73',   // secondary — Apple system gray
        'label-3': '#86868B',   // tertiary — Apple system gray
        slate: '#6E6E73',       // secondary text
        // Borders & fills — neutral gray hairlines (Apple)
        border: 'rgba(0,0,0,0.10)',
        fill: 'rgba(0,0,0,0.05)',
        // Semantic states — NOT Apple system colors
        green: '#2D7A4F',       // success
        orange: '#B07D28',      // warning (warm amber, gold-adjacent)
        red: '#C4724A',         // Terra Signal — error/danger
        // Legacy alias — maps old Apple blue refs to Navy-tinted info
        blue: '#3A5C7A',
        // AshleyIQ / Conduit namespace (backward compat)
        conduit: {
          navy:    '#0F1D2E',
          gold:    '#C9A95C',
          bg:      '#F5F5F7',
          surface: '#FFFFFF',
          slate:   '#6E6E73',
          ivory:   '#F5F5F7',
          danger:  '#C4724A',
        },
        // Sidebar aliases (no hyphens for Tailwind class compatibility)
        label2: '#6E6E73',
        label3: '#86868B',
      },
      fontFamily: {
        // Display — headings. Apple feel: SF Pro Display, NO serif.
        display: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
        // UI — all labels, body, inputs. SF Pro Text first (Apple system font).
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
        // Data — numbers render in SF with tabular-nums (Apple HIG), not a true
        // monospace. (`.font-mono` gets tabular-nums applied in globals.css.)
        mono: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        '2xs': ['11px', '14px'],
        xs: ['12px', '16px'],
        sm: ['13px', '18px'],
        base: ['14px', '20px'],
        md: ['15px', '22px'],
        lg: ['17px', '24px'],
        xl: ['20px', '28px'],
        '2xl': ['24px', '32px'],
        '3xl': ['28px', '36px'],
      },
      borderRadius: {
        card: '10px',
        btn: '12px',
        sheet: '14px',
        full: '9999px',
      },
      boxShadow: {
        card: '0 1px 0 rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06)',
        elevated: '0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
        sheet: '0 20px 60px rgba(0,0,0,0.20)',
        menu: '0 8px 32px rgba(0,0,0,0.16)',
        input: '0 0 0 3px rgba(201,169,92,0.25), 0 0 0 1px rgba(201,169,92,0.6)', // Gold focus ring — never Apple blue
      },
      backdropBlur: {
        sidebar: '28px',
        topbar: '20px',
        sheet: '40px',
      },
      spacing: {
        'sidebar': '220px',
        'topbar': '56px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        'bounce-dots': {
          '0%, 80%, 100%': { transform: 'translateY(0)' },
          '40%': { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
        shimmer: 'shimmer 1.5s infinite linear',
        'pulse-ring': 'pulse-ring 1.2s cubic-bezier(0.215,0.61,0.355,1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
