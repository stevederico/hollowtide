import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: {
    port: 5227,
    strictPort: true,
    host: '127.0.0.1'
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
