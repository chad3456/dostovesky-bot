import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Antique bronze / aged gold — the app's vintage accent.
        brand: {
          50: "#f8f1e2",
          100: "#efdfc2",
          200: "#e0c693",
          300: "#cfaa63",
          400: "#bf9344",
          500: "#a87c3a",
          600: "#8a6330",
          700: "#6d4d27",
          800: "#573e21",
          900: "#48341d",
        },
        parchment: {
          DEFAULT: "#efe4cb",
          light: "#faf3e0",
          dark: "#e7d8b5",
          border: "#c9b28a",
        },
        ink: {
          DEFAULT: "#3b2f23",
          soft: "#6b5b45",
        },
        sepia: {
          bg: "#f4ecd8",
          text: "#5b4636",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
