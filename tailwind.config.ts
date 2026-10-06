import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        base: {
          bg: "#0B0B0E",
          surface: "#151519",
          surface2: "#1C1C22",
          border: "#2A2A32",
        },
        brand: {
          pink: "#E2185C",
          pinkDark: "#B0124A",
          gold: "#F2B705",
        },
        money: {
          in: "#22C55E",
          out: "#FF6B4A",
          neutral: "#9A9AA5",
        },
        ink: {
          primary: "#F5F5F7",
          muted: "#9A9AA5",
          faint: "#5C5C66",
        },
      },
      fontFamily: {
        display: ["var(--font-sora)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        card: "20px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 8px 30px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
