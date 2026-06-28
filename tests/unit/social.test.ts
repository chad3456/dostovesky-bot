import { describe, it, expect } from "vitest";
import { buildSocialLinks } from "@/lib/social";

describe("buildSocialLinks", () => {
  it("returns Goodreads, Reddit, Substack and topic groups", () => {
    const ids = buildSocialLinks("Meditations", "Marcus Aurelius").map((g) => g.id);
    expect(ids).toEqual(["goodreads", "reddit", "substack", "topics"]);
  });

  it("url-encodes the title and author into queries", () => {
    const groups = buildSocialLinks("Crime and Punishment", "Dostoevsky");
    const all = groups.flatMap((g) => g.items.map((i) => i.url));

    const goodreadsQuotes = all.find((u) => u.includes("goodreads.com/quotes"));
    expect(goodreadsQuotes).toContain("Crime%20and%20Punishment");

    const reddit = all.find((u) => u.includes("reddit.com/search"));
    expect(reddit).toContain("Crime%20and%20Punishment%20Dostoevsky");

    const substack = all.find((u) => u.includes("substack.com/search"));
    expect(substack).toBeTruthy();

    expect(all.some((u) => u.includes("plato.stanford.edu"))).toBe(true);
  });

  it("works when the author is missing", () => {
    const groups = buildSocialLinks("Anonymous Work", null);
    const urls = groups.flatMap((g) => g.items.map((i) => i.url));
    expect(urls.every((u) => /^https:\/\//.test(u))).toBe(true);
    // No trailing encoded separators from a null author.
    expect(urls.some((u) => u.includes("undefined"))).toBe(false);
  });

  it("every item has a label and an absolute https url", () => {
    for (const g of buildSocialLinks("X", "Y")) {
      for (const item of g.items) {
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.url).toMatch(/^https:\/\//);
      }
    }
  });
});
