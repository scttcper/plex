import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    exclude: ['./node_modules/**', './dist/**'],
  },
});
