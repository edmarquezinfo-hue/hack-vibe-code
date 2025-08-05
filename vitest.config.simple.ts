import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      // Diff format tests
      '**/agents/diff-formats/search-replace.test.ts',
      '**/agents/diff-formats/udiff-comprehensive.test.ts',
      
      // Code format tests
      '**/agents/code-formats/scof-comprehensive.test.ts',
      
      // Auth tests
      '**/services/auth/passwordService.test.ts',
      '**/services/auth/authService.test.ts',
      '**/services/auth/tokenService.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.d.ts',
      // Exclude redundant/old test files
      '**/agents/code-formats/scof.test.ts',
      '**/agents/code-formats/scof-llm-resilience.test.ts',
      '**/agents/diff-formats/udiff.test.ts',
    ],
  },
});