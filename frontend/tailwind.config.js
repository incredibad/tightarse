/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fef8ec",
          100: "#fcf0d5",
          300: "#f7da97",
          400: "#f1c45b",
          500: "#edb431",
          600: "#d39b17",
          700: "#a87c15",
          900: "#59420d",
        },
      },
    },
  },
  plugins: [],
};
