"use client";

import { useEffect, useState } from "react";
import {
  activityLine,
  countLabel,
  featuredReader,
  type Activity,
} from "@/lib/presence";
import { usePresence, type Presence } from "@/components/presence/use-presence";

/** How long each "who's reading what" line stays up. */
const ROTATE_MS = 5000;

/**
 * Presentational badge: how many people are on the site right now, plus a
 * rotating line about what somebody is reading. Counts are real heartbeats —
 * never padded.
 *
 * Takes the snapshot as a prop so a page that unmounts its header (the reader
 * takes over the screen) can own a single long-lived heartbeat above it.
 */
export function PresenceBadge({
  presence,
  className = "",
}: {
  presence: Presence;
  className?: string;
}) {
  const { count, readers, ready } = presence;
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setRotation((r) => r + 1), ROTATE_MS);
    return () => clearInterval(timer);
  }, []);

  // Stay out of the way until the first heartbeat lands.
  if (!ready) return null;

  const featured = featuredReader(readers, rotation);
  const line = featured ? activityLine(featured, rotation) : null;
  // The viewer is always one of the live visitors, so "1" means just them.
  const label = countLabel(count, { you: count === 1 });

  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      <span
        className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-50/70 px-2.5 py-1"
        title={`${count} ${count === 1 ? "person" : "people"} active in the last minute`}
      >
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="whitespace-nowrap text-xs font-semibold text-emerald-900">
          {label}
        </span>
      </span>

      {line && (
        <span
          key={line}
          className="animate-fade-in hidden min-w-0 truncate text-xs italic text-ink-soft sm:inline"
          aria-live="polite"
        >
          {line}
        </span>
      )}
    </div>
  );
}

/**
 * Drop-in version for pages whose header stays mounted: owns its own heartbeat.
 */
export function LivePresence({
  activity = "browsing",
  bookTitle,
  className = "",
}: {
  activity?: Activity;
  bookTitle?: string | null;
  className?: string;
}) {
  const presence = usePresence(activity, bookTitle);
  return <PresenceBadge presence={presence} className={className} />;
}
