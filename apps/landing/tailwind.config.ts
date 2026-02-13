import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        surface: "#050816",
        panel: "#0b1220",
        line: "#1e293b",
        accent: "#00d9a3"
      }
    }
  },
  plugins: []
};

export default config;
