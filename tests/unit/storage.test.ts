import { describe, it, expect, afterAll } from "vitest";
import { promises as fs } from "fs";
import {
  saveBookFile,
  readBookFile,
  deleteBookFile,
  resolveBookPath,
  storageRoot,
} from "@/lib/storage";

describe("storage", () => {
  const created: string[] = [];

  it("round-trips a saved file", async () => {
    const data = Buffer.from("epub-bytes-here");
    const rel = await saveBookFile(data);
    created.push(rel);
    const back = await readBookFile(rel);
    expect(back.equals(data)).toBe(true);
  });

  it("deletes files and ignores missing ones", async () => {
    const rel = await saveBookFile(Buffer.from("temp"));
    await deleteBookFile(rel);
    await expect(readBookFile(rel)).rejects.toThrow();
    // Deleting again must not throw.
    await expect(deleteBookFile(rel)).resolves.toBeUndefined();
  });

  it("guards against path traversal", () => {
    expect(() => resolveBookPath("../../etc/passwd")).toThrow(/Invalid/);
    expect(() => resolveBookPath("/etc/passwd")).toThrow(/Invalid/);
  });

  it("resolves normal relative paths within the storage root", () => {
    const abs = resolveBookPath("abc123.epub");
    expect(abs.startsWith(storageRoot())).toBe(true);
  });

  afterAll(async () => {
    for (const rel of created) {
      await deleteBookFile(rel).catch(() => {});
    }
    await fs.rm(storageRoot(), { recursive: true, force: true }).catch(() => {});
  });
});
