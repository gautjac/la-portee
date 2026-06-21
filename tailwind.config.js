/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // La Portée — engraving studio / manuscript paper.
        // Warm rag paper, sepia rules, iron-gall ink, bordeaux + gold-leaf accents.
        paper: {
          DEFAULT: "#f6efe1", // rag paper
          deep: "#efe6d3", // sheet behind a card
          card: "#fbf6ea", // a fresh sheet
          edge: "#e4d8be", // page-edge / hairline
        },
        ink: {
          DEFAULT: "#1c1a17", // iron-gall ink (near-black, warm)
          soft: "#3a352c",
          faint: "#6c6353",
          ghost: "#9a9180",
        },
        rule: "#b7a98a", // staff lines (sepia)
        bordeaux: {
          DEFAULT: "#7a2230", // the headline accent
          soft: "#9a3b46",
        },
        gold: {
          DEFAULT: "#b8893a", // gold-leaf highlight
          bright: "#d9a94e",
        },
        sage: "#46715a", // correct / phosphor-green of print
        terracotta: "#bb5a3c", // wrong / warm error
        indigo: "#384c74", // cool secondary accent (key sigs)
      },
      fontFamily: {
        // Cormorant for big engraved display, Fraunces for headings/body serif,
        // Inter for clean UI sans, JetBrains Mono for counts & note labels.
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
        serif: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        sheet: "0 22px 50px -28px rgba(28,26,23,0.45), 0 2px 6px -2px rgba(28,26,23,0.12)",
        "sheet-sm": "0 10px 26px -16px rgba(28,26,23,0.4)",
        lift: "0 1px 0 rgba(255,255,255,0.55) inset, 0 14px 34px -20px rgba(28,26,23,0.5)",
      },
      keyframes: {
        riseIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { opacity: "0", transform: "scale(0.94)" },
          "60%": { transform: "scale(1.02)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        quill: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        riseIn: "riseIn 0.42s cubic-bezier(0.22,0.7,0.2,1) both",
        pop: "pop 0.34s cubic-bezier(0.22,0.7,0.2,1) both",
        quill: "quill 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
