import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['container/tests/**/*.test.ts', 'serverless/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'container/src'),
      '@serverless': path.resolve(__dirname, 'serverless/src'),
      '@serverless/web': path.resolve(__dirname, 'serverless/web/src'),
    },
  },
});
