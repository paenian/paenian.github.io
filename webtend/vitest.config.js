import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Allow test files to exist with no test cases (stubs for future tasks).
    passWithNoTests: true,
  },
});
