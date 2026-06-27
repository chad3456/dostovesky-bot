import { PrismaClient } from "@prisma/client";
import { resolveRuntimeDbUrl } from "@/lib/db-url";

// Reuse a single PrismaClient across hot reloads in development to avoid
// exhausting database connections.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Resolve the connection string from DATABASE_URL or the POSTGRES_* vars that
// the Supabase/Vercel integration injects, so the app connects without the
// user having to manually re-map env vars.
const datasourceUrl = resolveRuntimeDbUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
