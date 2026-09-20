import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
    include: ['src/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
  },
});
