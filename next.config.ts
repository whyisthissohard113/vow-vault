import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Standalone output (Phase 15 infra): `next build` emits a self-contained
   * server folder (`.next/standalone`) with a minimal node_modules that can
   * run with just `node server.js`. Used by the production Docker image —
   * the app container runs the standalone server, and the worker containers
   * run the tsx worker entrypoints against the same image.
   *
   * Note: the standalone trace is produced *inside the Linux Docker builder*,
   * so no Windows-built `.next/standalone` folder is ever shipped (Windows
   * traces can embed drive-letter paths that break Linux images).
   */
  output: "standalone",
  distDir: ".next-ci",
};

export default nextConfig;
