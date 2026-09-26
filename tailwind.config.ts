import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dae6ff",
          500: "#3b6cf6",
          600: "#2a55e0",
          700: "#2243b5",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
