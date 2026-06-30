"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Footprints } from "@/components/magic/footprints";
import { SortingHatGuide } from "@/components/magic/sorting-hat-guide";
import { MaraudersMap } from "@/components/magic/marauders-map";

// Three.js loads only when the magic is actually on.
const MagicDust = dynamic(
  () => import("@/components/magic/magic-dust").then((m) => m.MagicDust),
  { ssr: false },
);

const KEY = "lumen:magic";

export function MagicLayer() {
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {}
    // Default on, unless the user reduces motion or has opted out before.
    setEnabled(saved === null ? !reduced : saved === "on");
    setReady(true);
  }, []);

  function toggle() {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(KEY, next ? "on" : "off");
      } catch {}
      return next;
    });
  }

  if (!ready) return null;

  return (
    <>
      {enabled && (
        <>
          <MaraudersMap />
          <MagicDust />
          <Footprints />
          <SortingHatGuide />
        </>
      )}

      <button
        type="button"
        onClick={toggle}
        className="fixed bottom-4 left-4 z-[59] rounded-full border border-parchment-border bg-parchment-light/90 px-4 py-2 text-xs font-semibold text-brand-800 shadow-lg backdrop-blur transition hover:-translate-y-0.5"
        aria-pressed={enabled}
        title={enabled ? "Turn the magic off" : "Turn the magic on"}
      >
        {enabled ? "🪄 Mischief managed" : "✨ I solemnly swear…"}
      </button>
    </>
  );
}
