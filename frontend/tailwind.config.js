/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Epistemic & Security Status Colors
        epistemic: {
          observed: '#10b981',       // emerald-500
          inferred: '#3b82f6',       // blue-500
          unverified: '#f43f5e',     // rose-500
          suspicious: '#ef4444',     // red-500
        },
        // Cyber investigation palette (deep dark navy theme matching the design)
        cyber: {
          950: '#080c15',            // base dark background
          900: '#0c1220',            // sidebar / topbar
          850: '#11192c',            // cards background
          800: '#18233c',            // card borders / dividers
          750: '#1f2d4d',            // hover states
          700: '#2a3c63',            // borders on focus
          600: '#3d5485',            // subtle text
          500: '#5c78b0',            // secondary text
          blue: '#2563eb',
          cyan: '#06b6d4',
          accent: '#3b82f6',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow-blue': '0 0 20px -3px rgba(59, 130, 246, 0.25)',
        'glow-red': '0 0 20px -3px rgba(239, 68, 68, 0.35)',
        'glow-cyan': '0 0 20px -3px rgba(6, 182, 212, 0.25)',
      }
    },
  },
  plugins: [],
}
