"use client";

import { useMemo, useState } from "react";
import { analyzeChapter, radialLayout } from "@/lib/knowledge-graph";
import { PanelHeader } from "@/components/reader/settings-panel";

const SIZE = 340;

export function KnowledgeGraphPanel({
  getText,
  chapterLabel,
  onClose,
}: {
  getText: () => string;
  chapterLabel: string | null;
  onClose: () => void;
}) {
  const [nonce, setNonce] = useState(0);

  const analysis = useMemo(() => {
    try {
      return analyzeChapter(getText() || "");
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getText, chapterLabel, nonce]);

  const positions = useMemo(
    () => radialLayout(analysis?.nodes.length ?? 0, SIZE),
    [analysis],
  );

  const indexOf = useMemo(() => {
    const m = new Map<string, number>();
    analysis?.nodes.forEach((n, i) => m.set(n.id, i));
    return m;
  }, [analysis]);

  const maxWeight = Math.max(1, ...(analysis?.nodes.map((n) => n.weight) ?? [1]));
  const maxEdge = Math.max(1, ...(analysis?.edges.map((e) => e.weight) ?? [1]));

  const hasGraph = analysis && analysis.nodes.length > 0;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Chapter graph" onClose={onClose} />
      <div className="scroll-thin flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {chapterLabel ? (
              <>
                Sense of <span className="font-medium text-slate-700">{chapterLabel}</span>
              </>
            ) : (
              "Concept map of the current chapter"
            )}
          </p>
          <button
            type="button"
            onClick={() => setNonce((n) => n + 1)}
            className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
          >
            ↻ Refresh
          </button>
        </div>

        {!hasGraph ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
            Not enough text on this chapter to map yet. Open a content chapter and
            refresh.
          </p>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="mx-auto block w-full max-w-[360px]"
              role="img"
              aria-label="Chapter concept graph"
            >
              {/* edges */}
              {analysis!.edges.map((e, i) => {
                const a = positions[indexOf.get(e.source) ?? 0];
                const b = positions[indexOf.get(e.target) ?? 0];
                if (!a || !b) return null;
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="#94a3b8"
                    strokeWidth={1 + (e.weight / maxEdge) * 3}
                    strokeOpacity={0.25 + (e.weight / maxEdge) * 0.5}
                  />
                );
              })}
              {/* nodes */}
              {analysis!.nodes.map((n, i) => {
                const p = positions[i];
                const r = 9 + (n.weight / maxWeight) * 15;
                const isEntity = n.kind === "entity";
                return (
                  <g key={n.id}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={r}
                      fill={isEntity ? "#6366f1" : "#14b8a6"}
                      fillOpacity={0.85}
                    />
                    <text
                      x={p.x}
                      y={p.y + r + 11}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#334155"
                      fontWeight={i === 0 ? 700 : 500}
                    >
                      {n.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="mt-2 flex justify-center gap-4 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-500" />
                People / places
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-teal-500" />
                Themes
              </span>
            </div>

            {analysis!.summary.length > 0 && (
              <section className="mt-5">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  In a nutshell
                </h3>
                <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                  {analysis!.summary.join(" ")}
                </p>
              </section>
            )}

            {analysis!.themes.length > 0 && (
              <section className="mt-4">
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Key themes
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {analysis!.themes.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <p className="mt-5 text-center text-[11px] leading-snug text-slate-400">
              A statistical concept map of this chapter — bigger dots appear more
              often; links mean they share scenes.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
