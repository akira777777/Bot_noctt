const path = require("path");
const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");

module.exports = defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  server: {
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});
