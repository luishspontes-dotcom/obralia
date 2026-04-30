import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Obralia chrome
        dark: "#141413",
        cream: "#FAF9F5",
        paper: "#FFFFFF",
        soft: "#EFEDE3",
        border: "#D9D6CA",
        muted: "#6F6E68",
        // Accent
        accent: { DEFAULT: "#D97757", hover: "#C66946", soft: "#FCE9DF" },
        // Status
        status: {
          waiting: "#D97757",
          progress: "#6A9BCC",
          late: "#C2410C",
          paused: "#B0AEA5",
          done: "#788C5D",
        },
        // Tenant default (Meu Viver)
        tenant: { DEFAULT: "#08789B", hover: "#066785", soft: "#E8F2F6" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-lora)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "Menlo", "monospace"],
      },
      borderRadius: { lg: "12px", md: "10px", sm: "8px", xs: "6px" },
    },
  },
  plugins: [],
};

export default config;
