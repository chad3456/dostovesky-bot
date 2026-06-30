// Pure helpers for the Marauder's Map magic layer (no DOM), so the geometry and
// content are unit-testable.

export interface Footstep {
  x: number;
  y: number;
  angle: number; // degrees, direction of travel
  foot: "left" | "right";
}

/**
 * Generate a walking path of footsteps from one random point to another across
 * a width×height area. Steps alternate left/right of the travel line, like real
 * footprints. `rand` is injectable for deterministic tests.
 */
export function generateWalkPath(
  width: number,
  height: number,
  steps = 14,
  rand: () => number = Math.random,
): Footstep[] {
  const ax = rand() * width;
  const ay = rand() * height;
  const bx = rand() * width;
  const by = rand() * height;
  const dx = bx - ax;
  const dy = by - ay;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  // Perpendicular unit vector for the left/right foot offset.
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const spread = 11;

  const out: Footstep[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1 || 1);
    const side = i % 2 === 0 ? 1 : -1;
    out.push({
      x: ax + dx * t + px * spread * side,
      y: ay + dy * t + py * spread * side,
      angle: angle + 90,
      foot: side === 1 ? "left" : "right",
    });
  }
  return out;
}

export const HAT_TIPS = [
  "Mischief managed. 🦶",
  "Psst — tap the 🎧 and I'll read to you.",
  "Highlight a line; I'll keep it safe in your book.",
  "Try the Vintage theme — it ages you beautifully.",
  "Open the 🕸️ map to see what a chapter is really about.",
  "Upload a tome. Any tome. I'm not picky.",
  "I solemnly swear you are up to some good reading.",
  "Swipe to turn the page, like the old days.",
];

export function pickTip(index: number): string {
  return HAT_TIPS[((index % HAT_TIPS.length) + HAT_TIPS.length) % HAT_TIPS.length];
}
