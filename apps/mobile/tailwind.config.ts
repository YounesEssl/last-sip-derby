import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        derby: {
          bg: '#0A0A0F',
          gold: '#C9A84C',
          red: '#E63946',
          green: '#2D6A4F',
          dark: '#141420',
          muted: '#1E1E2E',
        },
      },
      fontFamily: {
        display: ['Bebas Neue', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
