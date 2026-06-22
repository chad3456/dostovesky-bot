"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/fetcher";
import type { BookSummary, ShareLink } from "@/lib/types";

export function ShareDialog({
  book,
  onClose,
}: {
  book: BookSummary;
  onClose: () => void;
}) {
  const [link, setLink] = useState<ShareLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ share: ShareLink | null }>(`/api/books/${book.id}/share`)
      .then((d) => setLink(d.share))
      .catch(() => setError("Could not load sharing info."))
      .finally(() => setLoading(false));
  }, [book.id]);

  const shareUrl = link
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/shared/${link.token}`
    : "";

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const d = await api<{ share: ShareLink }>(`/api/books/${book.id}/share`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setLink(d.share);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create link.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/books/${book.id}/share`, { method: "DELETE" });
      setLink(null);
    } catch {
      setError("Could not revoke link.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be unavailable; the field is selectable */
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share book"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Share book</h2>
            <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">
              {book.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="mt-6 h-10 animate-pulse rounded-lg bg-slate-100" />
        ) : link ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-slate-600">
              Anyone with this read-only link can open the book on any device.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                aria-label="Share link"
              />
              <button
                type="button"
                onClick={copy}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <button
              type="button"
              onClick={revoke}
              disabled={busy}
              className="text-sm font-medium text-rose-600 hover:underline disabled:opacity-60"
            >
              Stop sharing
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-slate-600">
              Create a private link to share this book read-only. You can revoke
              it anytime.
            </p>
            <button
              type="button"
              onClick={create}
              disabled={busy}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create share link"}
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-rose-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
