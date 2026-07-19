import { describe, it, expect, beforeEach, vi } from "vitest";

const authState = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/auth", () => ({
  auth: async () =>
    authState.userId ? { user: { id: authState.userId } } : null,
}));

import { prisma } from "@/lib/prisma";
import { resetDb, createUser } from "../helpers/db";
import { GET as listHighlights } from "@/app/api/highlights/route";

async function makeBook(ownerId: string, title: string) {
  return prisma.book.create({
    data: { ownerId, title, filePath: `${title}.epub`, fileSize: 1, fileName: `${title}.epub` },
  });
}

beforeEach(async () => {
  await resetDb();
  authState.userId = null;
});

describe("GET /api/highlights (all notes across books)", () => {
  it("requires authentication", async () => {
    const res = await listHighlights();
    expect(res.status).toBe(401);
  });

  it("returns the user's highlights with book titles, newest first", async () => {
    const user = await createUser();
    authState.userId = user.id;
    const b1 = await makeBook(user.id, "Crime and Punishment");
    const b2 = await makeBook(user.id, "The Idiot");

    await prisma.highlight.create({
      data: { userId: user.id, bookId: b1.id, cfiRange: "a", text: "older", createdAt: new Date("2026-01-01") },
    });
    await prisma.highlight.create({
      data: { userId: user.id, bookId: b2.id, cfiRange: "b", text: "newer", note: "!", createdAt: new Date("2026-02-01") },
    });

    const res = await listHighlights();
    expect(res.status).toBe(200);
    const { highlights } = await res.json();
    expect(highlights).toHaveLength(2);
    expect(highlights[0].text).toBe("newer");
    expect(highlights[0].bookTitle).toBe("The Idiot");
    expect(highlights[1].bookTitle).toBe("Crime and Punishment");
  });

  it("never returns another user's notes", async () => {
    const me = await createUser("me@example.com");
    const them = await createUser("them@example.com");
    const theirBook = await makeBook(them.id, "Private");
    await prisma.highlight.create({
      data: { userId: them.id, bookId: theirBook.id, cfiRange: "x", text: "secret" },
    });

    authState.userId = me.id;
    const { highlights } = await (await listHighlights()).json();
    expect(highlights).toHaveLength(0);
  });
});
