"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/fetcher";
import type { Highlight, Preferences } from "@/lib/types";
import {
  buildEpubThemeRules,
  HIGHLIGHT_FILL,
  READER_THEMES,
} from "@/lib/reader-themes";
import { SettingsPanel } from "@/components/reader/settings-panel";
import { ContentsPanel, type TocItem } from "@/components/reader/contents-panel";
import { HighlightsPanel } from "@/components/reader/highlights-panel";
import { DiscoverPanel } from "@/components/reader/discover-panel";
import { KnowledgeGraphPanel } from "@/components/reader/knowledge-graph-panel";
import { SelectionBar } from "@/components/reader/selection-bar";
import { ListenBar } from "@/components/reader/listen-bar";
import { useTts, type TtsEngine } from "@/components/reader/use-tts";
import { shareQuoteImage } from "@/lib/share-image";

const DEFAULT_PREFS: Preferences = {
  theme: "light",
  fontFamily: "serif",
  fontSize: 18,
  lineHeight: 1.6,
  margin: 24,
  justify: true,
  flow: "paginated",
};

type Panel =
  | "settings"
  | "contents"
  | "highlights"
  | "discover"
  | "graph"
  | null;

interface Selection {
  cfiRange: string;
  text: string;
}

// Small localStorage JSON helpers used by the no-server "local" reading mode.
function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — non-fatal */
  }
}

export interface ReaderClientProps {
  title: string;
  // Optional author, used for share cards.
  author?: string | null;
  // Endpoint that returns the raw EPUB bytes (server-backed reading).
  fileUrl?: string;
  // In-memory EPUB bytes (local, no-server reading).
  data?: ArrayBuffer;
  // When provided, progress/highlights/preferences are synced to the server.
  bookId?: string | null;
  // When provided, everything persists in localStorage under this key
  // (fully client-side reading — no account, no database).
  localKey?: string;
  // Read-only (shared) mode: no writes, prefs persist locally.
  readOnly?: boolean;
  // Optional in-app back handler; falls back to a link when omitted.
  onBack?: () => void;
}

