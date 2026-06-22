import { describe, it, expect, beforeEach, vi } from "vitest";

// Control the "signed in" user via a hoisted holder the auth mock reads.
const authState = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/auth", () => ({
  auth: async () =>
    authState.userId ? { user: { id: authState.userId } } : null,
}));

import { prisma } from "@/lib/prisma";
import { resetDb, createUser } from "../helpers/db";
import { createEpub } from "../fixtures/make-epub";
import { GET as listBooks, POST as uploadBook } from "@/app/api/books/route";
import {
  GET as getBook,
  DELETE as deleteBook,
} from "@/app/api/books/[id]/route";
import { GET as getFile } from "@/app/api/books/[id]/file/route";
import {
  GET as getProgress,
  PUT as putProgress,
} from "@/app/api/books/[id]/progress/route";
import {
  GET as getHighlights,
  POST as postHighlight,
} from "@/app/api/books/[id]/highlights/route";
import {
  PATCH as patchHighlight,
  DELETE as deleteHighlight,
} from "@/app/api/highlights/[id]/route";

async function uploadFixture(name = "book.epub", opts = {}) {
  const buf = await createEpub(opts);
  const form = new FormData();
  form.append("file", new File([new Uint8Array(buf)], name, { type: "application/epub+zip" }));
  const req = new Request("http://test/api/books", {
    method: "POST",
    body: form,
  });
  return uploadBook(req as any);
}

let userId: string;

beforeEach(async () => {
  await resetDb();
  const user = await createUser();
  userId = user.id;
  authState.userId = userId;
});

describe("books API", () => {
  it("rejects unauthenticated requests", async () => {
    authState.userId = null;
    const res = await listBooks();
    expect(res.status).toBe(401);
  });

  it("uploads an EPUB and extracts metadata", async () => {
    const res = await uploadFixture("crime.epub", {
      title: "Crime and Tests",
      author: "F. Dostotest",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.book.title).toBe("Crime and Tests");
    expect(body.book.author).toBe("F. Dostotest");
    expect(body.book.cover).toMatch(/^data:image/);

    const stored = await prisma.book.findUnique({
      where: { id: body.book.id },
    });
    expect(stored?.ownerId).toBe(userId);
    expect(stored?.fileSize).toBeGreaterThan(0);
  });

  it("rejects non-epub uploads", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array(Buffer.from("nope"))], "notes.txt", { type: "text/plain" }));
    const req = new Request("http://test/api/books", { method: "POST", body: form });
    const res = await uploadBook(req as any);
    expect(res.status).toBe(415);
  });

  it("rejects a corrupt epub", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array(Buffer.from("not really a zip"))], "bad.epub"));
    const req = new Request("http://test/api/books", { method: "POST", body: form });
    const res = await uploadBook(req as any);
    expect(res.status).toBe(422);
  });

  it("lists only the owner's books", async () => {
    await uploadFixture("a.epub", { title: "Mine" });
    const otherUser = await createUser("other@example.com", "Other");
    await prisma.book.create({
      data: {
        ownerId: otherUser.id,
        title: "Theirs",
        filePath: "x.epub",
        fileSize: 1,
        fileName: "x.epub",
      },
    });

    const res = await listBooks();
    const body = await res.json();
    expect(body.books).toHaveLength(1);
    expect(body.books[0].title).toBe("Mine");
  });

  it("serves the raw epub bytes for the owner", async () => {
    const up = await uploadFixture();
    const { book } = await up.json();
    const res = await getFile(new Request("http://test"), { params: { id: book.id } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/epub+zip");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it("returns 404 for another user's book", async () => {
    const up = await uploadFixture();
    const { book } = await up.json();
    const other = await createUser("other@example.com", "Other");
    authState.userId = other.id;
    const res = await getBook(new Request("http://test"), { params: { id: book.id } });
    expect(res.status).toBe(404);
  });

  it("syncs reading progress across requests", async () => {
    const up = await uploadFixture();
    const { book } = await up.json();

    const putRes = await putProgress(
      new Request("http://test", {
        method: "PUT",
        body: JSON.stringify({ cfi: "epubcfi(/6/4)", percentage: 0.42, label: "Chapter Two" }),
      }),
      { params: { id: book.id } },
    );
    expect(putRes.status).toBe(200);

    const getRes = await getProgress(new Request("http://test"), { params: { id: book.id } });
    const body = await getRes.json();
    expect(body.progress.percentage).toBeCloseTo(0.42);
    expect(body.progress.cfi).toBe("epubcfi(/6/4)");
    expect(body.progress.label).toBe("Chapter Two");
  });

  it("rejects invalid progress", async () => {
    const up = await uploadFixture();
    const { book } = await up.json();
    const res = await putProgress(
      new Request("http://test", {
        method: "PUT",
        body: JSON.stringify({ percentage: 5 }),
      }),
      { params: { id: book.id } },
    );
    expect(res.status).toBe(422);
  });

  it("creates, updates and deletes highlights", async () => {
    const up = await uploadFixture();
    const { book } = await up.json();

    const createRes = await postHighlight(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({
          cfiRange: "epubcfi(/6/4,/1:0,/1:10)",
          text: "best of tests",
          color: "green",
        }),
      }),
      { params: { id: book.id } },
    );
    expect(createRes.status).toBe(201);
    const { highlight } = await createRes.json();
    expect(highlight.color).toBe("green");

    const patchRes = await patchHighlight(
      new Request("http://test", {
        method: "PATCH",
        body: JSON.stringify({ note: "remember this", color: "pink" }),
      }),
      { params: { id: highlight.id } },
    );
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.highlight.note).toBe("remember this");
    expect(patched.highlight.color).toBe("pink");

    const listRes = await getHighlights(new Request("http://test"), { params: { id: book.id } });
    const listed = await listRes.json();
    expect(listed.highlights).toHaveLength(1);

    const delRes = await deleteHighlight(new Request("http://test"), { params: { id: highlight.id } });
    expect(delRes.status).toBe(200);
    const afterRes = await getHighlights(new Request("http://test"), { params: { id: book.id } });
    expect((await afterRes.json()).highlights).toHaveLength(0);
  });

  it("deletes a book and cascades its data", async () => {
    const up = await uploadFixture();
    const { book } = await up.json();
    await postHighlight(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ cfiRange: "x", text: "y" }),
      }),
      { params: { id: book.id } },
    );

    const delRes = await deleteBook(new Request("http://test"), { params: { id: book.id } });
    expect(delRes.status).toBe(200);

    const after = await getBook(new Request("http://test"), { params: { id: book.id } });
    expect(after.status).toBe(404);
    expect(await prisma.highlight.count()).toBe(0);
  });
});
