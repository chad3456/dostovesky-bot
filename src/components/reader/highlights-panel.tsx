"use client";

import { useState } from "react";
import type { Highlight } from "@/lib/types";
import { HIGHLIGHT_FILL } from "@/lib/reader-themes";
import { PanelHeader } from "@/components/reader/settings-panel";

export function HighlightsPanel({
  highlights,
  onOpen,
  onUpdateNote,
  onDelete,
  onClose,
  readOnly,
}: {
  highlights: Highlight[];
  onOpen: (h: Highlight) => void;
  onUpdateNote: (h: Highlight, note: string) => void;
  onDelete: (h: Highlight) => void;
  onClose: () => void;
  readOnly: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title={`Highlights (${highlights.length})`} onClose={onClose} />
      <div className="scroll-thin flex-1 overflow-y-auto p-3">
        {highlights.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">
            {readOnly
              ? "Highlights are available when reading from your own library."
              : "Select any text while reading to create your first highlight."}
          </p>
        ) : (
          <ul className="space-y-3">
            {highlights.map((h) => (
              <HighlightRow
                key={h.id}
                h={h}
                onOpen={() => onOpen(h)}
                onUpdateNote={(note) => onUpdateNote(h, note)}
                onDelete={() => onDelete(h)}
                readOnly={readOnly}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function HighlightRow({
  h,
  onOpen,
  onUpdateNote,
  onDelete,
  readOnly,
}: {
  h: Highlight;
  onOpen: () => void;
  onUpdateNote: (note: string) => void;
  onDelete: () => void;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(h.note ?? "");

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left"
        style={{ borderLeft: `4px solid ${HIGHLIGHT_FILL[h.color] ?? "#fde047"}`, paddingLeft: "0.5rem" }}
      >
        <p className="line-clamp-3 text-sm text-slate-700">“{h.text}”</p>
        {h.chapter && (
          <p className="mt-1 text-xs text-slate-400">{h.chapter}</p>
        )}
      </button>

      {h.note && !editing && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">
          {h.note}
        </p>
      )}

      {!readOnly && (
        <div className="mt-2 flex items-center gap-3">
          {editing ? (
            <div className="flex-1">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                placeholder="Add a note…"
                aria-label="Highlight note"
              />
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onUpdateNote(note);
                    setEditing(false);
                  }}
                  className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNote(h.note ?? "");
                    setEditing(false);
                  }}
                  className="rounded px-3 py-1 text-xs text-slate-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                {h.note ? "Edit note" : "Add note"}
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="text-xs font-medium text-rose-600 hover:underline"
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}
