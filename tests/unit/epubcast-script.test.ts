import { describe, it, expect } from "vitest";
import {
  parseDialogue,
  countWords,
  estimateSeconds,
  formatDuration,
  openingSpeaker,
  excerptForPrompt,
  SEGMENT_BRIEFS,
  SEGMENT_COUNT,
  WORDS_PER_SEGMENT,
  WORDS_PER_MINUTE,
  TARGET_MINUTES,
} from "@/lib/epubcast/script";

describe("parseDialogue", () => {
  it("parses the two-host line format", () => {
    const turns = parseDialogue(
      ["NORA: So this chapter opens in the dark.", "JULIAN: Literally dark."].join("\n"),
    );
    expect(turns).toEqual([
      { speaker: "A", text: "So this chapter opens in the dark." },
      { speaker: "B", text: "Literally dark." },
    ]);
  });

  it("tolerates markdown bold, blank lines and alternate labels", () => {
    const turns = parseDialogue(
      ["**Nora:** First.", "", "Host B: Second.", "   ", "A: Third."].join("\n"),
    );
    expect(turns.map((t) => t.speaker)).toEqual(["A", "B", "A"]);
    expect(turns[0].text).toBe("First.");
  });

  it("folds unlabelled continuation lines into the previous turn", () => {
    const turns = parseDialogue(
      ["NORA: One sentence.", "And its wrapped continuation."].join("\n"),
    );
    expect(turns).toHaveLength(1);
    expect(turns[0].text).toBe("One sentence. And its wrapped continuation.");
  });

  it("strips stage directions and emphasis from spoken text", () => {
    const turns = parseDialogue("NORA: [warmly] That *line* is (laughs) perfect.");
    expect(turns[0].text).toBe("That line is perfect.");
  });

  it("drops leading prose that precedes any speaker line", () => {
    const turns = parseDialogue("Here is the script:\nNORA: Begin.");
    expect(turns).toEqual([{ speaker: "A", text: "Begin." }]);
  });

  it("returns nothing for empty or speaker-less input", () => {
    expect(parseDialogue("")).toEqual([]);
    expect(parseDialogue("just some prose")).toEqual([]);
  });
});

describe("duration math", () => {
  it("counts words across turns", () => {
    expect(
      countWords([
        { speaker: "A", text: "one two three" },
        { speaker: "B", text: "four five" },
      ]),
    ).toBe(5);
  });

  it("converts words to seconds at the speaking rate", () => {
    expect(estimateSeconds(WORDS_PER_MINUTE)).toBe(60);
    expect(estimateSeconds(WORDS_PER_MINUTE * 20)).toBe(20 * 60);
  });

  it("formats as m:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(1_380)).toBe("23:00");
  });

  it("targets a 20-25 minute episode across its segments", () => {
    const totalWords = SEGMENT_COUNT * WORDS_PER_SEGMENT;
    const minutes = estimateSeconds(totalWords) / 60;
    expect(minutes).toBeGreaterThanOrEqual(TARGET_MINUTES.min);
    expect(minutes).toBeLessThanOrEqual(TARGET_MINUTES.max);
  });

  it("has a brief for every segment", () => {
    expect(SEGMENT_BRIEFS).toHaveLength(SEGMENT_COUNT);
    for (const b of SEGMENT_BRIEFS) expect(b.length).toBeGreaterThan(20);
  });
});

describe("openingSpeaker", () => {
  it("alternates which host opens each segment", () => {
    expect(openingSpeaker(0)).toBe("A");
    expect(openingSpeaker(1)).toBe("B");
    expect(openingSpeaker(2)).toBe("A");
  });
});

describe("excerptForPrompt", () => {
  it("returns short text unchanged", () => {
    expect(excerptForPrompt("a short chapter", 100)).toBe("a short chapter");
  });

  it("keeps the head and tail of a long chapter", () => {
    const words = Array.from({ length: 500 }, (_, i) => `w${i}`);
    const out = excerptForPrompt(words.join(" "), 100);
    expect(out).toContain("w0");
    expect(out).toContain("w499");
    expect(out).toContain("omitted for length");
    expect(out.split(/\s+/).length).toBeLessThan(200);
  });
});
