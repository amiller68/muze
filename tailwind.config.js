/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0a0a0f",
          secondary: "#12121a",
          tertiary: "#1a1a2e",
        },
        border: {
          DEFAULT: "#2a2a3e",
        },
        accent: {
          primary: "#6366f1",
          danger: "#ef4444",
        },
        waveform: "#818cf8",
      },
    },
  },
  plugins: [],
};
