import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Hits real local Docker services (see docker-compose.test.yml /
 * docker-compose.test.md) instead of mocks. Requires the stack to be up
 * and .env.local populated with the extracted credentials.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup-integration.ts"],
    testTimeout: 20_000,
    // Integration tests share mutable state in the same running services
    // (root folders, added-then-removed items) — keep them from racing.
    fileParallelism: false,
  },
});
