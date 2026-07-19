// Pure helpers for the Notes browser (sorting, filtering, pagination, and
// localStorage key parsing). Kept DOM-free so they're unit-testable.

export interface NoteItem {
  /** Unique react key across sources. */
  key: string;
  /** The highlight's own id (server id or local id). */
  id: string;
  /** localStorage key the note came from (absent for server notes). */
  storageKey?: string;
  source: "synced" | "shared" | "device";
  bookId: string;
  bookTitle: string;
  bookAuthor?: string | null;
  text: string;
  note: string | null;
  color: string;
  chapter: string | null;
  createdAt: string;
}

export type NoteSort =
  | "date-desc"
  | "date-asc"
  | "title-asc"
  | "title-desc"
  | "color";

export const NOTE_SORTS: { id: NoteSort; label: string }[] = [
  { id: "date-desc", label: "Newest first" },
  { id: "date-asc", label: "Oldest first" },
  { id: "title-asc", label: "Book title A–Z" },
  { id: "title-desc", label: "Book title Z–A" },
  { id: "color", label: "By color" },
];

export const NOTES_PER_PAGE = 50;

function ts(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/** Stable sort of notes by the chosen key (date is the tiebreak). */
export function sortNotes(notes: NoteItem[], sort: NoteSort): NoteItem[] {
  const byDateDesc = (a: NoteItem, b: NoteItem) => ts(b.createdAt) - ts(a.createdAt);
  const sorted = [...notes];
  switch (sort) {
    case "date-asc":
      sorted.sort((a, b) => ts(a.createdAt) - ts(b.createdAt));
      break;
    case "title-asc":
      sorted.sort(
        (a, b) => a.bookTitle.localeCompare(b.bookTitle) || byDateDesc(a, b),
      );
      break;
    case "title-desc":
      sorted.sort(
        (a, b) => b.bookTitle.localeCompare(a.bookTitle) || byDateDesc(a, b),
      );
      break;
    case "color":
      sorted.sort(
        (a, b) => a.color.localeCompare(b.color) || byDateDesc(a, b),
      );
      break;
    case "date-desc":
    default:
      sorted.sort(byDateDesc);
  }
  return sorted;
}

/** Case-insensitive match across passage, note, book title and chapter. */
export function filterNotes(notes: NoteItem[], query: string): NoteItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter((n) =>
    [n.text, n.note ?? "", n.bookTitle, n.chapter ?? ""]
      .join("\n")
      .toLowerCase()
      .includes(q),
  );
}

export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
}

/** Slice items into a page, clamping the requested page into range. */
export function paginate<T>(
  items: T[],
  page: number,
  perPage: number = NOTES_PER_PAGE,
): Page<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  return {
    items: items.slice((p - 1) * perPage, p * perPage),
    page: p,
    totalPages,
    total,
  };
}

const STORAGE_PREFIX = "lumen:highlights:";

/**
 * Parse a localStorage highlights key into its book reference.
 * "lumen:highlights:public:<id>" → shared-shelf book; any other suffix is a
 * this-device (IndexedDB) book id. Returns null for unrelated keys.
 */
export function parseHighlightStorageKey(
  key: string,
): { scope: "shared" | "device"; bookId: string } | null {
  if (!key.startsWith(STORAGE_PREFIX)) return null;
  const rest = key.slice(STORAGE_PREFIX.length);
  if (!rest) return null;
  if (rest.startsWith("public:")) {
    const bookId = rest.slice("public:".length);
    return bookId ? { scope: "shared", bookId } : null;
  }
  return { scope: "device", bookId: rest };
}
