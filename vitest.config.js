import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,
    hookTimeout: 15000,
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.js'],
          testTimeout: 5000,
        }
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.js'],
          testTimeout: 15000,
        }
      },
      {
        test: {
          name: 'e2e',
          include: ['tests/e2e/**/*.test.js'],
          testTimeout: 60000,
        }
      }
    ]
  }
});
