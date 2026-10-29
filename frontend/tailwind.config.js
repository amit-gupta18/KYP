/** @type {import('tailwindcss').Config} */
/**
 * Design system for Policy QA.
 * Light blue product theme aligned with Atlassian tokens:
 * brand blue #0C66E4, ink #172B4D, canvas #F7F8F9, line #DCDFE4.
 * Buttons, lozenges, and elevation all read from these tokens.
 */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#E9F2FF",
          100: "#CCE0FF",
          200: "#85B8FF",
          300: "#579DFF",
          400: "#388BFF",
          500: "#1D7AFC",
          600: "#0C66E4",
          700: "#0055CC",
          800: "#09326C",
          900: "#1C2B41",
        },
        ink: {
          DEFAULT: "#172B4D",
          subtle: "#44546F",
          subtlest: "#626F86",
        },
        canvas: "#F7F8F9",
        line: "#DCDFE4",
        sunken: "#F1F2F4",
        success: {
          bg: "#DCFFF1",
          text: "#164B35",
          bold: "#1F845A",
        },
        danger: {
          bg: "#FFECEB",
          text: "#AE2E24",
          bold: "#C9372C",
        },
        warning: {
          bg: "#FFF7D6",
          text: "#7F5F01",
          bold: "#B38600",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        xs: ["11px", "16px"],
        sm: ["12px", "16px"],
        base: ["14px", "20px"],
        lg: ["16px", "24px"],
        answer: ["15px", "24px"],
        xl: ["20px", "28px"],
        "2xl": ["24px", "32px"],
      },
      boxShadow: {
        raised: "0 1px 1px rgba(9, 30, 66, 0.12), 0 0 1px rgba(9, 30, 66, 0.16)",
        overlay: "0 8px 16px rgba(9, 30, 66, 0.15), 0 0 1px rgba(9, 30, 66, 0.31)",
      },
      borderRadius: {
        sm: "3px",
        DEFAULT: "4px",
        md: "8px",
      },
      keyframes: {
        slide: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(220%)" },
        },
      },
      animation: {
        slide: "slide 1.15s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
