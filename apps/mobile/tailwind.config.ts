import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pmu: {
          bg: '#1c1613',
          board: '#39FF14',
          dark: '#0f0a07',
          wood: '#4a3018',
          paper: '#f4eacc',
          alert: '#E83B3B',
          amber: '#FFB000',
        },
      },
      fontFamily: {
        display: ['var(--font-rye)', 'serif'],
        terminal: ['var(--font-vt323)', 'monospace'],
        body: ['var(--font-courier)', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
