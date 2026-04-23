/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#0f172a", // slate-900
        secondary: "#64748b", // slate-500
        accent: "#3b82f6", // blue-500
      }
    },
  },
  plugins: [],
}
