import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#07111f",
        midnight: "#172033",
        ocean: "#1d4ed8",
        aqua: "#f97316",
        sun: "#fb923c",
        coral: "#ff6b5f",
        cloud: "#fff7ed",
        orangebrand: "#f97316",
        orangeburnt: "#ea580c",
        cream: "#fffaf4"
      },
      boxShadow: {
        glow: "0 18px 45px rgba(249, 115, 22, 0.22)",
        card: "0 18px 55px rgba(15, 23, 42, 0.10)"
      },
      backgroundImage: {
        "hero-radial": "radial-gradient(circle at 8% 10%, rgba(251,146,60,.22), transparent 34%), radial-gradient(circle at 88% 18%, rgba(249,115,22,.18), transparent 30%), linear-gradient(180deg, #fff7ed 0%, #ffffff 58%, #fffaf4 100%)"
      }
    }
  },
  plugins: []
};

export default config;
