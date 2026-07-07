import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-yeseva)', 'serif'],
        headline: ['var(--font-oswald)', 'sans-serif'],
        hand: ['var(--font-caveat)', 'cursive'],
        terminal: ['var(--font-vt323)', 'monospace'],
        body: ['var(--font-courier)', 'monospace'],
      },
      colors: {
        derby: {
          night: '#0E0A06',
          ink: '#1A120A',
          coal: '#241A0F',
          cream: '#F4E8CE',
          parch: '#E4D2AC',
          gold: '#D9A943',
          brass: '#9C7427',
          green: '#1E5C43',
          felt: '#0F3527',
          red: '#C63C2E',
          dirt: '#A96A3F',
          smoke: '#9C8A69',
        },
      },
      animation: {
        rise: 'rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        stamp: 'stamp 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        shake: 'shake 0.6s ease-in-out infinite',
      },
      keyframes: {
        rise: {
          '0%': { transform: 'translateY(18px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        stamp: {
          '0%': { transform: 'scale(2) rotate(-14deg)', opacity: '0' },
          '100%': { transform: 'scale(1) rotate(-6deg)', opacity: '1' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.65' },
          '50%': { opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-4px) rotate(-1deg)' },
          '40%': { transform: 'translateX(4px) rotate(1deg)' },
          '60%': { transform: 'translateX(-3px)' },
          '80%': { transform: 'translateX(3px)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
