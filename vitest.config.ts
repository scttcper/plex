import { existsSync } from 'node:fs';

import { defineConfig } from 'vitest/config';

// Local runs read Plex credentials from .env, CI sets them in the environment.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  test: {
    fileParallelism: false,
    // Agent worktrees live under .claude/worktrees and carry their own copy of the tests.
    exclude: ['./node_modules/**', './dist/**', './.claude/**'],
  },
});
