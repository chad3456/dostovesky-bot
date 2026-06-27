import { describe, it, expect, beforeEach, vi } from "vitest";

// The route's import chain reaches @/lib/auth (→ next-auth); mock it so the
// suite doesn't load the real auth module (consistent with other integration
// tests). The sync route itself doesn't use auth.
vi.mock("@/lib/auth", () => ({ auth: async () => null }));

import { prisma } from "@/lib/prisma";
import { resetDb } from "../helpers/db";
import { createSyncLibrary, findBySyncCode } from "@/lib/sync";
import { POST as createSyncRoute } from "@/app/api/sync/new/route";

beforeEach(async () => {
  await resetDb();
});

describe("sync library", () => {
  it("creates a pre-onboarded anonymous library with default preferences", async () => {
    const { userId, code } = await createSyncLibrary();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { preferences: true },
    });
    expect(user?.syncCode).toBe(code);
    expect(user?.onboardedAt).toBeTruthy(); // skips onboarding
    expect(user?.email).toBeNull(); // anonymous
    expect(user?.preferences?.theme).toBe("light");
  });

  it("resolves a code back to its library (format-insensitive)", async () => {
    const { userId, code } = await createSyncLibrary();
    const found = await findBySyncCode(code.toLowerCase().replace(/-/g, ""));
    expect(found?.id).toBe(userId);
  });

  it("returns null for unknown or malformed codes", async () => {
    expect(await findBySyncCode("AAAA-BBBB-CCCC")).toBeNull();
    expect(await findBySyncCode("nope")).toBeNull();
  });

  it("isolates libraries: a code only opens its own books", async () => {
    const a = await createSyncLibrary();
    const b = await createSyncLibrary();
    await prisma.book.create({
      data: {
        ownerId: a.userId,
        title: "A's book",
        filePath: "a.epub",
        fileSize: 1,
        fileName: "a.epub",
      },
    });
    const booksForB = await prisma.book.findMany({ where: { ownerId: b.userId } });
    expect(booksForB).toHaveLength(0);
  });

  it("POST /api/sync/new returns a working code", async () => {
    const res = await createSyncRoute();
    expect(res.status).toBe(201);
    const { code } = await res.json();
    const found = await findBySyncCode(code);
    expect(found).not.toBeNull();
  });
});
