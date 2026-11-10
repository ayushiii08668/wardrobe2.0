/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  content: ["./src/**/*.{ts,tsx}", "./*.tsx"],
  theme: {
    extend: {
      colors: {
        canvas: "#F6F7FB",
        surface: "#FFFFFF",
        ink: "#151826",
        muted: "#6B7287",
        hairline: "#E6E8F0",
        primary: "#6C5CE7",
        laser: "#38D6FF",
        success: "#2BC48A",
        warning: "#F5A524"
      },
      boxShadow: {
        panel: "0 10px 40px rgba(21,24,38,.08)"
      },
      borderRadius: {
        stage: "28px"
      },
      fontFamily: {
        sans: [
          "Inter",
          "Geist",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
}
