// Pure helpers for EpubCast scripts: the two-host format, dialogue parsing,
// and duration math. No network or DOM, so all of it is unit-testable.

export interface DialogueTurn {
  /** "A" = Nora (host//analyst), "B" = Julian (curious co-host). */
  speaker: "A" | "B";
  text: string;
}

export interface ResearchSource {
  title: string;
  url: string;
}

export interface Research {
  brief: string;
  sources: ResearchSource[];
}

export const HOSTS = {
  A: { key: "A" as const, name: "Nora", role: "literary analyst" },
  B: { key: "B" as const, name: "Julian", role: "curious co-host" },
};

/** Conversational podcast delivery, words per minute. */
export const WORDS_PER_MINUTE = 150;

/** Target episode length. The script is sized to land inside this window. */
export const TARGET_MINUTES = { min: 20, max: 25 };

/** Four segments of ~900 words ≈ 3,600 words ≈ 24 minutes. */
export const SEGMENT_COUNT = 4;
export const WORDS_PER_SEGMENT = 900;

export const SEGMENT_BRIEFS: string[] = [
  "Cold open and orientation: hook the listener, introduce the chapter, and lay out what actually happens in it.",
  "Close reading: walk through the chapter's key passages, turns and craft — quote a few short lines and dig into them.",
  "Wider conversation: connect the chapter to how people discuss this book and its themes online, and to the broader tradition.",
  "Themes, disagreement and close: argue a little, land the big ideas, and send the listener into the next chapter.",
];

const SPEAKER_LINE =
  /^\s*(?:\*\*|__)?\s*(NORA|JULIAN|HOST\s*A|HOST\s*B|A|B)\s*(?:\*\*|__)?\s*:\s*(.*)$/i;

function speakerOf(label: string): "A" | "B" {
  const l = label.toUpperCase().replace(/\s+/g, "");
  return l === "NORA" || l === "HOSTA" || l === "A" ? "A" : "B";
}

/** Remove stage directions and stray markdown emphasis from spoken text. */
function cleanSpoken(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\((?:laughs|laughing|pause|beat|chuckles)[^)]*\)/gi, " ")
    .replace(/(\*\*|__|\*|_)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a model-written script into dialogue turns. Tolerates markdown bold,
 * alternate speaker labels, blank lines and wrapped paragraphs (a line with no
 * speaker continues the previous turn).
 */
export function parseDialogue(raw: string): DialogueTurn[] {
  const turns: DialogueTurn[] = [];
  for (const line of (raw || "").split(/\r?\n/)) {
    const m = line.match(SPEAKER_LINE);
    if (m) {
      const text = cleanSpoken(m[2]);
      if (text) turns.push({ speaker: speakerOf(m[1]), text });
      continue;
    }
    const cont = cleanSpoken(line);
    if (cont && turns.length) {
      turns[turns.length - 1].text += ` ${cont}`;
    }
  }
  return turns;
}

export function countWords(turns: DialogueTurn[]): number {
  return turns.reduce(
    (n, t) => n + t.text.split(/\s+/).filter(Boolean).length,
    0,
  );
}

/** Estimated spoken duration in seconds. */
export function estimateSeconds(words: number): number {
  return Math.round((words / WORDS_PER_MINUTE) * 60);
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.abs(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Alternate the opening speaker per segment so hand-offs feel natural. */
export function openingSpeaker(segmentIndex: number): "A" | "B" {
  return segmentIndex % 2 === 0 ? "A" : "B";
}

/**
 * Trim a chapter to a token-sane excerpt for prompting, keeping the opening
 * and the ending (where chapters usually turn) when it must be cut.
 */
export function excerptForPrompt(text: string, maxWords = 6000): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  const head = words.slice(0, Math.floor(maxWords * 0.7)).join(" ");
  const tail = words.slice(-Math.floor(maxWords * 0.3)).join(" ");
  return `${head}\n\n[... middle of the chapter omitted for length ...]\n\n${tail}`;
}
