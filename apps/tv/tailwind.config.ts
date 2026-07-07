import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-yeseva)', 'serif'],
        headline: ['var(--font-oswald)', 'sans-serif'],
        hand: ['var(--font-caveat)', 'cursive'],
        mono: ['var(--font-courier)', 'monospace'],
        terminal: ['var(--font-vt323)', 'monospace'],
        body: ['var(--font-courier)', 'monospace'],
      },
      colors: {
        derby: {
          night: '#0E0A06', // deepest background
          ink: '#1A120A', // panels
          coal: '#241A0F', // raised panels
          cream: '#F4E8CE', // paper / primary text
          parch: '#E4D2AC', // aged paper
          gold: '#D9A93F', // brass & trim
          brass: '#9C7427', // darker gold
          green: '#1E5C43', // turf
          felt: '#0F3527', // deep felt green
          red: '#C63C2E', // racing red
          dirt: '#A96A3F', // track
          smoke: '#9C8A69', // muted text
        },
      },
      boxShadow: {
        deep: '0 20px 60px -12px rgba(0,0,0,0.7)',
        'gold-glow': '0 0 24px rgba(217,169,63,0.35)',
        'inset-panel': 'inset 0 2px 12px rgba(0,0,0,0.5)',
      },
      animation: {
        'flicker': 'flicker 4s ease-in-out infinite',
        'bulb': 'bulb 1.2s ease-in-out infinite',
        'rise': 'rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'shine': 'shine 3s ease-in-out infinite',
        'ticker': 'ticker 24s linear infinite',
        'stamp': 'stamp 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
      keyframes: {
        flicker: {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '93%': { opacity: '0.6' },
          '94%': { opacity: '1' },
          '97%': { opacity: '0.8' },
          '98%': { opacity: '1' },
        },
        bulb: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        rise: {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shine: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        stamp: {
          '0%': { transform: 'scale(2.2) rotate(-14deg)', opacity: '0' },
          '100%': { transform: 'scale(1) rotate(-8deg)', opacity: '1' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.65' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
