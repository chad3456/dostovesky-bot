// Live-presence rules and copy. Pure functions — no DB, no DOM — so the
// windowing, aliasing and phrasing are all unit-testable.

/** A visitor counts as live while their last heartbeat is this recent. */
export const LIVE_WINDOW_MS = 60_000;
/** Clients heartbeat on this interval (comfortably inside the window). */
export const HEARTBEAT_MS = 20_000;
/** Rows older than this are pruned; keeps the table from growing forever. */
export const PRUNE_AFTER_MS = 10 * 60_000;

export type Activity = "browsing" | "reading" | "listening" | "notes";

export const ACTIVITIES: Activity[] = [
  "browsing",
  "reading",
  "listening",
  "notes",
];

export function isActivity(value: unknown): value is Activity {
  return typeof value === "string" && (ACTIVITIES as string[]).includes(value);
}

/** Is this heartbeat still inside the live window? */
export function isLive(lastSeen: Date, now: Date = new Date()): boolean {
  return now.getTime() - lastSeen.getTime() <= LIVE_WINDOW_MS;
}

// ─── Aliases ────────────────────────────────────────────────────────────────
// Anonymous visitors get a playful, stable pseudonym instead of a name. Nothing
// here identifies anyone: it is derived from a random per-browser token.

const ALIAS_FIRST = [
  "lowkey", "chronically", "feral", "cozy", "nocturnal", "unbothered",
  "delulu", "menace", "chaotic", "sleepy", "caffeinated", "unhinged",
  "sigma", "wholesome", "mysterious", "certified",
];

const ALIAS_SECOND = [
  "reader", "bookworm", "annotator", "lurker", "scholar", "gremlin",
  "academic", "romantic", "librarian", "highlighter", "page-turner",
  "night-owl", "critic", "dreamer", "archivist", "rereader",
];

/** Cheap stable hash so an alias never changes for a given token. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Deterministic pseudonym for a presence token, e.g. "feral annotator". */
export function aliasFor(token: string): string {
  const h = hash(token || "anon");
  const a = ALIAS_FIRST[h % ALIAS_FIRST.length];
  const b = ALIAS_SECOND[Math.floor(h / ALIAS_FIRST.length) % ALIAS_SECOND.length];
  return `${a} ${b}`;
}

// ─── Copy ───────────────────────────────────────────────────────────────────

/**
 * The headline count, in Gen Z register. `you` marks whether the viewer is
 * included in the count, so we can say "just you" instead of a bare "1".
 */
export function countLabel(count: number, opts: { you?: boolean } = {}): string {
  if (count <= 0) return "nobody here rn";
  if (count === 1) return opts.you ? "just you, locked in" : "1 locked in rn";
  return `${count} locked in rn`;
}

/** Short form for tight spaces, e.g. "12 online". */
export function countBadge(count: number): string {
  return `${Math.max(0, count)} online`;
}

export interface LiveReader {
  alias: string;
  activity: Activity;
  bookTitle: string | null;
}

/**
 * One line describing what somebody is doing. Deterministic given the reader
 * and a rotation index, so the ticker cycles rather than flickering randomly.
 */
export function activityLine(reader: LiveReader, rotation = 0): string {
  const { alias, activity, bookTitle } = reader;

  if (activity === "reading" && bookTitle) {
    const options = [
      `${alias} is locked in on ${bookTitle}`,
      `${alias} is deep in ${bookTitle}`,
      `${alias} is lowkey obsessed with ${bookTitle}`,
      `${alias} has ${bookTitle} open rn`,
      `${alias} is eating up ${bookTitle}`,
    ];
    return options[Math.abs(rotation) % options.length];
  }
  if (activity === "listening" && bookTitle) {
    const options = [
      `${alias} has ${bookTitle} in their ears`,
      `${alias} is listening to ${bookTitle}`,
      `${alias} is on audio mode with ${bookTitle}`,
    ];
    return options[Math.abs(rotation) % options.length];
  }
  if (activity === "notes") {
    const options = [
      `${alias} is going through their notes`,
      `${alias} is rereading their own highlights`,
      `${alias} is annotating like it's finals week`,
    ];
    return options[Math.abs(rotation) % options.length];
  }
  const options = [
    `${alias} is judging covers rn`,
    `${alias} is browsing the shelves`,
    `${alias} is deciding what's next`,
    `${alias} just pulled up`,
  ];
  return options[Math.abs(rotation) % options.length];
}

/**
 * Pick which live reader to feature, rotating through everyone who is doing
 * something worth showing (a book beats idle browsing).
 */
export function featuredReader(
  readers: LiveReader[],
  rotation = 0,
): LiveReader | null {
  if (!readers.length) return null;
  const withBook = readers.filter((r) => Boolean(r.bookTitle));
  const pool = withBook.length ? withBook : readers;
  return pool[Math.abs(rotation) % pool.length];
}
