import { describe, it, expect } from "vitest";
import { PHRASE, phraseBeats, noteFreq } from "@/lib/spell-song";

describe("noteFreq", () => {
  it("returns 440Hz for A4 (0 semitones)", () => {
    expect(noteFreq(0)).toBeCloseTo(440, 5);
  });
  it("doubles an octave up", () => {
    expect(noteFreq(12)).toBeCloseTo(880, 5);
  });
  it("halves an octave down", () => {
    expect(noteFreq(-12)).toBeCloseTo(220, 5);
  });
});

describe("PHRASE", () => {
  it("has only audible, positive frequencies", () => {
    for (const n of PHRASE) {
      const f = noteFreq(n.semis);
      expect(f).toBeGreaterThan(80);
      expect(f).toBeLessThan(2000);
      expect(n.dur).toBeGreaterThan(0);
      expect(n.gain).toBeGreaterThan(0);
      expect(n.gain).toBeLessThanOrEqual(1);
    }
  });

  it("computes a positive loop length covering all notes", () => {
    const beats = phraseBeats();
    expect(beats).toBeGreaterThan(0);
    for (const n of PHRASE) expect(n.beat + n.dur).toBeLessThanOrEqual(beats);
  });
});
