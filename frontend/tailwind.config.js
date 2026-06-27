/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic tokens backed by CSS variables (support Tailwind alpha, e.g. text-fg/55)
        bg: "rgb(var(--bg) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        field: "rgb(var(--field) / <alpha-value>)",
        // Module accents (theme-independent)
        curie: "#6ea8ff",
        medsync: "#7c6cff",
        rxshield: "#ff7eb6",
        nutrisim: "#37d6b3",
        pathos: "#ffb86b",
        neurograph: "#b388ff",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      borderRadius: { xl: "16px", "2xl": "20px", "3xl": "24px" },
      boxShadow: {
        glow: "0 0 40px -8px rgba(124,108,255,0.45)",
        card: "0 8px 40px -12px rgba(0,0,0,0.6)",
      },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        pulseRing: { "0%": { boxShadow: "0 0 0 0 rgba(124,108,255,0.5)" }, "70%": { boxShadow: "0 0 0 12px rgba(124,108,255,0)" }, "100%": { boxShadow: "0 0 0 0 rgba(124,108,255,0)" } },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        pulseRing: "pulseRing 2.4s infinite",
      },
    },
  },
  plugins: [],
};