export function ReaderClient({
  title,
  author = null,
  fileUrl,
  data,
  bookId = null,
  localKey,
  readOnly = false,
  onBack,
}: ReaderClientProps) {
  const local = Boolean(localKey);
  // Highlighting is offered whenever changes can be persisted somewhere.
  const canHighlight = !readOnly && (Boolean(bookId) || local);
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<any>(null);
  const renditionRef = useRef<any>(null);
  const contentsRef = useRef<any>(null);
  const currentCfiRef = useRef<string | null>(null);
  const initialCfiRef = useRef<string | null>(null);
  const epubDataRef = useRef<ArrayBuffer | null>(null);
  const highlightsRef = useRef<Highlight[]>([]);
  const prefsLoadedRef = useRef(false);

  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [currentHref, setCurrentHref] = useState<string | null>(null);
  const [percentage, setPercentage] = useState(0);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dataReady, setDataReady] = useState(false);

  highlightsRef.current = highlights;

  // ---- debounce helpers -------------------------------------------------
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progressKey = `lumen:progress:${localKey}`;
  const highlightsKey = `lumen:highlights:${localKey}`;

  const saveProgress = useCallback(
    (cfi: string, pct: number, label: string | null) => {
      if (local) {
        lsSet(progressKey, { cfi, percentage: pct, label });
        return;
      }
      if (readOnly || !bookId) return;
      if (progressTimer.current) clearTimeout(progressTimer.current);
      progressTimer.current = setTimeout(() => {
        api(`/api/books/${bookId}/progress`, {
          method: "PUT",
          body: JSON.stringify({ cfi, percentage: pct, label }),
        }).catch(() => {});
      }, 800);
    },
    [bookId, readOnly, local, progressKey],
  );

  const savePrefs = useCallback(
    (next: Preferences) => {
      // Preferences are global to the reader and shared across books.
      if (local || readOnly) {
        lsSet("lumen:prefs", next);
        return;
      }
      if (prefsTimer.current) clearTimeout(prefsTimer.current);
      prefsTimer.current = setTimeout(() => {
        api(`/api/preferences`, {
          method: "PUT",
          body: JSON.stringify(next),
        }).catch(() => {});
      }, 500);
    },
    [readOnly, local],
  );

  // ---- initial data load (prefs, progress, highlights, epub bytes) ------
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      // Preferences
      try {
        if (local || readOnly) {
          const stored = lsGet<Partial<Preferences>>("lumen:prefs");
          if (stored) setPrefs({ ...DEFAULT_PREFS, ...stored });
        } else {
          const d = await api<{ preferences: Preferences }>("/api/preferences");
          if (!cancelled) setPrefs({ ...DEFAULT_PREFS, ...d.preferences });
        }
      } catch {
        /* fall back to defaults */
      } finally {
        prefsLoadedRef.current = true;
      }

      // Progress + highlights
      if (local) {
        const p = lsGet<{ cfi: string | null }>(progressKey);
        initialCfiRef.current = p?.cfi ?? null;
        const hs = lsGet<Highlight[]>(highlightsKey);
        if (hs && !cancelled) setHighlights(hs);
      } else if (!readOnly && bookId) {
        try {
          const p = await api<{ progress: { cfi: string | null } | null }>(
            `/api/books/${bookId}/progress`,
          );
          initialCfiRef.current = p.progress?.cfi ?? null;
        } catch {}
        try {
          const h = await api<{ highlights: Highlight[] }>(
            `/api/books/${bookId}/highlights`,
          );
          if (!cancelled) setHighlights(h.highlights);
        } catch {}
      }

      // EPUB bytes — from memory (local) or fetched from the server.
      try {
        let buf: ArrayBuffer;
        if (data) {
          buf = data;
        } else if (fileUrl) {
          const res = await fetch(fileUrl);
          if (!res.ok) throw new Error(`Failed to fetch book (${res.status})`);
          buf = await res.arrayBuffer();
        } else {
          throw new Error("No book source provided");
        }
        if (!cancelled) {
          epubDataRef.current = buf;
          setDataReady(true);
        }
      } catch {
        if (!cancelled) {
          setErrorMsg("We couldn't load this book. Please try again.");
          setStatus("error");
        }
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, fileUrl, readOnly]);

  // ---- create / recreate the rendition ---------------------------------
  // Re-runs when the layout flow changes; preserves the current location.
  useEffect(() => {
    let destroyed = false;
    let cleanup = () => {};

    async function init() {
      if (!dataReady || !epubDataRef.current || !viewerRef.current) return;
      const ePub = (await import("epubjs")).default;
      if (destroyed) return;

      // Tear down any previous instance.
      try {
        renditionRef.current?.destroy?.();
        bookRef.current?.destroy?.();
      } catch {}
      viewerRef.current.innerHTML = "";

      const book = ePub(epubDataRef.current.slice(0));
      bookRef.current = book;

      const flowOpts =
        prefs.flow === "scrolled"
          ? { flow: "scrolled-doc", manager: "continuous" as const }
          : { flow: "paginated", manager: "default" as const, spread: "auto" as const };

      const rendition = book.renderTo(viewerRef.current, {
        width: "100%",
        height: "100%",
        allowScriptedContent: false,
        ...flowOpts,
      });
      renditionRef.current = rendition;

      // Register teardown immediately so a fast unmount (e.g. React strict
      // mode double-invoke) always disposes what we created.
      cleanup = () => {
        try {
          rendition.destroy();
          book.destroy();
        } catch {}
      };

      applyTheme(rendition, prefs);

      // Wire events
      rendition.on("relocated", (location: any) => {
        const cfi = location?.start?.cfi as string | undefined;
        if (!cfi) return;
        currentCfiRef.current = cfi;
        setCurrentHref(location?.start?.href ?? null);
        let pct = location?.start?.percentage ?? 0;
        try {
          if (book.locations?.length()) {
            pct = book.locations.percentageFromCfi(cfi) ?? pct;
          }
        } catch {}
        setPercentage(pct);
        const label = labelForHref(book, location?.start?.href);
        setLocationLabel(label);
        saveProgress(cfi, pct, label);
      });

      rendition.on("selected", (cfiRange: string, contents: any) => {
        contentsRef.current = contents;
        book
          .getRange(cfiRange)
          .then((range: any) => {
            const text = (range?.toString?.() ?? "").trim();
            if (text) setSelection({ cfiRange, text });
          })
          .catch(() => {});
      });

      rendition.on("markClicked", (cfiRange: string) => {
        const hit = highlightsRef.current.find((h) => h.cfiRange === cfiRange);
        if (hit) setPanel("highlights");
      });

      rendition.on("keyup", (e: KeyboardEvent) => handleKey(e));

      // Swipe-to-turn inside the book content (touch devices, paginated only).
      if (prefs.flow === "paginated") {
        rendition.hooks.content.register((contents: any) => {
          const doc: Document = contents.document;
          let sx = 0;
          let sy = 0;
          doc.addEventListener(
            "touchstart",
            (e: TouchEvent) => {
              const t = e.changedTouches[0];
              sx = t.clientX;
              sy = t.clientY;
            },
            { passive: true },
          );
          doc.addEventListener(
            "touchend",
            (e: TouchEvent) => {
              const t = e.changedTouches[0];
              const dx = t.clientX - sx;
              const dy = t.clientY - sy;
              if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
              const sel = contents.window?.getSelection?.();
              if (sel && String(sel).length > 0) return; // selecting text
              if (dx < 0) rendition.next();
              else rendition.prev();
            },
            { passive: true },
          );
        });
      }

      // Display at last known location.
      const startAt =
        currentCfiRef.current || initialCfiRef.current || undefined;
      try {
        await rendition.display(startAt);
      } catch {
        await rendition.display();
      }

      if (destroyed) return;

      // Table of contents
      try {
        await book.loaded.navigation;
        const items = flattenToc(book.navigation?.toc ?? []);
        setToc(items);
      } catch {}

      // Re-apply highlight annotations.
      for (const h of highlightsRef.current) {
        addAnnotation(rendition, h);
      }

      setStatus("ready");

      // Generate locations for accurate percentages (non-blocking).
      book.ready
        .then(() => book.locations.generate(1600))
        .then(() => {
          if (destroyed) return;
          const cfi = currentCfiRef.current;
          if (cfi) {
            try {
              setPercentage(book.locations.percentageFromCfi(cfi) ?? 0);
            } catch {}
          }
        })
        .catch(() => {});
    }

    init();
    return () => {
      destroyed = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady, prefs.flow]);

  // ---- live theme updates (no re-render of book needed) -----------------
  useEffect(() => {
    if (status !== "ready" || !renditionRef.current) return;
    applyTheme(renditionRef.current, prefs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    prefs.theme,
    prefs.fontFamily,
    prefs.fontSize,
    prefs.lineHeight,
    prefs.justify,
    status,
  ]);

  // ---- responsive reflow on container resize ----------------------------
  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          const r = renditionRef.current;
          if (r && el.clientWidth > 0) r.resize(el.clientWidth, el.clientHeight);
        } catch {}
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // ---- preference change handler ----------------------------------------
  const updatePrefs = useCallback(
    (patch: Partial<Preferences>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        if (prefsLoadedRef.current) savePrefs(next);
        return next;
      });
    },
    [savePrefs],
  );

  // ---- navigation -------------------------------------------------------
  const next = useCallback(() => renditionRef.current?.next?.(), []);
  const prev = useCallback(() => renditionRef.current?.prev?.(), []);

  // Swipe-to-turn for touch devices (paginated mode only). Ignored when the
  // reader is scrolled, or when the gesture is mostly vertical, or when text
  // is being selected.
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start || prefs.flow !== "paginated" || selection) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) next();
    else prev();
  }

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    },
    [next, prev],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handleKey(e);
    window.addEventListener("keyup", onKey);
    return () => window.removeEventListener("keyup", onKey);
  }, [handleKey]);

  function navigateTo(href: string) {
    renditionRef.current?.display?.(href);
    setPanel(null);
  }

  // ---- listen (text-to-speech) ------------------------------------------
  const ttsEngine = useMemo<TtsEngine>(
    () => ({
      getText: () => {
        try {
          const contents = renditionRef.current?.getContents?.() ?? [];
          const body = contents[0]?.document?.body;
          return body ? body.innerText || body.textContent || "" : "";
        } catch {
          return "";
        }
      },
      advance: async () => {
        try {
          const r = renditionRef.current;
          const book = bookRef.current;
          const idx = r?.location?.start?.index;
          const items = book?.spine?.spineItems ?? [];
          const nextHref =
            typeof idx === "number" ? items[idx + 1]?.href : undefined;
          if (!nextHref) return false;
          await r.display(nextHref);
          return true;
        } catch {
          return false;
        }
      },
    }),
    [],
  );
  const tts = useTts(ttsEngine);

  function startListening() {
    clearSelection();
    setPanel(null);
    tts.start();
  }

  // ---- share to story ---------------------------------------------------
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  async function shareSelection() {
    if (!selection) return;
    const quote = selection.text;
    clearSelection();
    try {
      const result = await shareQuoteImage({ quote, title, author });
      if (result === "downloaded") {
        setShareMsg("Image saved — post it to your story 📸");
        setTimeout(() => setShareMsg(null), 3500);
      }
    } catch {
      setShareMsg("Couldn't create the share image.");
      setTimeout(() => setShareMsg(null), 3500);
    }
  }

  // ---- highlights -------------------------------------------------------
  function clearSelection() {
    try {
      contentsRef.current?.window?.getSelection?.()?.removeAllRanges?.();
    } catch {}
    setSelection(null);
  }

  async function createHighlight(color: string) {
    if (!selection || !canHighlight) {
      clearSelection();
      return;
    }
    const { cfiRange, text } = selection;
    const chapter = locationLabel;
    const now = new Date().toISOString();
    const optimistic: Highlight = {
      id: local ? `loc-${crypto.randomUUID()}` : `tmp-${Date.now()}`,
      bookId: bookId ?? localKey ?? "local",
      cfiRange,
      text,
      note: null,
      color,
      chapter,
      createdAt: now,
      updatedAt: now,
    };
    setHighlights((hs) => {
      const nextHs = [...hs, optimistic];
      if (local) lsSet(highlightsKey, nextHs);
      return nextHs;
    });
    addAnnotation(renditionRef.current, optimistic);
    clearSelection();

    if (local) return; // persisted to localStorage above

    try {
      const d = await api<{ highlight: Highlight }>(
        `/api/books/${bookId}/highlights`,
        {
          method: "POST",
          body: JSON.stringify({ cfiRange, text, color, chapter }),
        },
      );
      setHighlights((hs) =>
        hs.map((h) => (h.id === optimistic.id ? d.highlight : h)),
      );
    } catch {
      // Roll back on failure.
      setHighlights((hs) => hs.filter((h) => h.id !== optimistic.id));
      removeAnnotation(renditionRef.current, cfiRange);
    }
  }

  async function deleteHighlight(h: Highlight) {
    setHighlights((hs) => {
      const nextHs = hs.filter((x) => x.id !== h.id);
      if (local) lsSet(highlightsKey, nextHs);
      return nextHs;
    });
    removeAnnotation(renditionRef.current, h.cfiRange);
    if (!local && !readOnly && !h.id.startsWith("tmp-")) {
      api(`/api/highlights/${h.id}`, { method: "DELETE" }).catch(() => {});
    }
  }

  async function updateNote(h: Highlight, note: string) {
    setHighlights((hs) => {
      const nextHs = hs.map((x) => (x.id === h.id ? { ...x, note } : x));
      if (local) lsSet(highlightsKey, nextHs);
      return nextHs;
    });
    if (!local && !readOnly && !h.id.startsWith("tmp-")) {
      api(`/api/highlights/${h.id}`, {
        method: "PATCH",
        body: JSON.stringify({ note }),
      }).catch(() => {});
    }
  }

  function openHighlight(h: Highlight) {
    renditionRef.current?.display?.(h.cfiRange);
    setPanel(null);
  }

  function copySelection() {
    if (selection?.text) {
      navigator.clipboard?.writeText(selection.text).catch(() => {});
    }
    clearSelection();
  }

  const theme = READER_THEMES[prefs.theme] ?? READER_THEMES.light;
  const isDarkChrome = ["dark", "night", "high-contrast"].includes(prefs.theme);

  // -----------------------------------------------------------------------
  return (
    <div
      className="flex h-[100dvh] flex-col"
      style={{ background: theme.background, color: theme.color }}
    >
      {/* Top toolbar */}
      <header
        className={`flex items-center justify-between gap-2 border-b px-3 py-2 ${theme.chrome}`}
      >
        <div className="flex items-center gap-1">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to library"
              className="rounded-lg px-2 py-1.5 text-sm hover:bg-black/10"
            >
              ←
            </button>
          ) : (
            <Link
              href={local || readOnly ? "/" : "/library"}
              aria-label="Back to library"
              className="rounded-lg px-2 py-1.5 text-sm hover:bg-black/10"
            >
              ←
            </Link>
          )}
          <ToolbarButton label="Contents" onClick={() => setPanel("contents")}>
            ☰
          </ToolbarButton>
        </div>

        <h1 className="line-clamp-1 flex-1 text-center text-sm font-medium">
          {title}
        </h1>

        <div className="flex items-center gap-1">
          {tts.supported && !tts.listening && (
            <ToolbarButton label="Listen" onClick={startListening}>
              🎧
            </ToolbarButton>
          )}
          <ToolbarButton label="Chapter graph" onClick={() => setPanel("graph")}>
            🕸️
          </ToolbarButton>
          <ToolbarButton label="Discover" onClick={() => setPanel("discover")}>
            🧭
          </ToolbarButton>
          <ToolbarButton
            label="Highlights"
            onClick={() => setPanel("highlights")}
          >
            ✦
          </ToolbarButton>
          <ToolbarButton label="Settings" onClick={() => setPanel("settings")}>
            Aa
          </ToolbarButton>
        </div>
      </header>

      {/* Reader stage */}
      <div
        className="relative flex-1 overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {status === "error" ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-lg font-medium">{errorMsg}</p>
            <Link
              href="/library"
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white"
            >
              Back to library
            </Link>
          </div>
        ) : (
          <>
            {status === "loading" && (
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                  <p className="text-sm opacity-70">Opening your book…</p>
                </div>
              </div>
            )}

            <div
              className="mx-auto h-full"
              style={{
                paddingLeft: prefs.margin,
                paddingRight: prefs.margin,
                maxWidth: 1100,
              }}
            >
              <div ref={viewerRef} className="reader-viewport" data-testid="epub-viewport" />
            </div>

            {/* Page navigation (paginated) */}
            {prefs.flow === "paginated" && status === "ready" && (
              <>
                <NavZone side="left" onClick={prev} />
                <NavZone side="right" onClick={next} />
              </>
            )}
          </>
        )}
      </div>

      {/* Footer progress */}
      <footer
        className={`flex items-center gap-3 border-t px-4 py-2 text-xs ${theme.chrome}`}
      >
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${Math.round(percentage * 100)}%` }}
          />
        </div>
        <span className="tabular-nums opacity-70">
          {Math.round(percentage * 100)}%
        </span>
      </footer>

      {/* Slide-over panels */}
      {panel && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setPanel(null)}
            aria-hidden
          />
          <aside
            className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col bg-white text-slate-900 shadow-2xl ${
              isDarkChrome ? "dark" : ""
            }`}
            role="dialog"
            aria-modal="true"
          >
            {panel === "settings" && (
              <SettingsPanel
                prefs={prefs}
                onChange={updatePrefs}
                onClose={() => setPanel(null)}
              />
            )}
            {panel === "contents" && (
              <ContentsPanel
                toc={toc}
                currentHref={currentHref}
                onNavigate={navigateTo}
                onClose={() => setPanel(null)}
              />
            )}
            {panel === "highlights" && (
              <HighlightsPanel
                highlights={highlights}
                onOpen={openHighlight}
                onDelete={deleteHighlight}
                onUpdateNote={updateNote}
                onClose={() => setPanel(null)}
                readOnly={!canHighlight}
              />
            )}
            {panel === "discover" && (
              <DiscoverPanel
                title={title}
                author={author}
                onClose={() => setPanel(null)}
              />
            )}
            {panel === "graph" && (
              <KnowledgeGraphPanel
                getText={ttsEngine.getText}
                chapterLabel={locationLabel}
                onClose={() => setPanel(null)}
              />
            )}
          </aside>
        </>
      )}

      {/* Selection action bar */}
      {selection && (
        <SelectionBar
          text={selection.text}
          onHighlight={createHighlight}
          onCopy={copySelection}
          onShare={shareSelection}
          onDismiss={clearSelection}
          readOnly={!canHighlight}
        />
      )}

      {/* Listening controls */}
      {tts.listening && <ListenBar tts={tts} />}

      {/* Transient share message */}
      {shareMsg && (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <p className="rounded-full bg-slate-900/95 px-4 py-2 text-sm text-white shadow-lg">
            {shareMsg}
          </p>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Helpers (pure-ish; operate on the epub.js rendition/book)
// --------------------------------------------------------------------------

function applyTheme(rendition: any, prefs: Preferences) {
  try {
    const rules = buildEpubThemeRules({
      themeId: prefs.theme,
      fontFamily: prefs.fontFamily,
      fontSize: prefs.fontSize,
      lineHeight: prefs.lineHeight,
      justify: prefs.justify,
    });
    rendition.themes.register("lumen", rules);
    rendition.themes.select("lumen");
    rendition.themes.fontSize(`${prefs.fontSize}px`);
  } catch {}
}

function addAnnotation(rendition: any, h: Highlight) {
  if (!rendition) return;
  try {
    rendition.annotations.add(
      "highlight",
      h.cfiRange,
      {},
      undefined,
      "lumen-hl",
      {
        fill: HIGHLIGHT_FILL[h.color] ?? "#fde047",
        "fill-opacity": "0.4",
        "mix-blend-mode": "multiply",
      },
    );
  } catch {}
}

function removeAnnotation(rendition: any, cfiRange: string) {
  try {
    rendition.annotations.remove(cfiRange, "highlight");
  } catch {}
}

function flattenToc(items: any[], depth = 0): TocItem[] {
  const out: TocItem[] = [];
  for (const it of items) {
    out.push({ label: (it.label || "").trim() || "Untitled", href: it.href, depth });
    if (it.subitems?.length) out.push(...flattenToc(it.subitems, depth + 1));
  }
  return out;
}

function labelForHref(book: any, href?: string): string | null {
  if (!href) return null;
  const base = href.split("#")[0];
  const toc = flattenToc(book.navigation?.toc ?? []);
  const match = toc.find((t) => t.href.split("#")[0] === base);
  return match?.label ?? null;
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-black/10"
    >
      {children}
    </button>
  );
}

function NavZone({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous page" : "Next page"}
      className={`group absolute inset-y-0 ${
        side === "left" ? "left-0" : "right-0"
      } z-10 flex w-[12%] min-w-[44px] items-center justify-center`}
    >
      <span className="text-2xl opacity-0 transition group-hover:opacity-40">
        {side === "left" ? "‹" : "›"}
      </span>
    </button>
  );
}
