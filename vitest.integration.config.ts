import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { loadTestDatabaseUrl } from "./tests/support/test-database-url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 15_000,
    env: {
      DATABASE_URL: loadTestDatabaseUrl(),
      AUTH_JWT_SECRET: randomBytes(32).toString("hex"),
    },
  },
});