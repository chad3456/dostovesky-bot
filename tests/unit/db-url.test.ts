import { describe, it, expect } from "vitest";
import {
  resolveRuntimeDbUrl,
  resolveMigrateDbUrl,
  hasDatabase,
} from "@/lib/db-url";

describe("resolveRuntimeDbUrl", () => {
  it("prefers DATABASE_URL", () => {
    expect(
      resolveRuntimeDbUrl({
        DATABASE_URL: "postgres://a",
        POSTGRES_PRISMA_URL: "postgres://b",
      }),
    ).toBe("postgres://a");
  });

  it("falls back to the Supabase/Vercel POSTGRES_* vars", () => {
    expect(
      resolveRuntimeDbUrl({ POSTGRES_PRISMA_URL: "postgres://prisma" }),
    ).toBe("postgres://prisma");
    expect(resolveRuntimeDbUrl({ POSTGRES_URL: "postgres://plain" })).toBe(
      "postgres://plain",
    );
  });

  it("adds pgbouncer=true for a pooled (6543) URL", () => {
    const url = resolveRuntimeDbUrl({
      DATABASE_URL: "postgres://u:p@host:6543/db",
    });
    expect(url).toContain("pgbouncer=true");
  });

  it("leaves an explicit pgbouncer flag untouched", () => {
    const url = "postgres://u:p@host:6543/db?pgbouncer=true";
    expect(resolveRuntimeDbUrl({ DATABASE_URL: url })).toBe(url);
  });

  it("returns undefined when nothing is configured", () => {
    expect(resolveRuntimeDbUrl({})).toBeUndefined();
    expect(hasDatabase({})).toBe(false);
  });
});

describe("resolveMigrateDbUrl", () => {
  it("prefers the direct / non-pooling URL", () => {
    expect(
      resolveMigrateDbUrl({
        POSTGRES_URL_NON_POOLING: "postgres://direct",
        POSTGRES_PRISMA_URL: "postgres://pooled",
        DATABASE_URL: "postgres://env",
      }),
    ).toBe("postgres://direct");
  });

  it("falls back to DATABASE_URL when no direct URL exists", () => {
    expect(resolveMigrateDbUrl({ DATABASE_URL: "postgres://env" })).toBe(
      "postgres://env",
    );
  });
});
