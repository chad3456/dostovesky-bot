"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  HEARTBEAT_MS,
  type Activity,
  type LiveReader,
} from "@/lib/presence";

const TOKEN_KEY = "lumen:presence-token";

function readToken(): string {
  try {
    const existing = localStorage.getItem(TOKEN_KEY);
    if (existing && existing.length >= 8) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `t${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(TOKEN_KEY, fresh);
    return fresh;
  } catch {
    // Private mode / storage disabled: fall back to a per-load token.
    return `t${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

export interface Presence {
  count: number;
  readers: LiveReader[];
  /** This visitor's own pseudonym. */
  you: string | null;
  /** False until the first heartbeat lands, so the UI can stay quiet. */
  ready: boolean;
}

/**
 * Check this visitor in on an interval and keep the live snapshot fresh.
 *
 * Heartbeats pause while the tab is hidden, so a backgrounded tab drops out of
 * the count within the live window — "active" means actually here.
 */
export function usePresence(
  activity: Activity = "browsing",
  bookTitle?: string | null,
): Presence {
  const [state, setState] = useState<Presence>({
    count: 0,
    readers: [],
    you: null,
    ready: false,
  });

  // Keep the latest activity in a ref so the interval never goes stale.
  const activityRef = useRef(activity);
  activityRef.current = activity;
  const bookRef = useRef(bookTitle ?? null);
  bookRef.current = bookTitle ?? null;
  const tokenRef = useRef<string | null>(null);

  const beat = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    if (!tokenRef.current) tokenRef.current = readToken();
    try {
      const res = await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tokenRef.current,
          activity: activityRef.current,
          bookTitle: bookRef.current,
        }),
        // Presence is ambient; never let it sit in a cache.
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        count: number;
        readers: LiveReader[];
        you: string;
      };
      setState({
        count: data.count ?? 0,
        readers: Array.isArray(data.readers) ? data.readers : [],
        you: data.you ?? null,
        ready: true,
      });
    } catch {
      // Offline or blocked — leave the last known snapshot in place.
    }
  }, []);

  useEffect(() => {
    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    const onVisible = () => {
      if (!document.hidden) beat();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [beat]);

  // Check in immediately when the visitor starts or stops reading something,
  // so the ticker reflects reality without waiting for the next interval.
  useEffect(() => {
    beat();
  }, [activity, bookTitle, beat]);

  return state;
}
