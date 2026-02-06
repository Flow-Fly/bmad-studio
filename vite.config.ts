import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3007,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3008',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3008',
        ws: true,
      },
    },
  },
  build: {
    target: 'esnext',
  },
  // Pre-bundle Tauri plugins for dynamic imports to work in WebView
  optimizeDeps: {
    include: [
      '@tauri-apps/plugin-dialog',
      'tauri-plugin-keyring-api',
    ],
  },
});
