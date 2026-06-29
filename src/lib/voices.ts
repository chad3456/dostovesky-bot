// Heuristics for picking a pleasant female narration voice from the Web Speech
// API. There's no standard gender field on SpeechSynthesisVoice, so we match on
// well-known voice names across macOS/iOS, Android (Google) and Windows.

export interface VoiceLike {
  name: string;
  lang: string;
  voiceURI: string;
  default?: boolean;
  localService?: boolean;
}

// Common female voice names by platform.
const FEMALE_NAMES = [
  "samantha", "ava", "serena", "allison", "susan", "victoria", "karen",
  "moira", "tessa", "fiona", "kate", "catherine", "amelie", "anna", "ellen",
  "zoe", "zoë", "nicky", "sandy", "shelley", "veena", "heather", "linda",
  "joana", "luciana", "paulina", "alice", "carmit", "damayanti", "ioana",
  "laura", "lekha", "mariska", "melina", "milena", "nora", "sara", "yuna",
  "sin-ji", "ting-ting", "google uk english female", "zira", "hazel", "eva",
  "female", "woman", "girl",
];

// Voices we consider especially natural/pleasant, in preference order.
const PREMIUM_FEMALE = [
  "ava", "samantha", "serena", "zoe", "allison", "joana", "google uk english female",
];

function lc(s: string): string {
  return s.toLowerCase();
}

export function isLikelyFemale(voice: VoiceLike): boolean {
  const name = lc(voice.name);
  return FEMALE_NAMES.some((n) => name.includes(n));
}

function langMatches(voice: VoiceLike, lang: string): boolean {
  if (!lang) return true;
  return lc(voice.lang).startsWith(lc(lang).slice(0, 2));
}

/**
 * Choose a default narration voice: a natural female voice in the reader's
 * language if possible, otherwise any female voice, otherwise the system
 * default. Returns the voiceURI or null.
 */
export function pickDefaultVoice(
  voices: VoiceLike[],
  lang = "en",
): string | null {
  if (!voices.length) return null;
  const inLang = voices.filter((v) => langMatches(v, lang));
  const pool = inLang.length ? inLang : voices;

  // 1) Premium female by name priority.
  for (const pref of PREMIUM_FEMALE) {
    const hit = pool.find((v) => lc(v.name).includes(pref));
    if (hit) return hit.voiceURI;
  }
  // 2) Any female.
  const female = pool.find(isLikelyFemale);
  if (female) return female.voiceURI;
  // 3) System default / first available.
  return (pool.find((v) => v.default) ?? pool[0]).voiceURI;
}

/**
 * Order voices for a picker: matching-language first, female before others,
 * then alphabetical. Pure — safe to unit test.
 */
export function sortVoicesForPicker<T extends VoiceLike>(
  voices: T[],
  lang = "en",
): T[] {
  return [...voices].sort((a, b) => {
    const la = langMatches(a, lang) ? 0 : 1;
    const lb = langMatches(b, lang) ? 0 : 1;
    if (la !== lb) return la - lb;
    const fa = isLikelyFemale(a) ? 0 : 1;
    const fb = isLikelyFemale(b) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return a.name.localeCompare(b.name);
  });
}
