import { describe, it, expect } from "vitest";
import { generateWalkPath, pickTip, HAT_TIPS } from "@/lib/marauder";

describe("generateWalkPath", () => {
  it("produces the requested number of footsteps", () => {
    const path = generateWalkPath(1000, 800, 16);
    expect(path).toHaveLength(16);
  });

  it("alternates left and right feet", () => {
    const path = generateWalkPath(1000, 800, 6, () => 0.5);
    expect(path.map((s) => s.foot)).toEqual([
      "left",
      "right",
      "left",
      "right",
      "left",
      "right",
    ]);
  });

  it("keeps footsteps within a sane range of the area", () => {
    const path = generateWalkPath(500, 400, 20);
    for (const s of path) {
      expect(s.x).toBeGreaterThan(-50);
      expect(s.x).toBeLessThan(550);
      expect(s.y).toBeGreaterThan(-50);
      expect(s.y).toBeLessThan(450);
      expect(Number.isFinite(s.angle)).toBe(true);
    }
  });

  it("is deterministic with an injected rng", () => {
    const a = generateWalkPath(800, 600, 8, () => 0.25);
    const b = generateWalkPath(800, 600, 8, () => 0.25);
    expect(a).toEqual(b);
  });
});

describe("pickTip", () => {
  it("wraps around the tip list", () => {
    expect(pickTip(0)).toBe(HAT_TIPS[0]);
    expect(pickTip(HAT_TIPS.length)).toBe(HAT_TIPS[0]);
    expect(pickTip(HAT_TIPS.length + 1)).toBe(HAT_TIPS[1]);
  });
});
