import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: true,

    hmr: {
      protocol: "wss",
      host: ".replit.dev",
      clientPort: 443,
    },

    watch: {
      usePolling: true,
      ignored: ["**/node_modules/**"],
    },

    allowedHosts: [".replit.dev", ".picard.replit.dev"],
  },
});
