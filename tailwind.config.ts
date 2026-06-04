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
        // B033 Phase 1 — design-system semantic tokens. AUTHORITATIVE definition
        // lives in app/globals.css `@theme static` (Tailwind v4 native); this
        // mirror keeps the config self-documenting. See DESIGN-SYSTEM-DRAFT.md §4.1.
        surface: { base: '#09090b', raised: '#18181b', overlay: '#27272a' },
        border: { default: '#27272a', strong: '#3f3f46' },
        text: { primary: '#fafafa', secondary: '#d4d4d8', tertiary: '#a1a1aa', muted: '#71717a' },
        state: { flash: '#fcd34d', send: '#34d399', attempt: '#a1a1aa', project: '#ff6b35' },
        feedback: { success: '#10b981', warn: '#f59e0b', error: '#ef4444', info: '#3b82f6' },
        category: {
          jug: '#16a34a', 'good-crimp': '#2563eb', crimp: '#0d9488',
          sloper: '#9333ea', undercling: '#dc2626', pinch: '#eab308',
        },
      },
      borderRadius: {
        pill: '9999px',
        card: '12px',
        control: '8px',
      },
      boxShadow: {
        'elev-raised': '0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.5)',
        'elev-overlay': '0 20px 25px -5px rgb(0 0 0 / 0.6), 0 8px 10px -6px rgb(0 0 0 / 0.6)',
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
