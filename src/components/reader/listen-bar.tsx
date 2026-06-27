"use client";

import type { TtsController } from "@/components/reader/use-tts";

export function ListenBar({ tts }: { tts: TtsController }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-slate-900/95 px-4 py-3 text-white shadow-2xl">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          Listening
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Speed */}
          <button
            type="button"
            aria-label="Slower"
            onClick={() => tts.setRate(+(tts.rate - 0.25).toFixed(2))}
            className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs hover:bg-white/20"
          >
            −
          </button>
          <span className="w-10 text-center text-xs tabular-nums" aria-label="Speed">
            {tts.rate.toFixed(2)}×
          </span>
          <button
            type="button"
            aria-label="Faster"
            onClick={() => tts.setRate(+(tts.rate + 0.25).toFixed(2))}
            className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs hover:bg-white/20"
          >
            +
          </button>

          {/* Play / pause */}
          <button
            type="button"
            onClick={tts.togglePause}
            aria-label={tts.paused ? "Resume" : "Pause"}
            className="ml-1 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            {tts.paused ? "▶" : "❚❚"}
          </button>
          {/* Stop */}
          <button
            type="button"
            onClick={tts.stop}
            aria-label="Stop listening"
            className="rounded-lg px-2 py-1.5 text-sm text-slate-300 hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
