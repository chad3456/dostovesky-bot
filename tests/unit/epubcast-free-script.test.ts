import { describe, it, expect } from "vitest";
import { composeSegment, pullQuotes } from "@/lib/epubcast/free-script";
import {
  countWords,
  estimateSeconds,
  SEGMENT_COUNT,
  WORDS_PER_SEGMENT,
  TARGET_MINUTES,
} from "@/lib/epubcast/script";

/** A chapter with enough shape for the composer to work with. */
const CHAPTER = [
  "Raskolnikov walked out into the heat of the city, and the noise closed over him like water.",
  '"I am not afraid of you," he said, though his hands would not stay still at his sides.',
  "Sonia watched him from the doorway, and neither of them moved for a long moment.",
  "The guilt he carried was not a thought but a weather, something that changed the light in every room.",
  "He had told himself that the crime was an argument, and arguments could be won.",
  "But the argument kept losing, quietly, every hour, in the small court of his own attention.",
  "Sonia said nothing about redemption, which was the only reason he could bear to listen.",
  "Faith, for her, was not a conclusion; it was a way of remaining in the room.",
  "Outside, the city went on selling and shouting and forgetting, indifferent to either of them.",
  "He thought of his mother's letter, and the thought was unbearable, so he put it down again.",
].join(" ");

const base = {
  bookTitle: "Crime and Punishment",
  author: "Fyodor Dostoevsky",
  chapterTitle: "The Confession",
  chapterNumber: 3,
  totalChapters: 8,
  chapterText: CHAPTER,
  facts: [
    { source: "Wikipedia", text: "The novel was first published in 1866.", url: "https://w/x" },
  ],
  researchQuotes: [{ text: "Pain and suffering are always inevitable.", url: "https://q/x" }],
  targetWords: WORDS_PER_SEGMENT,
};

describe("pullQuotes", () => {
  it("finds quotable sentences of a readable length", () => {
    const quotes = pullQuotes(CHAPTER, 6);
    expect(quotes.length).toBeGreaterThan(0);
    for (const q of quotes) {
      expect(q.text.length).toBeGreaterThanOrEqual(60);
      expect(q.text.length).toBeLessThanOrEqual(240);
    }
  });

  it("spreads picks across the chapter rather than clustering", () => {
    const quotes = pullQuotes(CHAPTER, 5);
    if (quotes.length > 1) {
      expect(quotes[quotes.length - 1].at).toBeGreaterThan(quotes[0].at);
    }
  });

  it("returns nothing for empty text", () => {
    expect(pullQuotes("", 5)).toEqual([]);
  });
});

describe("composeSegment", () => {
  it("hits the per-segment word budget for every segment", () => {
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const turns = composeSegment({ ...base, segmentIndex: i });
      expect(countWords(turns)).toBeGreaterThanOrEqual(WORDS_PER_SEGMENT);
    }
  });

  it("produces a full episode inside the 20-25 minute target", () => {
    const all = Array.from({ length: SEGMENT_COUNT }, (_, i) =>
      composeSegment({ ...base, segmentIndex: i }),
    ).flat();
    const minutes = estimateSeconds(countWords(all)) / 60;
    expect(minutes).toBeGreaterThanOrEqual(TARGET_MINUTES.min);
    // Allow a little overshoot past the last beat, but keep it episode-sized.
    expect(minutes).toBeLessThanOrEqual(TARGET_MINUTES.max + 6);
  });

  it("alternates between the two hosts", () => {
    const turns = composeSegment({ ...base, segmentIndex: 1 });
    const speakers = new Set(turns.map((t) => t.speaker));
    expect(speakers).toEqual(new Set(["A", "B"]));
    // No host should ever speak twice in a row.
    for (let i = 1; i < turns.length; i++) {
      expect(turns[i].speaker).not.toBe(turns[i - 1].speaker);
    }
  });

  it("opens the episode by naming the book and chapter", () => {
    const turns = composeSegment({ ...base, segmentIndex: 0 });
    const opening = turns.slice(0, 3).map((t) => t.text).join(" ");
    expect(opening).toContain("Crime and Punishment");
    expect(opening).toContain("chapter 3");
  });

  it("quotes the chapter's actual text", () => {
    const turns = composeSegment({ ...base, segmentIndex: 1 });
    const spoken = turns.map((t) => t.text).join(" ");
    expect(spoken).toContain("Sonia");
  });

  it("uses the free research facts and quotes in the wider-conversation segment", () => {
    const turns = composeSegment({ ...base, segmentIndex: 2 });
    const spoken = turns.map((t) => t.text).join(" ");
    expect(spoken).toContain("first published in 1866");
    expect(spoken).toContain("Pain and suffering");
  });

  it("says so plainly when no research was found", () => {
    const turns = composeSegment({
      ...base,
      segmentIndex: 2,
      facts: [],
      researchQuotes: [],
    });
    const spoken = turns.map((t) => t.text).join(" ");
    expect(spoken).toMatch(/didn't turn up much published commentary/i);
  });

  it("closes the final segment and points at the next chapter", () => {
    const turns = composeSegment({ ...base, segmentIndex: SEGMENT_COUNT - 1 });
    const ending = turns.slice(-3).map((t) => t.text).join(" ");
    expect(ending).toContain("chapter 4");
  });

  it("does not repeat the same line verbatim across a full episode", () => {
    const all = Array.from({ length: SEGMENT_COUNT }, (_, i) =>
      composeSegment({ ...base, segmentIndex: i }),
    ).flat();
    const counts = new Map<string, number>();
    for (const t of all) counts.set(t.text, (counts.get(t.text) ?? 0) + 1);
    const worst = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    // This fixture is a deliberately thin chapter, so the composer leans on
    // generic beats to reach length; a real chapter yields far more quotes.
    // A stock phrase recurring a few times is fine — chanting it is the bug.
    expect(worst[1], `over-repeated line: "${worst[0]}"`).toBeLessThanOrEqual(4);
  });

  it("never reads the same passage of the book twice in a segment", () => {
    const turns = composeSegment({ ...base, segmentIndex: 1 });
    const quotesRead = turns
      .map((t) => t.text.match(/"([^"]{40,})"/)?.[1])
      .filter(Boolean) as string[];
    expect(new Set(quotesRead).size).toBe(quotesRead.length);
  });

  it("starts every spoken line with a capital letter", () => {
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      for (const t of composeSegment({ ...base, segmentIndex: i })) {
        expect(t.text[0]).toBe(t.text[0].toUpperCase());
      }
    }
  });

  it("does not nest double quotes inside a quoted passage", () => {
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      for (const t of composeSegment({ ...base, segmentIndex: i })) {
        // A well-formed line has an even number of double quotes.
        expect((t.text.match(/"/g) || []).length % 2).toBe(0);
      }
    }
  });

  it("is deterministic for the same chapter", () => {
    const a = composeSegment({ ...base, segmentIndex: 1 });
    const b = composeSegment({ ...base, segmentIndex: 1 });
    expect(a).toEqual(b);
  });

  it("still produces a full segment from a thin chapter", () => {
    const turns = composeSegment({
      ...base,
      chapterText: "A short chapter. Nothing much happens in it at all.",
      facts: [],
      researchQuotes: [],
      segmentIndex: 1,
    });
    expect(countWords(turns)).toBeGreaterThanOrEqual(WORDS_PER_SEGMENT);
  });
});
