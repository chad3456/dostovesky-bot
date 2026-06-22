import "@testing-library/jest-dom/vitest";

// Ensure the test database is used even if a worker missed the config env.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://app:app@127.0.0.1:5432/epub_test?schema=public";
process.env.STORAGE_DIR = process.env.STORAGE_DIR || "./storage/test-books";
