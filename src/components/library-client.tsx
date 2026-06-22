"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/fetcher";
import type { BookSummary } from "@/lib/types";
import { BookCard } from "@/components/book-card";
import { ShareDialog } from "@/components/share-dialog";

export function LibraryClient() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [shareBook, setShareBook] = useState<BookSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api<{ books: BookSummary[] }>("/api/books");
      setBooks(data.books);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load your library.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) =>
        f.name.toLowerCase().endsWith(".epub"),
      );
      if (list.length === 0) {
        setUploadMsg("Please choose an .epub file.");
        return;
      }
      setUploading(true);
      setUploadMsg(null);
      let ok = 0;
      for (const file of list) {
        try {
          const form = new FormData();
          form.append("file", file);
          await api("/api/books", { method: "POST", body: form });
          ok += 1;
        } catch (e) {
          setUploadMsg(
            `${file.name}: ${e instanceof ApiError ? e.message : "upload failed"}`,
          );
        }
      }
      if (ok > 0) {
        setUploadMsg(`Added ${ok} book${ok > 1 ? "s" : ""} to your library.`);
        await load();
      }
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    },
    [load],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer?.files?.length) uploadFiles(e.dataTransfer.files);
    },
    [uploadFiles],
  );

  async function handleDelete(book: BookSummary) {
    if (!confirm(`Remove “${book.title}” from your library? This cannot be undone.`)) {
      return;
    }
    // Optimistic removal
    const prev = books;
    setBooks((b) => b.filter((x) => x.id !== book.id));
    try {
      await api(`/api/books/${book.id}`, { method: "DELETE" });
    } catch {
      setBooks(prev);
      setError("Could not delete that book. Please try again.");
    }
  }

  return (
    <main
      className="mx-auto max-w-6xl px-4 py-8 sm:px-6"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your Library</h1>
          <p className="text-sm text-slate-500">
            {books.length} book{books.length === 1 ? "" : "s"} · read anywhere,
            anytime
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".epub,application/epub+zip"
            multiple
            hidden
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            data-testid="file-input"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {uploading ? "Uploading…" : "＋ Upload EPUB"}
          </button>
        </div>
      </div>

      {uploadMsg && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-700"
        >
          {uploadMsg}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-brand-600/10 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-brand-500 bg-white px-10 py-8 text-lg font-semibold text-brand-700">
            Drop your EPUB to add it 📚
          </div>
        </div>
      )}

      {loading ? (
        <GridSkeleton />
      ) : books.length === 0 ? (
        <EmptyState onUpload={() => inputRef.current?.click()} />
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {books.map((b) => (
            <BookCard
              key={b.id}
              book={b}
              onDelete={() => handleDelete(b)}
              onShare={() => setShareBook(b)}
            />
          ))}
        </div>
      )}

      {shareBook && (
        <ShareDialog book={shareBook} onClose={() => setShareBook(null)} />
      )}
    </main>
  );
}

function GridSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[2/3] rounded-xl bg-slate-200" />
          <div className="mt-2 h-3 w-3/4 rounded bg-slate-200" />
          <div className="mt-1 h-3 w-1/2 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="mt-16 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center">
      <div className="text-5xl" aria-hidden>
        📚
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-800">
        Your library is empty
      </h2>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Upload an EPUB to start reading. You can drag a file anywhere on this
        page, or use the button below.
      </p>
      <button
        type="button"
        onClick={onUpload}
        className="mt-6 rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        ＋ Upload your first book
      </button>
    </div>
  );
}
