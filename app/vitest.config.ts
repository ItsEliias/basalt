import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// App-level tests cover pure logic only (layout math, view models) — modules
// under test must not import react-native. Screen behavior is exercised
// through the packages' own suites.
export default defineConfig({
  resolve: {
    alias: {
      // Ships uncompiled RN source the node environment cannot parse; the
      // widget render test only walks element trees, so a marker stub works.
      'react-native-android-widget': fileURLToPath(new URL('./src/widgets/__stubs__/react-native-android-widget.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    passWithNoTests: true,
  },
});
