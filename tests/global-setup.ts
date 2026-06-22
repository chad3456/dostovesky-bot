import { execSync } from "child_process";

const TEST_DB =
  process.env.TEST_DATABASE_URL ||
  "postgresql://app:app@127.0.0.1:5432/epub_test?schema=public";

// Runs once before the whole suite: ensure the test database schema is current.
export default function setup() {
  process.env.DATABASE_URL = TEST_DB;
  execSync("pnpm prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DB },
  });
}
