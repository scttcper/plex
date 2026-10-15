import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    // Agent worktrees live under .claude/worktrees and carry their own copy of the tests.
    exclude: ['./node_modules/**', './dist/**', './.claude/**'],
  },
});
