import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  root: path.join(__dirname, 'src/renderer'),
  build: {
    outDir: path.join(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== 'production',
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src'),
      '@renderer': path.join(__dirname, 'src/renderer'),
      '@core': path.join(__dirname, 'src/core'),
      '@shared': path.join(__dirname, 'src/shared'),
      '@main': path.join(__dirname, 'src/main'),
    },
  },
  server: {
    port: 5173,
  },
});
