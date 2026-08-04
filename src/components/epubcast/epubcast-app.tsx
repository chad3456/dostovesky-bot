"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/fetcher";

interface PodcastSummary {
  id: string;
  title: string;
  author: string | null;
  cover: string | null;
  totalChapters: number;
  readyCount: number;
  unlockedCount: number;
  createdAt: string;
}

export function EpubcastApp() {
  const [podcasts, setPodcasts] = useState<PodcastSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [keyConfigured, setKeyConfigured] = useState(true);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await api<{
        podcasts: PodcastSummary[];
        apiKeyConfigured: boolean;
      }>("/api/epubcast");
      setPodcasts(d.podcasts);
      setKeyConfigured(d.apiKeyConfigured);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't load your podcasts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const file = Array.from(files).find((f) =>
        f.name.toLowerCase().endsWith(".epub"),
      );
      if (!file) {
        setErr("Please choose an .epub file.");
        return;
      }
      setUploading(true);
      setErr(null);
      try {
        const form = new FormData();
        form.append("file", file);
        await api("/api/epubcast", { method: "POST", body: form });
        await refresh();
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : "Upload failed.");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [refresh],
  );

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
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-brand-800">
            <span aria-hidden className="text-xl">🎙️</span>
            <span className="font-display text-3xl leading-none">EpubCast</span>
          </Link>
          <Link
            href="/"
            className="rounded-full border border-parchment-border px-4 py-2 text-sm font-semibold text-ink transition hover:bg-parchment-light"
          >
            ← Library
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-8 pt-16 text-center">
        <p className="reveal-up text-xs font-semibold uppercase tracking-[0.35em] text-brand-700">
          Every chapter, discussed
        </p>
        <h1
          className="reveal-up font-display mt-4 text-6xl leading-[0.95] text-ink sm:text-7xl"
          style={{ animationDelay: "0.1s" }}
        >
          Turn any book into a podcast.
        </h1>
        <p
          className="reveal-up mx-auto mt-6 max-w-xl text-lg italic leading-relaxed text-ink-soft"
          style={{ animationDelay: "0.25s" }}
        >
          Upload an EPUB and two hosts talk through it — chapter by chapter,
          with the conversation happening about it across the internet woven in.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".epub,application/epub+zip"
          hidden
          onChange={(e) => e.target.files && upload(e.target.files)}
          data-testid="epubcast-file"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="reveal-up mt-9 rounded-full bg-brand-700 px-8 py-3 text-base font-semibold text-parchment-light shadow-lg shadow-brand-900/20 transition hover:-translate-y-0.5 hover:bg-brand-800 disabled:opacity-60"
          style={{ animationDelay: "0.4s" }}
        >
          {uploading ? "Reading the book…" : "Upload an EPUB"}
        </button>

        {!keyConfigured && (
          <p className="mx-auto mt-6 max-w-lg rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>Set an API key to generate episodes.</strong> Add{" "}
            <code className="font-mono">ANTHROPIC_API_KEY</code> to your
            environment — uploading and browsing work without it, but writing an
            episode calls Claude.
          </p>
        )}
        {err && (
          <p role="alert" className="mt-5 text-sm text-rose-700">
            {err}
          </p>
        )}
        <hr className="vintage-rule mx-auto mt-12 max-w-md" />
      </section>

      <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-parchment-dark/60" />
            ))}
          </div>
        ) : podcasts.length === 0 ? (
          <p className="text-center text-sm italic text-ink-soft">
            No shows yet. Upload a book and its first episode is ready to record.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {podcasts.map((p) => (
              <Link
                key={p.id}
                href={`/epubcast/${p.id}`}
                className="vintage-card flex gap-4 rounded-xl p-4 transition hover:-translate-y-0.5"
              >
                <div className="h-24 w-16 shrink-0 overflow-hidden rounded bg-parchment-dark ring-1 ring-parchment-border">
                  {p.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.cover} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-600 to-brand-900 text-2xl">
                      🎙️
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-display text-2xl leading-tight text-ink">
                    {p.title}
                  </p>
                  {p.author && (
                    <p className="text-xs italic text-ink-soft">{p.author}</p>
                  )}
                  <p className="mt-2 text-xs text-ink-soft">
                    {p.totalChapters} episode{p.totalChapters === 1 ? "" : "s"} ·{" "}
                    {p.readyCount} recorded · {p.unlockedCount} unlocked
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-brand-600/10 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-brand-500 bg-parchment-light px-10 py-8 text-lg font-semibold text-brand-700">
            Drop an EPUB to start a show 🎙️
          </div>
        </div>
      )}
    </main>
  );
}
