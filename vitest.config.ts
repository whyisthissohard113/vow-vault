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
    testTimeout: 45000,
    // The admin suite's afterEach cleanup cascades many FK deletes and
    // occasionally exceeds vitest's 10s DEFAULT hook timeout under slower
    // (serial/CI) execution. Match the per-test budget.
    hookTimeout: 45000,
    // Serialize test FILES: every suite shares ONE database, and several
    // fixtures contend on partial-unique indexes (platform templates,
    // vault slugs, payment/order rows). Parallel files produce intermittent
    // FK/unique races (first seen on CI's fresh DB: 8 flaky failures in
    // build-engine.test.ts). Determinism is worth the slower wall time.
    fileParallelism: false,
    // Each file gets its OWN forked process so the module-level singleton DB
    // pool is born/freed per suite instead of being carried across all 21
    // files by one reused worker. A single shared pool degrades across a long
    // run (postgres.js connect/query stalls seen in admin-service's
    // getPlatformHealth at the tail of the suite).
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
    env: {
      // Fallback ONLY for local runs — an explicitly-set DATABASE_URL (CI job
      // env, fresh-DB verification) must take precedence, otherwise every
      // run silently connects to the dev database.
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://wmv:wmv@localhost:5432/wedding_memory_vault",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
