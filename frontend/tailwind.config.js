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
        // Epistemic Status Colors
        epistemic: {
          observed: '#10b981',       // emerald-500
          inferred: '#f59e0b',       // amber-500
          unverified: '#f43f5e',     // rose-500
        },
        // Entity Node Colors
        entity: {
          user: '#a855f7',           // purple-500
          device: '#3b82f6',         // blue-500
          service: '#06b6d4',        // cyan-500
          ip: '#f97316',             // orange-500
          event: '#eab308',          // yellow-500
          external: '#ef4444',       // red-500
        },
        // Cyber investigation palette
        cyber: {
          950: '#070b12',
          900: '#0b1320',
          850: '#101a2c',
          800: '#172338',
          700: '#233550',
          600: '#344b6e',
          500: '#4a6792',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
