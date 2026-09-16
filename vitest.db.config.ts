import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/main/db/__tests__/**/*.{test,spec}.ts', 'src/main/hardware/__tests__/**/*.{test,spec}.ts', 'src/main/backup/__tests__/**/*.{test,spec}.ts'],
    exclude: ['node_modules'],
    setupFiles: [],
    testTimeout: 10000,
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src'),
      '@core': path.join(__dirname, 'src/core'),
      '@shared': path.join(__dirname, 'src/shared'),
      '@main': path.join(__dirname, 'src/main'),
    },
  },
});
