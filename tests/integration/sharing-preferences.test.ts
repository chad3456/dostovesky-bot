import { describe, it, expect, beforeEach, vi } from "vitest";

const authState = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/auth", () => ({
  auth: async () =>
    authState.userId ? { user: { id: authState.userId } } : null,
}));

import { prisma } from "@/lib/prisma";
import { resetDb, createUser } from "../helpers/db";
import { createEpub } from "../fixtures/make-epub";
import { POST as uploadBook } from "@/app/api/books/route";
import {
  GET as getShare,
  POST as createShare,
  DELETE as revokeShare,
} from "@/app/api/books/[id]/share/route";
import { GET as getSharedMeta } from "@/app/api/shared/[token]/route";
import { GET as getSharedFile } from "@/app/api/shared/[token]/file/route";
import { GET as getPrefs, PUT as putPrefs } from "@/app/api/preferences/route";

async function uploadFixture() {
  const buf = await createEpub();
  const form = new FormData();
  form.append("file", new File([new Uint8Array(buf)], "book.epub", { type: "application/epub+zip" }));
  const res = await uploadBook(
    new Request("http://test/api/books", { method: "POST", body: form }) as any,
  );
  return (await res.json()).book;
}

let userId: string;

beforeEach(async () => {
  await resetDb();
  const user = await createUser();
  userId = user.id;
  authState.userId = userId;
});

describe("sharing API", () => {
  it("creates a public share link and serves the book read-only", async () => {
    const book = await uploadFixture();

    const createRes = await createShare(
      new Request("http://test", { method: "POST", body: "{}" }),
      { params: { id: book.id } },
    );
    expect(createRes.status).toBe(201);
    const { share } = await createRes.json();
    expect(share.token).toBeTruthy();

    // Public access requires no auth.
    authState.userId = null;
    const metaRes = await getSharedMeta(new Request("http://test"), {
      params: { token: share.token },
    });
    expect(metaRes.status).toBe(200);
    const meta = await metaRes.json();
    expect(meta.book.title).toBe(book.title);
    // The filesystem path must never leak to the public.
    expect(meta.book.filePath).toBeUndefined();

    const fileRes = await getSharedFile(new Request("http://test"), {
      params: { token: share.token },
    });
    expect(fileRes.status).toBe(200);
    expect(Buffer.from(await fileRes.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("rejects expired or unknown tokens", async () => {
    const res = await getSharedMeta(new Request("http://test"), {
      params: { token: "nonexistent" },
    });
    expect(res.status).toBe(404);
  });

  it("treats expired links as invalid", async () => {
    const book = await uploadFixture();
    await prisma.shareLink.create({
      data: {
        bookId: book.id,
        ownerId: userId,
        token: "expired-token",
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const res = await getSharedMeta(new Request("http://test"), {
      params: { token: "expired-token" },
    });
    expect(res.status).toBe(404);
  });

  it("revokes a share link", async () => {
    const book = await uploadFixture();
    const created = await (
      await createShare(new Request("http://test", { method: "POST", body: "{}" }), {
        params: { id: book.id },
      })
    ).json();

    await revokeShare(new Request("http://test"), { params: { id: book.id } });

    const getRes = await getShare(new Request("http://test"), { params: { id: book.id } });
    expect((await getRes.json()).share).toBeNull();

    authState.userId = null;
    const metaRes = await getSharedMeta(new Request("http://test"), {
      params: { token: created.share.token },
    });
    expect(metaRes.status).toBe(404);
  });

  it("only one active share link exists per book", async () => {
    const book = await uploadFixture();
    await createShare(new Request("http://test", { method: "POST", body: "{}" }), {
      params: { id: book.id },
    });
    await createShare(new Request("http://test", { method: "POST", body: "{}" }), {
      params: { id: book.id },
    });
    expect(await prisma.shareLink.count({ where: { bookId: book.id } })).toBe(1);
  });
});

describe("preferences API", () => {
  it("returns defaults before any are saved", async () => {
    const res = await getPrefs();
    const body = await res.json();
    expect(body.preferences.theme).toBe("light");
    expect(body.preferences.fontSize).toBe(18);
  });

  it("persists and reloads preferences", async () => {
    const putRes = await putPrefs(
      new Request("http://test", {
        method: "PUT",
        body: JSON.stringify({ theme: "sepia", fontSize: 22, fontFamily: "dyslexic" }),
      }),
    );
    expect(putRes.status).toBe(200);

    const getRes = await getPrefs();
    const body = await getRes.json();
    expect(body.preferences.theme).toBe("sepia");
    expect(body.preferences.fontSize).toBe(22);
    expect(body.preferences.fontFamily).toBe("dyslexic");
  });

  it("rejects invalid preference values", async () => {
    const res = await putPrefs(
      new Request("http://test", {
        method: "PUT",
        body: JSON.stringify({ theme: "neon" }),
      }),
    );
    expect(res.status).toBe(422);
  });
});
