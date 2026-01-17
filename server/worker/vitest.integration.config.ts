import { defineConfig } from 'vitest/config';

/**
 * Configuration for integration tests.
 * These tests run against a live server (local or remote).
 *
 * Usage:
 *   SERVER_URL=http://localhost:8787 pnpm test:integration
 *   SERVER_URL=https://claude-chat-staging.workers.dev pnpm test:integration
 */
export default defineConfig({
  test: {
    include: ['test/integration.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
