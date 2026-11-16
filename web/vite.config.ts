import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const raiz = import.meta.dirname;

export default defineConfig({
  root: raiz,
  // Caminhos relativos: o mesmo build serve no computador e no GitHub Pages (/hub-elev-muniz/).
  base: "./",
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.1.0"),
  },
  resolve: {
    alias: { "@": path.resolve(raiz, "src") },
  },
  server: {
    port: 5180,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:3180" },
  },
  build: {
    outDir: path.resolve(raiz, "dist"),
    emptyOutDir: true,
    // App local: um arquivo só é o esperado.
    chunkSizeWarningLimit: 1500,
  },
});
