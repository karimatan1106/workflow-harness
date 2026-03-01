import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 300_000, // TMO-1 (S3-11): 300s timeout for long-running tests
  },
});
