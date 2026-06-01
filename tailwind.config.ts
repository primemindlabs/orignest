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
        // iOS system colors (Conduit design system)
        bg: '#F2F2F7',
        surface: '#FFFFFF',
        border: 'rgba(60,60,67,0.12)',
        fill: 'rgba(118,118,128,0.12)',
        label: '#000000',
        'label-1': '#000000',
        'label-2': '#6C6C70',
        'label-3': '#AEAEB2',
        blue: '#007AFF',
        green: '#34C759',
        orange: '#FF9500',
        red: '#FF3B30',
        // PrimeMind brand
        gold: '#C9A95C',
        navy: '#0F1D2E',
        // Conduit namespace aliases
        conduit: {
          navy: '#0F1D2E',
          gold: '#C9A95C',
          bg: '#F2F2F7',
          surface: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'system-ui',
          'sans-serif',
        ],
        mono: ['DM Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
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
        input: '0 0 0 3px rgba(0,122,255,0.15)',
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
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
        shimmer: 'shimmer 1.5s infinite linear',
      },
    },
  },
  plugins: [],
};

export default config;
