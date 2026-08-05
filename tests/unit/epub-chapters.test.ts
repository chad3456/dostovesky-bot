import { describe, it, expect } from "vitest";
import { extractEpubChapters } from "@/lib/epub";
import { createEpub } from "../fixtures/make-epub";

/** A paragraph long enough to clear the front-matter word threshold. */
function longParagraph(seed: string, words = 140): string {
  return Array.from({ length: words }, (_, i) => `${seed}${i}`).join(" ");
}

describe("extractEpubChapters", () => {
  it("extracts substantive chapters in reading order with titles", async () => {
    const buf = await createEpub({
      chapters: [
        { title: "The Beginning", paragraphs: [longParagraph("a"), longParagraph("b")] },
        { title: "The Middle", paragraphs: [longParagraph("c"), longParagraph("d")] },
      ],
    });

    const chapters = await extractEpubChapters(buf);
    expect(chapters).toHaveLength(2);
    expect(chapters[0].index).toBe(0);
    expect(chapters[0].title).toBe("The Beginning");
    expect(chapters[1].title).toBe("The Middle");
    expect(chapters[0].wordCount).toBeGreaterThan(220);
  });

  it("returns readable plain text with markup stripped", async () => {
    const buf = await createEpub({
      chapters: [
        {
          title: "Only Chapter",
          paragraphs: [longParagraph("x"), longParagraph("y"), "A plain sentence."],
        },
      ],
    });
    const [chapter] = await extractEpubChapters(buf);
    expect(chapter.text).toContain("A plain sentence.");
    expect(chapter.text).not.toContain("<p>");
    expect(chapter.text).not.toContain("<html");
  });

  it("skips front matter that is too short to be a chapter", async () => {
    const buf = await createEpub({
      chapters: [
        { title: "Cover", paragraphs: ["Copyright 2026."] },
        { title: "Real Chapter", paragraphs: [longParagraph("y"), longParagraph("z")] },
      ],
    });
    const chapters = await extractEpubChapters(buf);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe("Real Chapter");
    // Indexes are renumbered after filtering.
    expect(chapters[0].index).toBe(0);
  });

  it("rejects a book with no substantial chapters", async () => {
    const buf = await createEpub({
      chapters: [{ title: "Tiny", paragraphs: ["Too short."] }],
    });
    await expect(extractEpubChapters(buf)).rejects.toThrow(/no readable chapters/i);
  });

  it("rejects a file that is not an EPUB", async () => {
    await expect(
      extractEpubChapters(Buffer.from("definitely not a zip")),
    ).rejects.toThrow(/valid ZIP\/EPUB/i);
  });
});
