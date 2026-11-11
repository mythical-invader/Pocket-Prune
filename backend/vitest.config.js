// vitest.config.js — test settings: `describe/it/expect` available without imports.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true, environment: 'node' },
});
