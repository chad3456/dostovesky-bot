import { hasApiKey } from "@/lib/epubcast/generate";

export type Engine = "free" | "claude";

/**
 * Which generation engine is active.
 *
 * "free" is the default and costs nothing: episodes are composed locally from
 * the chapter text plus keyless public research (Wikipedia, Wikiquote, Open
 * Library, Project Gutenberg). No API key, no per-episode billing.
 *
 * The hosted Claude engine writes noticeably better dialogue but bills per
 * episode, so it is strictly opt-in: it requires BOTH `EPUBCAST_ENGINE=claude`
 * and an `ANTHROPIC_API_KEY`. Setting a key alone never starts spending money.
 */
export function activeEngine(): Engine {
  const requested = (process.env.EPUBCAST_ENGINE || "free").toLowerCase();
  if (requested === "claude" && hasApiKey()) return "claude";
  return "free";
}

/** True when the paid engine was asked for but can't run (no key configured). */
export function claudeRequestedButUnavailable(): boolean {
  return (
    (process.env.EPUBCAST_ENGINE || "").toLowerCase() === "claude" && !hasApiKey()
  );
}
