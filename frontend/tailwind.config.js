/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#161b22',
        'bg-elevated': '#1c232c',
        surface: '#1f2730',
        'surface-hover': '#252e38',
        border: '#2d3742',
        'border-strong': '#3a4654',
        text: '#e6edf3',
        'text-muted': '#8b949e',
        'text-faint': '#6e7681',
        accent: '#5eb8c4',
        'accent-strong': '#7dcdd9',
        secondary: '#b794f6',
        success: '#67c994',
        warning: '#e8b96b',
        danger: '#e07a7a',
        info: '#7ea7e8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
}
