"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { api, ApiError } from "@/lib/fetcher";
import { ReaderClient } from "@/components/reader/reader-client";

// The Marauder's-Map magic layer (GSAP + Three.js) is client-only and lazy.
const MagicLayer = dynamic(
  () => import("@/components/magic/magic-layer").then((m) => m.MagicLayer),
  { ssr: false },
);

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
      className="min-h-[100dvh]"
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
      <header className="border-b border-parchment-border bg-parchment-light/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-brand-800">
            <span aria-hidden className="text-xl">📖</span>
            <span className="font-display text-3xl leading-none">Lumen</span>
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
            <Link
              href="/notes"
              className="rounded-full border border-parchment-border px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-parchment-light"
              title="Browse all your highlights and notes"
            >
              🗒 Notes
            </Link>
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

      {/* ───────── Hero ───────── */}
      <section className="relative mx-auto max-w-5xl px-6 pb-10 pt-20 text-center sm:pt-28">
        <p
          className="reveal-up text-xs font-semibold uppercase tracking-[0.35em] text-brand-700"
          style={{ animationDelay: "0.05s" }}
        >
          Est. MMXXV · A Digital Reading Room
        </p>
        <h1
          className="reveal-up font-display mt-4 text-6xl leading-[0.95] text-ink sm:text-8xl"
          style={{ animationDelay: "0.15s" }}
        >
          Read like it&apos;s 1789.
        </h1>
        <p
          className="reveal-up mx-auto mt-6 max-w-xl text-lg italic leading-relaxed text-ink-soft"
          style={{ animationDelay: "0.3s" }}
        >
          A quiet, beautiful library for your books — with listening, highlights,
          and the soul of an old paper edition.
        </p>
        <div
          className="reveal-up mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ animationDelay: "0.45s" }}
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-full bg-brand-700 px-8 py-3 text-base font-semibold text-parchment-light shadow-lg shadow-brand-900/20 transition hover:-translate-y-0.5 hover:bg-brand-800 disabled:opacity-60"
          >
            {uploading ? "Adding…" : "Upload a book"}
          </button>
          <a
            href="#shelves"
            className="rounded-full border border-brand-700/40 px-8 py-3 text-base font-semibold text-brand-800 transition hover:-translate-y-0.5 hover:bg-brand-700/5"
          >
            Browse the shelves ↓
          </a>
        </div>
        <hr className="vintage-rule mx-auto mt-12 max-w-md" />
      </section>

      {/* ───────── Kinetic marquee ───────── */}
      <div className="marquee border-y border-parchment-border/70 py-3 text-brand-800/70">
        <div className="marquee__track font-display text-3xl">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k}>
              {[
                "Philosophy",
                "Poetry",
                "History",
                "Essays",
                "Fiction",
                "Memoir",
                "Science",
                "Letters",
              ].map((w) => (
                <span key={w} className="mx-6">
                  {w} <span className="text-brand-500">✦</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ───────── Shelves ───────── */}
      <div id="shelves" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-4xl text-ink sm:text-5xl">The Shelves</h2>
        <hr className="vintage-rule my-2 max-w-xs" />
        <p className="text-sm italic text-ink-soft">
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
                <div className="overflow-hidden rounded-md bg-parchment-dark shadow-md ring-1 ring-parchment-border transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-2xl">
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
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-600 to-brand-900 p-3 text-center">
                        <span className="font-display line-clamp-4 text-xl leading-tight text-parchment-light">
                          {b.title}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-medium leading-tight text-ink">
                  {b.title}
                </p>
                {b.author && (
                  <p className="mt-0.5 line-clamp-1 text-xs italic text-ink-soft">
                    {b.author}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}

      </div>

      {/* ───────── Footer ───────── */}
      <footer className="mt-10 border-t border-parchment-border bg-parchment-light/60">
        <div className="mx-auto max-w-6xl px-6 py-12 text-center">
          <p className="font-display text-5xl text-brand-800">Lumen</p>
          <p className="mx-auto mt-2 max-w-md text-sm italic text-ink-soft">
            Books here are public to anyone with the link. Prefer a private
            library?{" "}
            <Link href="/login" className="underline decoration-brand-400 hover:text-brand-800">
              use a sync code
            </Link>{" "}
            or{" "}
            <Link href="/local" className="underline decoration-brand-400 hover:text-brand-800">
              read on this device only
            </Link>
            .
          </p>
          <hr className="vintage-rule mx-auto my-6 max-w-xs" />
          <p className="text-xs uppercase tracking-[0.3em] text-ink-soft/70">
            A reading room for the curious · {new Date().getFullYear()}
          </p>
        </div>
      </footer>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-brand-600/10 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-brand-500 bg-white px-10 py-8 text-lg font-semibold text-brand-700">
            Drop your EPUB to share it 📚
          </div>
        </div>
      )}

      <MagicLayer />
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
    <div className="vintage-card mt-16 flex flex-col items-center justify-center rounded-xl px-6 py-16 text-center">
      <div className="text-5xl" aria-hidden>
        📚
      </div>
      <h2 className="font-display mt-4 text-4xl text-ink">No books yet</h2>
      <p className="mt-1 max-w-sm text-sm italic text-ink-soft">
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
