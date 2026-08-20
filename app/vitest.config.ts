import { defineConfig } from 'vitest/config';

// App-level tests cover pure logic only (layout math, view models) — modules
// under test must not import react-native. Screen behavior is exercised
// through the packages' own suites.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
