import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: Object.fromEntries(
      ["/api", "/docs", "/openapi.json"].map((path) => [
        path,
        {
          target: process.env.API_INTERNAL_URL || "http://localhost:3001",
          changeOrigin: true,
        },
      ]),
    ),
  },
});
