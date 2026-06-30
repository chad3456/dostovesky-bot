// An ORIGINAL, royalty-free "music-box" phrase (NOT Hedwig's Theme, which is
// copyrighted). Pure data + helpers so the melody is unit-testable; the actual
// sound is synthesized in the browser by music-toggle.tsx.

export interface SongNote {
  /** semitones relative to A4 (440 Hz) */
  semis: number;
  /** start time in beats */
  beat: number;
  /** duration in beats */
  dur: number;
  /** relative loudness 0..1 */
  gain: number;
}

export function noteFreq(semisFromA4: number): number {
  return 440 * Math.pow(2, semisFromA4 / 12);
}

// A gentle, wistful arpeggio in E minor with a lilting 3-beat feel. Original.
export const PHRASE: SongNote[] = [
  { semis: -5, beat: 0, dur: 1, gain: 0.9 }, // E4
  { semis: -2, beat: 1, dur: 1, gain: 0.7 }, // G4
  { semis: 2, beat: 2, dur: 1.5, gain: 0.85 }, // B4
  { semis: 3, beat: 3.5, dur: 0.5, gain: 0.6 }, // C5
  { semis: 2, beat: 4, dur: 1, gain: 0.7 }, // B4
  { semis: -2, beat: 5, dur: 1, gain: 0.6 }, // G4
  { semis: 0, beat: 6, dur: 2, gain: 0.8 }, // A4
  { semis: -5, beat: 8, dur: 1, gain: 0.7 }, // E4
  { semis: 2, beat: 9, dur: 1, gain: 0.7 }, // B4
  { semis: 7, beat: 10, dur: 2, gain: 0.9 }, // E5 (sparkle)
  { semis: 5, beat: 11.5, dur: 0.5, gain: 0.5 }, // D5
  { semis: 2, beat: 12, dur: 2, gain: 0.7 }, // B4
];

/** Total length of the phrase in beats (loop point). */
export function phraseBeats(phrase: SongNote[] = PHRASE): number {
  return phrase.reduce((max, n) => Math.max(max, n.beat + n.dur), 0);
}
