import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // B032 — override the `orange` ramp to the canonical brand hue
        // (#ff6b35) instead of Tailwind's default #f97316, so existing
        // orange-* utilities resolve to the brand. The authoritative
        // definition lives in globals.css @theme (Tailwind v4 native); this
        // mirror keeps the config self-documenting. The former dead
        // `kilter-orange` token is removed — brand orange is now the `orange`
        // ramp (utilities) + `--brand-orange` :root var (inline styles).
        orange: {
          100: '#ffe4d6',
          200: '#ffc9af',
          300: '#ffab85',
          400: '#ff8a5c',
          500: '#ff6b35',
          600: '#e85620',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
