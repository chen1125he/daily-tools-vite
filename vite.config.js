import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        // target: "http://192.168.31.13:3000",
        target: "http://8.135.39.60:80",
        changeOrigin: true
      }
    }
  }
});
