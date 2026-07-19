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
  try {
    // Prisma's schema reads env("DATABASE_URL"); point it at the resolved URL.
    run("prisma migrate deploy", { DATABASE_URL: migrateUrl });
  } catch (err) {
    // A build container sometimes can't reach the database even though the
    // runtime can. Don't brick the whole deploy: warn loudly and continue.
    // Set STRICT_DB_MIGRATIONS=true to make migration failures fatal.
    if (process.env.STRICT_DB_MIGRATIONS === "true") throw err;
    console.warn(
      "\n⚠️  prisma migrate deploy FAILED — continuing the build anyway.\n" +
        "   Database-backed features may error until migrations are applied.\n" +
        "   Run `pnpm prisma migrate deploy` against your database, or set\n" +
        "   STRICT_DB_MIGRATIONS=true to fail builds on migration errors.\n",
    );
  }
} else {
  console.log("No database configured — skipping migrations (client-only deploy).");
}
