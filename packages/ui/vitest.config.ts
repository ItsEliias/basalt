import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const stub = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // The contrast walker renders real components; RN ships uncompiled
      // Flow the node environment can't parse, so host components become
      // string-typed elements (styles pass through untouched).
      'react-native-svg': stub('./src/__tests__/svgMock.ts'),
      'react-native': stub('./src/__tests__/rnMock.ts'),
      'expo-blur': stub('./src/__tests__/blurMock.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
});
