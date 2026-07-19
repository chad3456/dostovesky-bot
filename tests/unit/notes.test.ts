import { describe, it, expect } from "vitest";
import {
  sortNotes,
  filterNotes,
  paginate,
  parseHighlightStorageKey,
  NOTES_PER_PAGE,
  type NoteItem,
} from "@/lib/notes";

function note(over: Partial<NoteItem>): NoteItem {
  return {
    key: over.key ?? Math.random().toString(36),
    id: "id",
    source: "device",
    bookId: "b",
    bookTitle: "Book",
    text: "text",
    note: null,
    color: "yellow",
    chapter: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("sortNotes", () => {
  const a = note({ key: "a", bookTitle: "Anna Karenina", createdAt: "2026-01-03T00:00:00Z" });
  const b = note({ key: "b", bookTitle: "Crime and Punishment", createdAt: "2026-01-01T00:00:00Z", color: "blue" });
  const c = note({ key: "c", bookTitle: "Brothers Karamazov", createdAt: "2026-01-02T00:00:00Z" });

  it("newest first by default", () => {
    expect(sortNotes([b, a, c], "date-desc").map((n) => n.key)).toEqual(["a", "c", "b"]);
  });
  it("oldest first", () => {
    expect(sortNotes([a, b, c], "date-asc").map((n) => n.key)).toEqual(["b", "c", "a"]);
  });
  it("book title A–Z and Z–A", () => {
    expect(sortNotes([c, b, a], "title-asc").map((n) => n.bookTitle[0])).toEqual(["A", "B", "C"]);
    expect(sortNotes([a, b, c], "title-desc").map((n) => n.bookTitle[0])).toEqual(["C", "B", "A"]);
  });
  it("groups by color", () => {
    expect(sortNotes([a, b], "color")[0].color).toBe("blue");
  });
  it("does not mutate the input", () => {
    const input = [a, b, c];
    sortNotes(input, "title-asc");
    expect(input.map((n) => n.key)).toEqual(["a", "b", "c"]);
  });
});

describe("filterNotes", () => {
  const notes = [
    note({ key: "1", text: "It was the best of times", bookTitle: "Two Cities" }),
    note({ key: "2", text: "Call me Ishmael", note: "great opener", bookTitle: "Moby Dick" }),
    note({ key: "3", text: "whale facts", chapter: "Cetology", bookTitle: "Moby Dick" }),
  ];
  it("matches passage, note, title and chapter, case-insensitively", () => {
    expect(filterNotes(notes, "ISHMAEL").map((n) => n.key)).toEqual(["2"]);
    expect(filterNotes(notes, "opener").map((n) => n.key)).toEqual(["2"]);
    expect(filterNotes(notes, "moby").map((n) => n.key)).toEqual(["2", "3"]);
    expect(filterNotes(notes, "cetology").map((n) => n.key)).toEqual(["3"]);
  });
  it("returns everything for a blank query", () => {
    expect(filterNotes(notes, "  ")).toHaveLength(3);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 120 }, (_, i) => i);

  it("uses 50 per page by default", () => {
    const p1 = paginate(items, 1);
    expect(NOTES_PER_PAGE).toBe(50);
    expect(p1.items).toHaveLength(50);
    expect(p1.totalPages).toBe(3);
    expect(paginate(items, 3).items).toHaveLength(20);
  });
  it("clamps out-of-range pages", () => {
    expect(paginate(items, 99).page).toBe(3);
    expect(paginate(items, -4).page).toBe(1);
  });
  it("handles fewer than one page without pagination pressure", () => {
    const p = paginate([1, 2, 3], 1);
    expect(p.totalPages).toBe(1);
    expect(p.items).toEqual([1, 2, 3]);
  });
});

describe("parseHighlightStorageKey", () => {
  it("recognizes shared-shelf and device keys", () => {
    expect(parseHighlightStorageKey("lumen:highlights:public:abc")).toEqual({
      scope: "shared",
      bookId: "abc",
    });
    expect(parseHighlightStorageKey("lumen:highlights:xyz-123")).toEqual({
      scope: "device",
      bookId: "xyz-123",
    });
  });
  it("rejects unrelated or malformed keys", () => {
    expect(parseHighlightStorageKey("lumen:prefs")).toBeNull();
    expect(parseHighlightStorageKey("lumen:highlights:")).toBeNull();
    expect(parseHighlightStorageKey("lumen:highlights:public:")).toBeNull();
  });
});
