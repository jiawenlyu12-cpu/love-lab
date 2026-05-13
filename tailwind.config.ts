import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rose: {
          50: "#fff5f1",
          100: "#ffe4d9",
          200: "#fbc7b3",
          300: "#f6a487",
          400: "#ee7e5e",
          500: "#d75c46",
          gold: "#e8b4a0",
        },
        midnight: {
          900: "#0b1230",
          800: "#11193f",
          700: "#1a2350",
          600: "#252e64",
        },
      },
      fontFamily: {
        serif: ['"Source Han Serif SC"', '"Noto Serif SC"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"PingFang SC"', '"Microsoft YaHei"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        heartPulse: {
          "0%,100%": { transform: "scale(1)", opacity: "0.9" },
          "50%": { transform: "scale(1.08)", opacity: "1" },
        },
        radarSweep: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        heartPulse: "heartPulse 1.4s ease-in-out infinite",
        radarSweep: "radarSweep 1.5s linear infinite",
      },
      spacing: {
        "safe-b": "env(safe-area-inset-bottom)",
        "safe-t": "env(safe-area-inset-top)",
      },
    },
  },
  plugins: [],
};
export default config;
