// vitest.config.js — test settings: `describe/it/expect` available without imports, and one
// in-memory MongoDB shared by all test files.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: ['./tests/helpers/globalSetup.js'],
  },
});
