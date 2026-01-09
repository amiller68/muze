/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // iOS-inspired neutral gray palette
        surface: {
          primary: "#000000",
          card: "#1c1c1e",
          elevated: "#2c2c2e",
        },
        // Neutral grays (no blue tint)
        neutral: {
          50: "#f5f5f7",
          100: "#e5e5e7",
          200: "#d1d1d6",
          300: "#aeaeb2",
          400: "#8e8e93",
          500: "#636366",
          600: "#48484a",
          700: "#3a3a3c",
          800: "#2c2c2e",
          900: "#1c1c1e",
        },
        // Single accent color (iOS blue)
        accent: "#0a84ff",
        // Destructive action (iOS red)
        destructive: "#ff453a",
        // Trim/selection (iOS Voice Memos gold)
        selection: "#c9a227",
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.4)',
        'elevated': '0 4px 16px rgba(0, 0, 0, 0.5)',
        'button': '0 1px 4px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
};
