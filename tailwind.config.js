/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./templates/**/*.html",
    "./src/**/*.py",
    "./styles/*.css",
  ],
  important: true,
  theme: {
    extend: {
      colors: {
        'pink': '#ffd5d5',
        'dark-pink': '#ff5555',
        'grey': '#d1d5db',
        // Dark theme colors
        'surface': '#121212',
        'surface-light': '#1e1e1e',
        'surface-lighter': '#2a2a2a',
        'primary': '#3b82f6',
        'primary-dark': '#2563eb',
        'text': {
          DEFAULT: '#f3f4f6', // Light text for dark mode
          'muted': '#9ca3af',
          'dark': '#111827', // Dark text for light elements
        },
        'card': {
          DEFAULT: '#1e1e1e',
          'primary': '#3b82f6',
          'secondary': '#2a2a2a',
          'destructive': '#ef4444',
        },
      },
      fontFamily: {
        'sans': ['"Roboto"', 'system-ui', 'sans-serif'],
      },
      borderWidth: {
        '2': '2px',
      },
    },
  },
  plugins: [],
}