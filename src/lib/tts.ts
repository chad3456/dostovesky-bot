// Pure helpers for the read-aloud (text-to-speech) feature. Kept free of any
// browser APIs so they can be unit-tested.

/** Collapse whitespace/newlines into single spaces and trim. */
export function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

const MAX_CHUNK = 240;

/**
 * Split text into speakable chunks. Sentences are kept whole where possible;
 * very long sentences are broken on commas/spaces so the speech engine doesn't
 * choke or cut off (a known issue with long utterances).
 */
export function splitIntoSentences(text: string): string[] {
  const clean = cleanText(text);
  if (!clean) return [];

  const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [clean];

  const out: string[] = [];
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length <= MAX_CHUNK) {
      out.push(s);
      continue;
    }
    // Break an over-long sentence into <= MAX_CHUNK pieces on word boundaries.
    let current = "";
    for (const word of s.split(" ")) {
      if ((current + " " + word).trim().length > MAX_CHUNK) {
        if (current) out.push(current.trim());
        current = word;
      } else {
        current = current ? `${current} ${word}` : word;
      }
    }
    if (current.trim()) out.push(current.trim());
  }
  return out;
}
