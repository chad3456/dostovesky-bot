"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/fetcher";
import { LivePresence } from "@/components/presence/live-presence";
import { HIGHLIGHT_FILL } from "@/lib/reader-themes";
import { HIGHLIGHT_COLORS } from "@/lib/validation";
import {
  filterNotes,
  paginate,
  parseHighlightStorageKey,
  sortNotes,
  NOTE_SORTS,
  NOTES_PER_PAGE,
  type NoteItem,
  type NoteSort,
} from "@/lib/notes";
import type { Highlight } from "@/lib/types";

interface ServerHighlight extends Highlight {
  bookTitle: string;
  bookAuthor: string | null;
}

const SOURCE_BADGE: Record<NoteItem["source"], { label: string; cls: string }> = {
  synced: { label: "Synced", cls: "bg-brand-100 text-brand-800" },
  shared: { label: "Shared shelf", cls: "bg-teal-50 text-teal-800" },
  device: { label: "This device", cls: "bg-parchment-dark text-ink-soft" },
};

export function NotesClient() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<NoteSort>("date-desc");
  const [colors, setColors] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const collected: NoteItem[] = [];

    // 1) Synced notes (signed-in users). Silently absent when signed out.
    try {
      const d = await api<{ highlights: ServerHighlight[] }>("/api/highlights");
      for (const h of d.highlights) {
        collected.push({
          key: `synced:${h.id}`,
          id: h.id,
          source: "synced",
          bookId: h.bookId,
          bookTitle: h.bookTitle,
          bookAuthor: h.bookAuthor,
          text: h.text,
          note: h.note,
          color: h.color,
          chapter: h.chapter,
          createdAt: h.createdAt,
        });
      }
    } catch {
      /* not signed in / no server — fine */
    }

    // Book-title lookups for browser-stored notes.
    const sharedTitles = new Map<string, string>();
    try {
      const d = await api<{ books: { id: string; title: string }[] }>(
        "/api/public/books",
      );
      d.books.forEach((b) => sharedTitles.set(b.id, b.title));
    } catch {}
    const deviceTitles = new Map<string, string>();
    try {
      const { listBooks } = await import("@/lib/local-library");
      (await listBooks()).forEach((b) => deviceTitles.set(b.id, b.title));
    } catch {}

    // 2) Notes stored in this browser (shared-shelf and this-device books).
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (!storageKey) continue;
        const ref = parseHighlightStorageKey(storageKey);
        if (!ref) continue;
        let list: Highlight[] = [];
        try {
          list = JSON.parse(localStorage.getItem(storageKey) || "[]");
        } catch {
          continue;
        }
        if (!Array.isArray(list)) continue;
        const title =
          ref.scope === "shared"
            ? sharedTitles.get(ref.bookId) ?? "Shared book"
            : deviceTitles.get(ref.bookId) ?? "Book on this device";
        for (const h of list) {
          if (!h?.cfiRange || !h?.text) continue;
          collected.push({
            key: `${ref.scope}:${storageKey}:${h.id}`,
            id: h.id,
            storageKey,
            source: ref.scope,
            bookId: ref.bookId,
            bookTitle: title,
            text: h.text,
            note: h.note ?? null,
            color: h.color ?? "yellow",
            chapter: h.chapter ?? null,
            createdAt: h.createdAt ?? new Date(0).toISOString(),
          });
        }
      }
    } catch {}

    setNotes(collected);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Back to page 1 whenever the view changes shape.
  useEffect(() => {
    setPage(1);
  }, [query, sort, colors]);

  const view = useMemo(() => {
    let v = filterNotes(notes, query);
    if (colors.size) v = v.filter((n) => colors.has(n.color));
    return paginate(sortNotes(v, sort), page);
  }, [notes, query, sort, colors, page]);

  function toggleColor(c: string) {
    setColors((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  async function copyNote(n: NoteItem) {
    try {
      await navigator.clipboard.writeText(
        `“${n.text}”${n.note ? `\n— ${n.note}` : ""}\n(${n.bookTitle})`,
      );
      setCopiedKey(n.key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {}
  }

  async function deleteNote(n: NoteItem) {
    if (!confirm("Delete this note? This cannot be undone.")) return;
    setNotes((prev) => prev.filter((x) => x.key !== n.key));
    if (n.source === "synced") {
      api(`/api/highlights/${n.id}`, { method: "DELETE" }).catch(() => {});
    } else if (n.storageKey) {
      try {
        const list: Highlight[] = JSON.parse(
          localStorage.getItem(n.storageKey) || "[]",
        );
        localStorage.setItem(
          n.storageKey,
          JSON.stringify(list.filter((h) => h.id !== n.id)),
        );
      } catch {}
    }
  }

  return (
    <main className="min-h-[100dvh]">
      <header className="border-b border-parchment-border bg-parchment-light/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-brand-800">
              <span aria-hidden className="text-xl">📖</span>
              <span className="font-display text-3xl leading-none">Lumen</span>
            </Link>
            <LivePresence activity="notes" className="hidden md:flex" />
          </div>
          <Link
            href="/"
            className="rounded-full border border-parchment-border px-4 py-2 text-sm font-semibold text-ink transition hover:bg-parchment-light"
          >
            ← Back to shelves
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-5xl text-ink">Notes</h1>
        <hr className="vintage-rule my-2 max-w-xs" />
        <p className="text-sm italic text-ink-soft">
          {loading
            ? "Gathering your marginalia…"
            : `${view.total} note${view.total === 1 ? "" : "s"}${
                notes.length !== view.total ? ` (of ${notes.length})` : ""
              } · everything you've highlighted, in one place`}
        </p>

        {/* Controls */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, passages, books…"
            aria-label="Search notes"
            className="min-w-0 flex-1 rounded-xl border border-parchment-border bg-parchment-light px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand-500"
          />
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as NoteSort)}
              aria-label="Sort notes"
              className="rounded-xl border border-parchment-border bg-parchment-light px-3 py-2.5 text-sm text-ink"
            >
              {NOTE_SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1.5" role="group" aria-label="Filter by color">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleColor(c)}
                aria-pressed={colors.has(c)}
                aria-label={`Filter ${c}`}
                className={`h-6 w-6 rounded-full transition ${
                  colors.has(c)
                    ? "ring-2 ring-brand-600 ring-offset-1"
                    : "opacity-60 hover:opacity-100"
                }`}
                style={{ background: HIGHLIGHT_FILL[c] }}
              />
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="mt-8 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-parchment-dark/60" />
            ))}
          </div>
        ) : view.total === 0 ? (
          <div className="vintage-card mt-10 rounded-xl px-6 py-14 text-center">
            <div className="text-4xl" aria-hidden>🖋️</div>
            <h2 className="font-display mt-3 text-3xl text-ink">
              {notes.length === 0 ? "No notes yet" : "Nothing matches"}
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm italic text-ink-soft">
              {notes.length === 0
                ? "Select a passage while reading and pick a color — your highlights and notes will gather here."
                : "Try a different search or clear the color filters."}
            </p>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {view.items.map((n) => (
              <li key={n.key} className="vintage-card rounded-xl p-4">
                <div
                  className="pl-3"
                  style={{ borderLeft: `4px solid ${HIGHLIGHT_FILL[n.color] ?? "#fde047"}` }}
                >
                  <p className="text-[15px] leading-relaxed text-ink">“{n.text}”</p>
                  {n.note && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
                      {n.note}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                    <span className="font-semibold text-ink">{n.bookTitle}</span>
                    {n.chapter && <span>· {n.chapter}</span>}
                    <span>
                      ·{" "}
                      {new Date(n.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 ${SOURCE_BADGE[n.source].cls}`}>
                      {SOURCE_BADGE[n.source].label}
                    </span>
                    <span className="ml-auto flex gap-3">
                      <button
                        type="button"
                        onClick={() => copyNote(n)}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {copiedKey === n.key ? "Copied!" : "Copy"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNote(n)}
                        className="font-medium text-rose-700 hover:underline"
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Pagination (only when it earns its keep) */}
        {view.totalPages > 1 && (
          <nav
            className="mt-8 flex items-center justify-center gap-4"
            aria-label="Notes pages"
          >
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={view.page <= 1}
              className="rounded-full border border-parchment-border px-4 py-2 text-sm font-semibold text-ink transition hover:bg-parchment-light disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="text-sm tabular-nums text-ink-soft">
              Page {view.page} of {view.totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(view.totalPages, p + 1))}
              disabled={view.page >= view.totalPages}
              className="rounded-full border border-parchment-border px-4 py-2 text-sm font-semibold text-ink transition hover:bg-parchment-light disabled:opacity-40"
            >
              Next →
            </button>
          </nav>
        )}

        {view.total > NOTES_PER_PAGE && (
          <p className="mt-3 text-center text-xs text-ink-soft/70">
            Showing {NOTES_PER_PAGE} per page
          </p>
        )}
      </div>
    </main>
  );
}
