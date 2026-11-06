import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 45000,
    hookTimeout: 45000,
  },
});
