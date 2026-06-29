import { describe, it, expect } from "vitest";
import {
  analyzeChapter,
  splitSentences,
  radialLayout,
} from "@/lib/knowledge-graph";

const SAMPLE = `
Raskolnikov walked through the city. Raskolnikov thought about the crime and the
guilt that followed. Sonia spoke to Raskolnikov about faith and redemption.
The crime weighed on Raskolnikov, and guilt consumed his thoughts. Sonia offered
redemption through faith. Faith and guilt wrestled inside Raskolnikov.
`;

describe("splitSentences", () => {
  it("splits prose into sentences", () => {
    expect(splitSentences("Hello world. How are you? Fine!").length).toBe(3);
  });
});

describe("analyzeChapter", () => {
  const a = analyzeChapter(SAMPLE);

  it("surfaces the main entity as a node", () => {
    const labels = a.nodes.map((n) => n.label.toLowerCase());
    expect(labels).toContain("raskolnikov");
  });

  it("classifies proper nouns as entities and words as themes", () => {
    const entity = a.nodes.find((n) => n.label.toLowerCase() === "raskolnikov");
    expect(entity?.kind).toBe("entity");
    expect(a.themes.length).toBeGreaterThan(0);
    // recurring theme words show up
    expect([...a.themes, ...a.nodes.map((n) => n.label)]).toContain("guilt");
  });

  it("connects concepts that co-occur in sentences", () => {
    expect(a.edges.length).toBeGreaterThan(0);
    for (const e of a.edges) expect(e.weight).toBeGreaterThan(0);
  });

  it("produces an extractive summary and counts words", () => {
    expect(a.summary.length).toBeGreaterThan(0);
    expect(a.wordCount).toBeGreaterThan(20);
  });

  it("handles empty / tiny text without throwing", () => {
    const empty = analyzeChapter("");
    expect(empty.nodes).toEqual([]);
    expect(empty.edges).toEqual([]);
  });
});

describe("radialLayout", () => {
  it("places the first node at the center", () => {
    const pos = radialLayout(5, 300);
    expect(pos).toHaveLength(5);
    expect(pos[0]).toEqual({ x: 150, y: 150 });
  });

  it("returns nothing for zero nodes", () => {
    expect(radialLayout(0, 300)).toEqual([]);
  });
});
