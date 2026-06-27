"use client";

import { HIGHLIGHT_COLORS } from "@/lib/validation";
import { HIGHLIGHT_FILL } from "@/lib/reader-themes";

export function SelectionBar({
  text,
  onHighlight,
  onCopy,
  onShare,
  onDismiss,
  readOnly,
}: {
  text: string;
  onHighlight: (color: string) => void;
  onCopy: () => void;
  onShare: () => void;
  onDismiss: () => void;
  readOnly: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 animate-fade-in">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-slate-900/95 px-4 py-3 text-white shadow-2xl">
        <p className="line-clamp-1 flex-1 text-xs text-slate-300">“{text}”</p>

        {!readOnly && (
          <div className="flex items-center gap-1.5">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Highlight ${c}`}
                onClick={() => onHighlight(c)}
                className="h-6 w-6 rounded-full ring-2 ring-white/30 transition hover:scale-110"
                style={{ background: HIGHLIGHT_FILL[c] }}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onShare}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20"
        >
          Share
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20"
        >
          Copy
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss selection"
          className="rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
