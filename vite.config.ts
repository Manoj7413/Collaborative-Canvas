import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "client",
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "client/index.html"),
      },
    },
  },
  server: {
    port: 3000,
  },
});
