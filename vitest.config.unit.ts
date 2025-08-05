import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      '**/agents/code-formats/*.test.ts',
      '**/agents/diff-formats/*.test.ts',
      '**/utils/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.d.ts',
      '**/api/**/*.test.ts',
      '**/services/**/*.test.ts',
    ],
  },
});