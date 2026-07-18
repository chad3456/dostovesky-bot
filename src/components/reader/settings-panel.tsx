"use client";

import type { Preferences } from "@/lib/types";
import { READER_THEMES } from "@/lib/reader-themes";

const FONT_OPTIONS = [
  { id: "serif", label: "Serif" },
  { id: "sans", label: "Sans" },
  { id: "dyslexic", label: "Dyslexic" },
  { id: "oldstyle", label: "1700s print" },
  { id: "cursive", label: "Quill cursive" },
  { id: "handwritten", label: "Handwritten" },
];

export function SettingsPanel({
  prefs,
  onChange,
  onClose,
}: {
  prefs: Preferences;
  onChange: (patch: Partial<Preferences>) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Reading settings" onClose={onClose} />
      <div className="scroll-thin flex-1 space-y-6 overflow-y-auto p-5">
        {/* Theme */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Theme
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {Object.values(READER_THEMES).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange({ theme: t.id })}
                aria-label={t.label}
                aria-pressed={prefs.theme === t.id}
                className={`h-10 rounded-lg border-2 text-[10px] font-medium transition ${
                  prefs.theme === t.id
                    ? "border-brand-500 ring-2 ring-brand-200"
                    : "border-slate-200"
                }`}
                style={{ background: t.background, color: t.color }}
              >
                Aa
              </button>
            ))}
          </div>
        </section>

        {/* Font family */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Font
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {FONT_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onChange({ fontFamily: f.id })}
                aria-pressed={prefs.fontFamily === f.id}
                className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                  prefs.fontFamily === f.id
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>

        {/* Font size */}
        <Stepper
          label="Font size"
          value={`${prefs.fontSize}px`}
          onDec={() => onChange({ fontSize: Math.max(12, prefs.fontSize - 1) })}
          onInc={() => onChange({ fontSize: Math.min(48, prefs.fontSize + 1) })}
        />

        {/* Line height */}
        <Stepper
          label="Line spacing"
          value={prefs.lineHeight.toFixed(1)}
          onDec={() =>
            onChange({ lineHeight: Math.max(1, +(prefs.lineHeight - 0.1).toFixed(1)) })
          }
          onInc={() =>
            onChange({ lineHeight: Math.min(3, +(prefs.lineHeight + 0.1).toFixed(1)) })
          }
        />

        {/* Margins */}
        <Stepper
          label="Margins"
          value={`${prefs.margin}px`}
          onDec={() => onChange({ margin: Math.max(0, prefs.margin - 8) })}
          onInc={() => onChange({ margin: Math.min(120, prefs.margin + 8) })}
        />

        {/* Justify */}
        <Toggle
          label="Justify text"
          checked={prefs.justify}
          onChange={(v) => onChange({ justify: v })}
        />

        {/* Flow */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Layout
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "paginated", label: "Pages" },
              { id: "scrolled", label: "Scroll" },
            ].map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => onChange({ flow: o.id })}
                aria-pressed={prefs.flow === o.id}
                className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                  prefs.flow === o.id
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <section className="flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </h3>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDec}
          aria-label={`Decrease ${label}`}
          className="h-8 w-8 rounded-full border border-slate-200 text-lg leading-none text-slate-600 hover:bg-slate-50"
        >
          −
        </button>
        <span className="w-12 text-center text-sm font-medium tabular-nums text-slate-700">
          {value}
        </span>
        <button
          type="button"
          onClick={onInc}
          aria-label={`Increase ${label}`}
          className="h-8 w-8 rounded-full border border-slate-200 text-lg leading-none text-slate-600 hover:bg-slate-50"
        >
          +
        </button>
      </div>
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <section className="flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </h3>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${
          checked ? "bg-brand-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
            checked ? "left-[1.375rem]" : "left-0.5"
          }`}
        />
      </button>
    </section>
  );
}

export function PanelHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close panel"
        className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
      >
        ✕
      </button>
    </div>
  );
}
