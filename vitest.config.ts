import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'istanbul',
      include: ['src/**/*.ts'],
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 75,
      },
    },
  },
});
