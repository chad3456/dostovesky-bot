"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addBook,
  listBooks,
  getBookData,
  deleteBook,
  type LocalBook,
} from "@/lib/local-library";
import { ReaderClient } from "@/components/reader/reader-client";

type Reading = { book: LocalBook; data: ArrayBuffer };

export function LocalApp() {
  const [books, setBooks] = useState<LocalBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState<Reading | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setBooks(await listBooks());
    } catch {
      setError("Couldn't open your local library on this browser.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) =>
        f.name.toLowerCase().endsWith(".epub"),
      );
      if (!list.length) {
        setMessage("Please choose an .epub file.");
        return;
      }
      setUploading(true);
      setError(null);
      setMessage(null);
      let added = 0;
      for (const file of list) {
        try {
          await addBook(file);
          added += 1;
        } catch {
          setError(`Couldn't add ${file.name}.`);
        }
      }
      if (added) {
        setMessage(`Added ${added} book${added > 1 ? "s" : ""}.`);
        await refresh();
      }
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    },
    [refresh],
  );

  const open = useCallback(async (book: LocalBook) => {
    const data = await getBookData(book.id);
    if (!data) {
      setError("That book's file is missing. Try re-uploading it.");
      return;
    }
    setReading({ book, data });
  }, []);

  async function remove(book: LocalBook) {
    if (!confirm(`Remove “${book.title}” from this device?`)) return;
    const prev = books;
    setBooks((b) => b.filter((x) => x.id !== book.id));
    try {
      await deleteBook(book.id);
    } catch {
      setBooks(prev);
      setError("Couldn't remove that book.");
    }
  }

  if (reading) {
    return (
      <ReaderClient
        title={reading.book.title}
        author={reading.book.author}
        data={reading.data}
        localKey={reading.book.id}
        onBack={() => {
          setReading(null);
          refresh();
        }}
      />
    );
  }

  return (
    <main
      className="min-h-[100dvh] bg-slate-50"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer?.files?.length) upload(e.dataTransfer.files);
      }}
    >
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-lg font-bold text-brand-700">
            <span aria-hidden>📖</span> Lumen
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".epub,application/epub+zip"
            multiple
            hidden
            onChange={(e) => e.target.files && upload(e.target.files)}
            data-testid="file-input"
          />
          <div className="flex items-center gap-2">
            <a
              href="/login"
              className="hidden rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:inline-block"
              title="Sync your library across devices with a sync code"
            >
              ☁️ Sync across devices
            </a>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {uploading ? "Adding…" : "＋ Upload EPUB"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your Library</h1>
          <p className="text-sm text-slate-500">
            {books.length} book{books.length === 1 ? "" : "s"} · stored on this
            device — no account needed
          </p>
        </div>

        {message && (
          <p role="status" className="mt-4 rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-700">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        {loading ? (
          <GridSkeleton />
        ) : books.length === 0 ? (
          <EmptyState onUpload={() => inputRef.current?.click()} />
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {books.map((b) => (
              <Card key={b.id} book={b} onOpen={() => open(b)} onRemove={() => remove(b)} />
            ))}
          </div>
        )}
      </div>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-brand-600/10 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-brand-500 bg-white px-10 py-8 text-lg font-semibold text-brand-700">
            Drop your EPUB to add it 📚
          </div>
        </div>
      )}
    </main>
  );
}

function Card({
  book,
  onOpen,
  onRemove,
}: {
  book: LocalBook;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full overflow-hidden rounded-xl bg-slate-200 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md"
      >
        <div className="relative aspect-[2/3] w-full">
          {book.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.cover}
              alt={`Cover of ${book.title}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-500 to-indigo-700 p-3 text-center">
              <span className="line-clamp-4 text-sm font-semibold text-white">
                {book.title}
              </span>
            </div>
          )}
        </div>
      </button>
      <button
        type="button"
        aria-label="Remove book"
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
      >
        ✕
      </button>
      <div className="mt-2 px-0.5">
        <p className="line-clamp-2 text-sm font-medium leading-tight text-slate-800">
          {book.title}
        </p>
        {book.author && (
          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{book.author}</p>
        )}
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[2/3] rounded-xl bg-slate-200" />
          <div className="mt-2 h-3 w-3/4 rounded bg-slate-200" />
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
        Upload an EPUB to start reading. Drag a file anywhere on this page, or
        use the button. Your books stay on this device.
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
