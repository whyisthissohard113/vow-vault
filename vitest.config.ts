import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", ".next", "out", "build"],
    // Integration suites share a single local PostgreSQL via parallel
    // workers; route heavy test bodies through the DB connection pool, so a
    // generous per-test timeout avoids false flakes under contention.
    testTimeout: 20000,
    env: {
      DATABASE_URL: "postgresql://wmv:wmv@localhost:5432/wedding_memory_vault",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
