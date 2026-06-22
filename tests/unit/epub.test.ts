import { describe, it, expect } from "vitest";
import { parseEpubMetadata } from "@/lib/epub";
import { createEpub } from "../fixtures/make-epub";

describe("parseEpubMetadata", () => {
  it("extracts title, author, language and description", async () => {
    const buf = await createEpub({
      title: "Crime and Tests",
      author: "F. Dostotest",
      language: "ru",
      description: "A psychological thriller about flaky tests.",
    });
    const meta = await parseEpubMetadata(buf);
    expect(meta.title).toBe("Crime and Tests");
    expect(meta.author).toBe("F. Dostotest");
    expect(meta.language).toBe("ru");
    expect(meta.description).toContain("flaky tests");
  });

  it("embeds the cover as a data URL when present", async () => {
    const buf = await createEpub({ withCover: true });
    const meta = await parseEpubMetadata(buf);
    expect(meta.cover).toMatch(/^data:image\/png;base64,/);
  });

  it("returns null cover when none is present", async () => {
    const buf = await createEpub({ withCover: false });
    const meta = await parseEpubMetadata(buf);
    expect(meta.cover).toBeNull();
  });

  it("falls back to 'Untitled' when no title is given", async () => {
    const buf = await createEpub({ title: "" });
    const meta = await parseEpubMetadata(buf);
    expect(meta.title).toBe("Untitled");
  });

  it("throws on a non-EPUB buffer", async () => {
    await expect(
      parseEpubMetadata(Buffer.from("this is not a zip")),
    ).rejects.toThrow(/valid ZIP\/EPUB/i);
  });

  it("throws when container.xml is missing", async () => {
    // A valid zip but not an epub.
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("hello.txt", "world");
    const buf = await zip.generateAsync({ type: "nodebuffer" });
    await expect(parseEpubMetadata(buf)).rejects.toThrow(/container\.xml/i);
  });
});
