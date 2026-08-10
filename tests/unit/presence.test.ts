import { describe, it, expect } from "vitest";
import {
  LIVE_WINDOW_MS,
  HEARTBEAT_MS,
  aliasFor,
  activityLine,
  countBadge,
  countLabel,
  featuredReader,
  isActivity,
  isLive,
  type LiveReader,
} from "@/lib/presence";

describe("live window", () => {
  it("heartbeats more often than the window, so nobody flickers out", () => {
    expect(HEARTBEAT_MS).toBeLessThan(LIVE_WINDOW_MS);
  });

  it("counts a recent heartbeat as live and an old one as gone", () => {
    const now = new Date("2026-08-10T12:00:00Z");
    expect(isLive(new Date(now.getTime() - 5_000), now)).toBe(true);
    expect(isLive(new Date(now.getTime() - LIVE_WINDOW_MS + 1), now)).toBe(true);
    expect(isLive(new Date(now.getTime() - LIVE_WINDOW_MS - 1), now)).toBe(false);
  });
});

describe("isActivity", () => {
  it("accepts the known activities and rejects anything else", () => {
    expect(isActivity("reading")).toBe(true);
    expect(isActivity("listening")).toBe(true);
    expect(isActivity("hacking")).toBe(false);
    expect(isActivity(42)).toBe(false);
    expect(isActivity(undefined)).toBe(false);
  });
});

describe("aliasFor", () => {
  it("is stable for a token, so a visitor keeps the same alias", () => {
    expect(aliasFor("token-abc")).toBe(aliasFor("token-abc"));
  });

  it("gives different tokens different aliases", () => {
    const aliases = new Set(
      Array.from({ length: 40 }, (_, i) => aliasFor(`token-${i}`)),
    );
    // Collisions are possible but should be rare across 40 tokens.
    expect(aliases.size).toBeGreaterThan(25);
  });

  it("reads as two friendly words and leaks nothing from the token", () => {
    const alias = aliasFor("super-secret-token-value");
    expect(alias.split(" ")).toHaveLength(2);
    expect(alias).not.toContain("secret");
  });
});

describe("countLabel", () => {
  it("uses Gen Z phrasing with the real number", () => {
    expect(countLabel(12)).toBe("12 locked in rn");
    expect(countLabel(2)).toBe("2 locked in rn");
  });

  it("says 'just you' when the viewer is the only one here", () => {
    expect(countLabel(1, { you: true })).toBe("just you, locked in");
    expect(countLabel(1)).toBe("1 locked in rn");
  });

  it("handles an empty room without inventing anyone", () => {
    expect(countLabel(0)).toBe("nobody here rn");
    expect(countLabel(-3)).toBe("nobody here rn");
  });

  it("never reports more than it was given", () => {
    for (const n of [0, 1, 5, 99]) {
      const label = countLabel(n);
      const shown = Number(label.match(/\d+/)?.[0] ?? n);
      expect(shown).toBeLessThanOrEqual(Math.max(n, 1));
    }
    expect(countBadge(7)).toBe("7 online");
    expect(countBadge(-1)).toBe("0 online");
  });
});

describe("activityLine", () => {
  const reading: LiveReader = {
    alias: "feral annotator",
    activity: "reading",
    bookTitle: "Crime and Punishment",
  };

  it("says who is reading what", () => {
    const line = activityLine(reading, 0);
    expect(line).toContain("feral annotator");
    expect(line).toContain("Crime and Punishment");
  });

  it("rotates through different phrasings for the same reader", () => {
    const lines = new Set(
      Array.from({ length: 5 }, (_, i) => activityLine(reading, i)),
    );
    expect(lines.size).toBeGreaterThan(1);
  });

  it("is deterministic for a given rotation", () => {
    expect(activityLine(reading, 3)).toBe(activityLine(reading, 3));
  });

  it("describes listening, notes and browsing distinctly", () => {
    const listen = activityLine({ ...reading, activity: "listening" }, 0);
    expect(listen).toMatch(/listening|ears|audio/i);

    const notes = activityLine(
      { alias: "cozy scholar", activity: "notes", bookTitle: null },
      0,
    );
    expect(notes).toMatch(/notes|highlights|annotat/i);

    const browse = activityLine(
      { alias: "sleepy lurker", activity: "browsing", bookTitle: null },
      0,
    );
    expect(browse).toMatch(/covers|browsing|deciding|pulled up/i);
  });

  it("never claims a book when there isn't one", () => {
    const line = activityLine(
      { alias: "lowkey reader", activity: "reading", bookTitle: null },
      0,
    );
    expect(line).not.toMatch(/locked in on\s*$/);
    expect(line).toMatch(/covers|browsing|deciding|pulled up/i);
  });

  it("handles a negative rotation without crashing", () => {
    expect(activityLine(reading, -4)).toContain("feral annotator");
  });
});

describe("featuredReader", () => {
  const withBook: LiveReader = {
    alias: "a",
    activity: "reading",
    bookTitle: "Ulysses",
  };
  const browsing: LiveReader = {
    alias: "b",
    activity: "browsing",
    bookTitle: null,
  };

  it("prefers somebody who is actually in a book", () => {
    for (let i = 0; i < 4; i++) {
      expect(featuredReader([browsing, withBook], i)?.alias).toBe("a");
    }
  });

  it("falls back to browsers when nobody is reading", () => {
    expect(featuredReader([browsing], 0)?.alias).toBe("b");
  });

  it("returns null for an empty room", () => {
    expect(featuredReader([], 0)).toBeNull();
  });

  it("rotates across multiple readers", () => {
    const readers: LiveReader[] = [
      { alias: "one", activity: "reading", bookTitle: "A" },
      { alias: "two", activity: "reading", bookTitle: "B" },
    ];
    expect(featuredReader(readers, 0)?.alias).toBe("one");
    expect(featuredReader(readers, 1)?.alias).toBe("two");
  });
});
