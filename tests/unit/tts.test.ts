import { describe, it, expect } from "vitest";
import { cleanText, splitIntoSentences } from "@/lib/tts";
import { wrapText } from "@/lib/share-image";

describe("cleanText", () => {
  it("collapses whitespace and trims", () => {
    expect(cleanText("  hello\n\n  world \t! ")).toBe("hello world !");
  });
});

describe("splitIntoSentences", () => {
  it("splits on sentence punctuation", () => {
    const out = splitIntoSentences("Hello there. How are you? I am fine!");
    expect(out).toEqual(["Hello there.", "How are you?", "I am fine!"]);
  });

  it("returns empty for blank text", () => {
    expect(splitIntoSentences("   \n  ")).toEqual([]);
  });

  it("breaks very long sentences into bounded chunks", () => {
    const long = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
    const out = splitIntoSentences(long);
    expect(out.length).toBeGreaterThan(1);
    for (const chunk of out) expect(chunk.length).toBeLessThanOrEqual(240);
  });

  it("keeps a normal sentence as a single chunk", () => {
    expect(splitIntoSentences("Just one sentence with no terminator")).toEqual([
      "Just one sentence with no terminator",
    ]);
  });
});

describe("wrapText", () => {
  // Fake measurer: width = character count.
  const measure = (s: string) => s.length;

  it("wraps words to the given max width", () => {
    const lines = wrapText(measure, "aaa bbb ccc ddd", 7);
    // "aaa bbb" = 7 ok, adding " ccc" exceeds → wrap
    expect(lines).toEqual(["aaa bbb", "ccc ddd"]);
  });

  it("never drops words", () => {
    const text = "the quick brown fox jumps over the lazy dog";
    const lines = wrapText(measure, text, 12);
    expect(lines.join(" ")).toBe(text);
  });

  it("handles a single very long word", () => {
    const lines = wrapText(measure, "supercalifragilistic", 5);
    expect(lines).toEqual(["supercalifragilistic"]);
  });
});
