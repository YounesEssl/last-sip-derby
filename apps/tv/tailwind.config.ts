import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        rye: ['var(--font-rye)', 'serif'],
        bebas: ['var(--font-bebas)', 'sans-serif'],
        mono: ['var(--font-dm-mono)', 'monospace'],
        terminal: ['var(--font-vt323)', 'monospace'],
        body: ['var(--font-courier)', 'monospace'],
      },
      colors: {
        pmu: {
          bg: '#1c1613',
          dark: '#0f0a07',
          wood: '#4a3018',
          paper: '#f4eacc',
          alert: '#E83B3B',
          amber: '#FFB000',
        },
        western: {
          gold: '#D4A843',
          dark: 'rgba(30, 15, 5, 0.85)',
        },
        prairie: {
          accent: '#D4A843',
          gold: '#FFD700',
          dark: 'rgba(30, 15, 5, 0.85)',
        },
        FFD700: '#FFD700',
      },
      animation: {
        'marquee': 'marquee 12s linear infinite',
        'victory-pop': 'victory-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'leader-bob': 'leader-bob 1.5s ease-in-out infinite',
        'photo-flash': 'photo-flash 2.5s ease-out forwards',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(100vw)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        'victory-pop': {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'leader-bob': {
          '0%, 100%': { transform: 'translateX(-50%) translateY(0)' },
          '50%': { transform: 'translateX(-50%) translateY(-3px)' },
        },
        'photo-flash': {
          '0%': { opacity: '1' },
          '15%': { opacity: '0.85' },
          '100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
