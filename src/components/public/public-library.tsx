"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/fetcher";
import { ReaderClient } from "@/components/reader/reader-client";

interface PublicBook {
  id: string;
  title: string;
  author: string | null;
  cover: string | null;
  createdAt: string;
}

export function PublicLibrary() {
  const [books, setBooks] = useState<PublicBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState<PublicBook | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ books: PublicBook[] }>("/api/public/books");
      setBooks(data.books);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load the library.");
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
          const form = new FormData();
          form.append("file", file);
          await api("/api/public/books", { method: "POST", body: form });
          added += 1;
        } catch (e) {
          setError(
            `${file.name}: ${e instanceof ApiError ? e.message : "upload failed"}`,
          );
        }
      }
      if (added) {
        setMessage(`Added ${added} book${added > 1 ? "s" : ""} for everyone.`);
        await refresh();
      }
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    },
    [refresh],
  );

  if (reading) {
    return (
      <ReaderClient
        title={reading.title}
        author={reading.author}
        fileUrl={`/api/public/books/${reading.id}/file`}
        localKey={`public:${reading.id}`}
        onBack={() => setReading(null)}
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
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {uploading ? "Adding…" : "＋ Upload EPUB"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900">Shared Library</h1>
        <p className="text-sm text-slate-500">
          {books.length} book{books.length === 1 ? "" : "s"} · anyone with this
          link can read and add books
        </p>

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
              <button
                key={b.id}
                type="button"
                onClick={() => setReading(b)}
                className="group text-left"
              >
                <div className="overflow-hidden rounded-xl bg-slate-200 shadow-sm ring-1 ring-slate-200 transition group-hover:shadow-md">
                  <div className="relative aspect-[2/3] w-full">
                    {b.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.cover}
                        alt={`Cover of ${b.title}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-500 to-indigo-700 p-3 text-center">
                        <span className="line-clamp-4 text-sm font-semibold text-white">
                          {b.title}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-medium leading-tight text-slate-800">
                  {b.title}
                </p>
                {b.author && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                    {b.author}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-slate-400">
          Books here are public to anyone with the link. Prefer a private library?{" "}
          <Link href="/login" className="underline hover:text-slate-600">
            Use a sync code
          </Link>{" "}
          or{" "}
          <Link href="/local" className="underline hover:text-slate-600">
            read on this device only
          </Link>
          .
        </p>
      </div>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-brand-600/10 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-brand-500 bg-white px-10 py-8 text-lg font-semibold text-brand-700">
            Drop your EPUB to share it 📚
          </div>
        </div>
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
        No books yet
      </h2>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Upload an EPUB and it will be available to everyone who opens this link.
        Drag a file anywhere, or use the button.
      </p>
      <button
        type="button"
        onClick={onUpload}
        className="mt-6 rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        ＋ Upload the first book
      </button>
    </div>
  );
}
