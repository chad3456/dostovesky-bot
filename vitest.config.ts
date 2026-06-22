import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    env: {
      DATABASE_URL:
        "postgresql://app:app@127.0.0.1:5432/epub_test?schema=public",
      NODE_ENV: "test",
      STORAGE_DIR: "./storage/test-books",
      AUTH_SECRET: "test-secret-test-secret-test-secret-0123",
    },
    environmentMatchGlobs: [["**/*.dom.test.{ts,tsx}", "jsdom"]],
    setupFiles: ["./tests/setup.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.ts"],
    pool: "forks",
    poolOptions: {
      // Integration tests share one DB; run serially to avoid cross-talk.
      forks: { singleFork: true },
    },
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
