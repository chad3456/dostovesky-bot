// Resolve the Postgres connection string from whatever the host injected.
//
// The Supabase↔Vercel (and Vercel Postgres) integrations set POSTGRES_* env
// vars rather than DATABASE_URL, so we look across the known names. Runtime
// queries prefer the *pooled* URL (serverless-friendly); migrations prefer the
// *direct* (non-pooling) URL.

type Env = Record<string, string | undefined>;

function firstSet(env: Env, names: string[]): string | undefined {
  for (const n of names) {
    const v = env[n];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

/** Ensure a pooled (PgBouncer, port 6543) URL disables prepared statements. */
function withPgBouncer(url: string): string {
  if (!/:6543\b/.test(url) || /pgbouncer=true/.test(url)) return url;
  return url + (url.includes("?") ? "&" : "?") + "pgbouncer=true";
}

/** Connection string for runtime queries (pooled preferred). */
export function resolveRuntimeDbUrl(env: Env = process.env): string | undefined {
  const url = firstSet(env, [
    "DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
  ]);
  return url ? withPgBouncer(url) : undefined;
}

/** Connection string for migrations (direct / non-pooling preferred). */
export function resolveMigrateDbUrl(env: Env = process.env): string | undefined {
  return firstSet(env, [
    "DIRECT_URL",
    "POSTGRES_URL_NON_POOLING",
    "DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
  ]);
}

/** Whether any Postgres connection is configured. */
export function hasDatabase(env: Env = process.env): boolean {
  return Boolean(resolveRuntimeDbUrl(env));
}
