import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const TEST_DB =
  process.env.TEST_DATABASE_URL ||
  "postgresql://app:app@127.0.0.1:5432/epub_test?schema=public";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    actionTimeout: 15_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    url: BASE_URL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: TEST_DB,
      ENABLE_TEST_LOGIN: "true",
      AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123456789",
      NEXTAUTH_URL: BASE_URL,
      AUTH_GOOGLE_ID: "",
      AUTH_GOOGLE_SECRET: "",
      STORAGE_DIR: "./storage/e2e-books",
    },
  },
});
