/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#0058be",
        secondary: "#6b38d4",
        tertiary: "#006577",
        "primary-container": "#2170e4",
        "on-primary-container": "#fefcff",
        "surface": "#f9f9ff",
        "on-surface": "#191b23",
        "on-surface-variant": "#424754",
        "outline-variant": "#c2c6d6",
        "surface-container-low": "#f2f3fd",
        "surface-container": "#ecedf7",
        "surface-container-high": "#e6e7f2",
        "surface-container-highest": "#e1e2ec",
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif']
      }
    },
  },
  plugins: [],
}
