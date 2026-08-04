"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/fetcher";
import { formatDuration, HOSTS, type DialogueTurn } from "@/lib/epubcast/script";
import { usePodcastPlayer } from "@/components/epubcast/use-podcast-player";

interface EpisodeRow {
  id: string;
  chapterIndex: number;
  chapterTitle: string;
  status: string;
  unlocked: boolean;
  listened: boolean;
  segmentsDone: number;
  segmentsTotal: number;
  wordCount: number;
  durationSeconds: number;
  error: string | null;
}

interface PodcastData {
  id: string;
  title: string;
  author: string | null;
  cover: string | null;
  totalChapters: number;
  episodes: EpisodeRow[];
}

interface FullEpisode extends EpisodeRow {
  turns: DialogueTurn[];
  sources: { title: string; url: string }[];
}

export function PodcastDetail({ podcastId }: { podcastId: string }) {
  const [podcast, setPodcast] = useState<PodcastData | null>(null);
  const [keyConfigured, setKeyConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [episode, setEpisode] = useState<FullEpisode | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const d = await api<{ podcast: PodcastData; apiKeyConfigured: boolean }>(
        `/api/epubcast/${podcastId}`,
      );
      setPodcast(d.podcast);
      setKeyConfigured(d.apiKeyConfigured);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't load this show.");
    } finally {
      setLoading(false);
    }
  }, [podcastId]);

  useEffect(() => {
    load();
  }, [load]);

  const openEpisode = useCallback(async (id: string) => {
    setOpenId(id);
    setEpisode(null);
    try {
      const d = await api<{ episode: FullEpisode }>(
        `/api/epubcast/episodes/${id}`,
      );
      setEpisode(d.episode);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't open that episode.");
    }
  }, []);

  /** Drive generation one step at a time until the episode is finished. */
  const generate = useCallback(
    async (id: string) => {
      setBusyId(id);
      setErr(null);
      cancelRef.current = false;
      try {
        for (let step = 0; step < 12; step++) {
          if (cancelRef.current) break;
          const r = await api<{
            done: boolean;
            step: string;
            segmentsDone: number;
            segmentsTotal: number;
          }>(`/api/epubcast/episodes/${id}/generate`, { method: "POST" });
          setProgress(r.step);
          if (r.done) break;
        }
        await load();
        if (openId === id) await openEpisode(id);
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : "Generation failed.");
        await load();
      } finally {
        setBusyId(null);
        setProgress(null);
      }
    },
    [load, openEpisode, openId],
  );

  const markComplete = useCallback(
    async (id: string) => {
      try {
        await api(`/api/epubcast/episodes/${id}/complete`, { method: "POST" });
        await load();
      } catch {
        /* non-fatal */
      }
    },
    [load],
  );

  useEffect(() => {
    return () => {
      cancelRef.current = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <div className="h-40 animate-pulse rounded-xl bg-parchment-dark/60" />
      </main>
    );
  }
  if (!podcast) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="text-sm text-rose-700">{err ?? "Show not found."}</p>
        <Link href="/epubcast" className="mt-4 inline-block underline">
          ← All shows
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh]">
      <header className="border-b border-parchment-border bg-parchment-light/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/epubcast" className="flex items-center gap-2 text-brand-800">
            <span aria-hidden className="text-xl">🎙️</span>
            <span className="font-display text-3xl leading-none">EpubCast</span>
          </Link>
          <Link
            href="/epubcast"
            className="rounded-full border border-parchment-border px-4 py-2 text-sm font-semibold text-ink transition hover:bg-parchment-light"
          >
            ← All shows
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-5xl text-ink">{podcast.title}</h1>
        {podcast.author && (
          <p className="text-sm italic text-ink-soft">by {podcast.author}</p>
        )}
        <hr className="vintage-rule my-3 max-w-xs" />
        <p className="text-sm text-ink-soft">
          {podcast.totalChapters} episodes · unlocked one chapter at a time
        </p>

        {!keyConfigured && (
          <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Set <code className="font-mono">ANTHROPIC_API_KEY</code> to record
            episodes.
          </p>
        )}
        {err && (
          <p role="alert" className="mt-5 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {err}
          </p>
        )}

        <ol className="mt-8 space-y-3">
          {podcast.episodes.map((e) => {
            const isOpen = openId === e.id;
            const busy = busyId === e.id;
            return (
              <li key={e.id} className="vintage-card rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      e.unlocked
                        ? "bg-brand-700 text-parchment-light"
                        : "bg-parchment-dark text-ink-soft"
                    }`}
                  >
                    {e.unlocked ? e.chapterIndex + 1 : "🔒"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">
                      {e.chapterTitle}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {!e.unlocked
                        ? "Locked — finish the previous episode"
                        : e.status === "ready"
                          ? `${formatDuration(e.durationSeconds)} · ${e.wordCount.toLocaleString()} words${e.listened ? " · listened" : ""}`
                          : e.status === "failed"
                            ? e.error || "Generation failed"
                            : busy
                              ? (progress ?? "Working…")
                              : "Not recorded yet"}
                    </p>
                  </div>

                  {e.unlocked && e.status === "ready" && (
                    <button
                      type="button"
                      onClick={() => (isOpen ? setOpenId(null) : openEpisode(e.id))}
                      className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-parchment-light hover:bg-brand-800"
                    >
                      {isOpen ? "Close" : "▶ Listen"}
                    </button>
                  )}
                  {e.unlocked && e.status !== "ready" && (
                    <button
                      type="button"
                      onClick={() => generate(e.id)}
                      disabled={busy || !keyConfigured}
                      className="rounded-full border border-brand-700/40 px-4 py-2 text-sm font-semibold text-brand-800 transition hover:bg-brand-700/5 disabled:opacity-50"
                    >
                      {busy
                        ? "Recording…"
                        : e.status === "failed"
                          ? "Retry"
                          : "Record episode"}
                    </button>
                  )}
                </div>

                {busy && (
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-parchment-dark">
                      <div
                        className="h-full bg-brand-600 transition-all duration-500"
                        style={{
                          width: `${Math.round(((e.segmentsDone + 1) / (e.segmentsTotal + 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs italic text-ink-soft">
                      {progress ?? "Researching the chapter…"}
                    </p>
                  </div>
                )}

                {isOpen && (
                  <EpisodePlayer
                    episode={episode}
                    onFinished={() => markComplete(e.id)}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </main>
  );
}

function EpisodePlayer({
  episode,
  onFinished,
}: {
  episode: FullEpisode | null;
  onFinished: () => void;
}) {
  const turns = episode?.turns ?? [];
  const player = usePodcastPlayer(turns, onFinished);
  const activeRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [player.index]);

  if (!episode) {
    return (
      <p className="mt-4 text-sm italic text-ink-soft">Loading episode…</p>
    );
  }

  return (
    <div className="mt-4 border-t border-parchment-border pt-4">
      {!player.supported && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          This browser can&apos;t speak the episode aloud — the transcript is
          below.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            player.playing
              ? player.paused
                ? player.resume()
                : player.pause()
              : player.play(0)
          }
          disabled={!player.supported || !turns.length}
          className="rounded-full bg-brand-700 px-5 py-2 text-sm font-semibold text-parchment-light hover:bg-brand-800 disabled:opacity-50"
        >
          {player.playing ? (player.paused ? "▶ Resume" : "❚❚ Pause") : "▶ Play"}
        </button>
        <button
          type="button"
          onClick={player.previous}
          disabled={!player.playing}
          className="rounded-full border border-parchment-border px-3 py-2 text-sm text-ink disabled:opacity-40"
          aria-label="Previous line"
        >
          ⏮
        </button>
        <button
          type="button"
          onClick={player.next}
          disabled={!player.playing}
          className="rounded-full border border-parchment-border px-3 py-2 text-sm text-ink disabled:opacity-40"
          aria-label="Next line"
        >
          ⏭
        </button>
        <button
          type="button"
          onClick={player.stop}
          disabled={!player.playing}
          className="rounded-full border border-parchment-border px-3 py-2 text-sm text-ink disabled:opacity-40"
        >
          ■
        </button>
        <label className="ml-auto flex items-center gap-1 text-xs text-ink-soft">
          Speed
          <select
            value={player.rate}
            onChange={(ev) => player.setRate(Number(ev.target.value))}
            className="rounded-lg border border-parchment-border bg-parchment-light px-2 py-1 text-xs"
          >
            {[0.8, 1, 1.15, 1.3, 1.5, 1.75].map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
        </label>
      </div>

      {player.voices.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(["A", "B"] as const).map((host) => (
            <label key={host} className="flex items-center gap-2 text-xs text-ink-soft">
              <span className="w-16 shrink-0 font-semibold text-ink">
                {HOSTS[host].name}
              </span>
              <select
                value={(host === "A" ? player.voiceA : player.voiceB) ?? ""}
                onChange={(ev) => player.setVoice(host, ev.target.value)}
                className="min-w-0 flex-1 truncate rounded-lg border border-parchment-border bg-parchment-light px-2 py-1 text-xs"
                aria-label={`Voice for ${HOSTS[host].name}`}
              >
                {player.voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      <ul className="scroll-thin mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
        {turns.map((t, i) => (
          <li
            key={i}
            ref={i === player.index ? activeRef : undefined}
            className={`rounded-lg px-3 py-2 text-sm leading-relaxed transition ${
              i === player.index
                ? "bg-brand-100 text-ink ring-1 ring-brand-400"
                : "text-ink-soft"
            }`}
          >
            <button
              type="button"
              onClick={() => player.play(i)}
              className="w-full text-left"
            >
              <span className="mr-2 font-semibold text-brand-800">
                {HOSTS[t.speaker].name}
              </span>
              {t.text}
            </button>
          </li>
        ))}
      </ul>

      {episode.sources.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Sources from the web ({episode.sources.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {episode.sources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-700 underline hover:text-brand-900"
                >
                  {s.title} ↗
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
