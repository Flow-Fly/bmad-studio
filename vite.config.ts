import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
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
