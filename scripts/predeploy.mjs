// Pre-build step for hosted deploys.
//
// `prisma generate` always runs (the client must exist for the build to
// compile). `prisma migrate deploy` only runs when a database is configured.
//
// The Supabase↔Vercel (and Vercel Postgres) integrations inject POSTGRES_*
// env vars rather than DATABASE_URL, so we resolve across the known names and
// prefer the *direct* (non-pooling) URL for migrations. If nothing is set, the
// app still deploys as the zero-backend client-side reader.
import { execSync } from "node:child_process";

function firstSet(names) {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

const migrateUrl = firstSet([
  "DIRECT_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
]);

function run(cmd, extraEnv = {}) {
  console.log(`▶ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: { ...process.env, ...extraEnv } });
}

run("prisma generate");

if (migrateUrl) {
  console.log("Database detected — applying migrations.");
  // Prisma's schema reads env("DATABASE_URL"); point it at the resolved URL.
  run("prisma migrate deploy", { DATABASE_URL: migrateUrl });
} else {
  console.log("No database configured — skipping migrations (client-only deploy).");
}
