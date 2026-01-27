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
});
