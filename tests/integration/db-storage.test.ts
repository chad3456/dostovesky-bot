import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

// storage.ts → prisma; no auth involved, but keep the import chain light.
vi.mock("@/lib/auth", () => ({ auth: async () => null }));

import { prisma } from "@/lib/prisma";
import { saveBookFile, readBookFile, deleteBookFile } from "@/lib/storage";

const prevFileStore = process.env.FILE_STORAGE;

beforeEach(() => {
  process.env.FILE_STORAGE = "db"; // force the Postgres file backend
});

afterAll(() => {
  if (prevFileStore === undefined) delete process.env.FILE_STORAGE;
  else process.env.FILE_STORAGE = prevFileStore;
});

describe("Postgres file storage", () => {
  it("round-trips a file through the database", async () => {
    const data = Buffer.from("epub-bytes-in-postgres");
    const ref = await saveBookFile(data);
    expect(ref).toMatch(/^db:/);

    const back = await readBookFile(ref);
    expect(back.equals(data)).toBe(true);

    // The row really exists in the BookBlob table.
    const count = await prisma.bookBlob.count();
    expect(count).toBeGreaterThan(0);
  });

  it("deletes a stored file and tolerates missing ones", async () => {
    const ref = await saveBookFile(Buffer.from("temp"));
    await deleteBookFile(ref);
    await expect(readBookFile(ref)).rejects.toThrow();
    // Deleting again is a no-op.
    await expect(deleteBookFile(ref)).resolves.toBeUndefined();
  });
});
