/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Dark operations-dashboard palette.
        panel: '#141b24',
        'panel-2': '#1b2430',
        'panel-3': '#222d3b',
        line: '#2d3a4a',
        ink: '#e6ecf3',
        muted: '#93a1b3',
        signal: {
          red: '#ff4d4d',
          yellow: '#ffd23f',
          green: '#3ddc84',
        },
        accent: '#5bb8ff',
        danger: '#ff5c8a',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
