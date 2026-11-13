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
        // Technical Cyber Palette
        node: {
          user: '#3b82f6',          // User (Blue)
          device: '#8b5cf6',        // Device (Purple)
          service: '#10b981',       // Service (Teal/Emerald)
          suspicious: '#ef4444',    // Suspicious (Red)
        },
        cyber: {
          950: '#080b11',           // Base deep void
          900: '#0c121e',           // Sidebar / Topbar
          850: '#0e1422',           // Card container
          800: '#18233a',           // Card borders
          750: '#1f2d4a',           // Subtle borders / dividers
          700: '#28395d',           // Hover & active
          600: '#425a8c',           // Muted text
          500: '#647ea8',           // Secondary text
          blue: '#3b82f6',
          purple: '#8b5cf6',
          emerald: '#10b981',
          red: '#ef4444',
        }
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Fira Code', 'monospace'],
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
