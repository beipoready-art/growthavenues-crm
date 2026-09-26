import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        // Be IPO Ready: deep navy primary with a warm gold accent (from beipoready.com).
        brand: {
          50: "#eef5fa",
          100: "#d5e5f0",
          500: "#1f628f",
          600: "#0f4c75",
          700: "#0a3a5a",
        },
        gold: {
          50: "#fdf7ea",
          100: "#faeac5",
          400: "#f0b54f",
          500: "#e3a33a",
          600: "#c4862a",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
