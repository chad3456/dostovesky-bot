import { describe, it, expect, beforeEach, vi } from "vitest";

// No auth anywhere in the public flow; mock the auth module so the route's
// import chain doesn't load real next-auth.
vi.mock("@/lib/auth", () => ({ auth: async () => null }));

import { prisma } from "@/lib/prisma";
import { resetDb } from "../helpers/db";
import { createEpub } from "../fixtures/make-epub";
import { GET as listPublic, POST as uploadPublic } from "@/app/api/public/books/route";
import { GET as getPublicFile } from "@/app/api/public/books/[id]/file/route";

async function uploadFixture(title: string) {
  const buf = await createEpub({ title });
  const form = new FormData();
  form.append("file", new File([new Uint8Array(buf)], "x.epub", { type: "application/epub+zip" }));
  const res = await uploadPublic(
    new Request("http://test/api/public/books", { method: "POST", body: form }) as any,
  );
  return res;
}

beforeEach(async () => {
  await resetDb();
});

describe("public library", () => {
  it("lets anyone upload and lists it for everyone (no auth)", async () => {
    const res = await uploadFixture("A Public Book");
    expect(res.status).toBe(201);

    const list = await (await listPublic()).json();
    expect(list.books).toHaveLength(1);
    expect(list.books[0].title).toBe("A Public Book");
  });

  it("streams the file publicly", async () => {
    const up = await uploadFixture("Streamable");
    const { book } = await up.json();
    const fileRes = await getPublicFile(new Request("http://test"), {
      params: { id: book.id },
    });
    expect(fileRes.status).toBe(200);
    expect(fileRes.headers.get("Content-Type")).toContain("application/epub+zip");
    expect(Buffer.from(await fileRes.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("shows all uploads to a second visitor", async () => {
    await uploadFixture("One");
    await uploadFixture("Two");
    const list = await (await listPublic()).json();
    expect(list.books.map((b: { title: string }) => b.title).sort()).toEqual([
      "One",
      "Two",
    ]);
  });

  it("rejects non-epub uploads", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array(Buffer.from("nope"))], "n.txt", { type: "text/plain" }));
    const res = await uploadPublic(
      new Request("http://test", { method: "POST", body: form }) as any,
    );
    expect(res.status).toBe(415);
  });

  it("keeps public books separate from a private user's library", async () => {
    await uploadFixture("Public One");
    const other = await prisma.user.create({ data: { email: "u@x.com" } });
    await prisma.book.create({
      data: {
        ownerId: other.id,
        title: "Private",
        filePath: "p.epub",
        fileSize: 1,
        fileName: "p.epub",
      },
    });
    const list = await (await listPublic()).json();
    expect(list.books).toHaveLength(1);
    expect(list.books[0].title).toBe("Public One");
  });
});
