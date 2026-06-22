"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/fetcher";
import { READER_THEMES } from "@/lib/reader-themes";

const FONTS = [
  { id: "serif", label: "Serif" },
  { id: "sans", label: "Sans" },
  { id: "dyslexic", label: "Dyslexia-friendly" },
];

const SIZES = [
  { id: 16, label: "Small" },
  { id: 18, label: "Medium" },
  { id: 22, label: "Large" },
  { id: 26, label: "Extra large" },
];

export function OnboardingClient({
  defaultName,
  email,
}: {
  defaultName: string;
  email: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(defaultName);
  const [theme, setTheme] = useState("light");
  const [fontFamily, setFontFamily] = useState("serif");
  const [fontSize, setFontSize] = useState(18);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 3;

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await api("/api/onboarding", {
        method: "PUT",
        body: JSON.stringify({ name: name.trim(), theme, fontFamily, fontSize }),
      });
      router.push("/library");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save. Please try again.");
      setSaving(false);
    }
  }

  function next() {
    setError(null);
    if (step === 1 && !name.trim()) {
      setError("Please tell us what to call you.");
      return;
    }
    if (step < totalSteps - 1) setStep((s) => s + 1);
    else finish();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-white px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        {/* Progress */}
        <div className="mb-6 flex items-center gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition ${
                i <= step ? "bg-brand-600" : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        {step === 0 && (
          <section className="animate-fade-in text-center">
            <div className="text-5xl" aria-hidden>
              👋
            </div>
            <h1 className="mt-4 text-2xl font-bold text-slate-900">
              Welcome to Lumen
            </h1>
            <p className="mt-2 text-slate-600">
              {email ? (
                <>
                  You&apos;re signed in as{" "}
                  <span className="font-medium text-slate-800">{email}</span>.
                </>
              ) : (
                "Let's get your reading space set up."
              )}{" "}
              This takes about 20 seconds.
            </p>
          </section>
        )}

        {step === 1 && (
          <section className="animate-fade-in">
            <h2 className="text-xl font-semibold text-slate-900">
              What should we call you?
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              This appears on your account. You can change it later.
            </p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && next()}
              placeholder="Your name"
              aria-label="Display name"
              maxLength={80}
              className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-800 focus:border-brand-500"
            />
          </section>
        )}

        {step === 2 && (
          <section className="animate-fade-in">
            <h2 className="text-xl font-semibold text-slate-900">
              How do you like to read?
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Pick comfortable defaults — adjust anytime while reading.
            </p>

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Theme
              </p>
              <div className="grid grid-cols-5 gap-2">
                {Object.values(READER_THEMES).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    aria-label={t.label}
                    aria-pressed={theme === t.id}
                    className={`h-12 rounded-lg border-2 text-xs font-medium transition ${
                      theme === t.id
                        ? "border-brand-500 ring-2 ring-brand-200"
                        : "border-slate-200"
                    }`}
                    style={{ background: t.background, color: t.color }}
                  >
                    Aa
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Font
              </p>
              <div className="grid grid-cols-3 gap-2">
                {FONTS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFontFamily(f.id)}
                    aria-pressed={fontFamily === f.id}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                      fontFamily === f.id
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Text size
              </p>
              <div className="grid grid-cols-4 gap-2">
                {SIZES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setFontSize(s.id)}
                    aria-pressed={fontSize === s.id}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                      fontSize === s.id
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-rose-600">
            {error}
          </p>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || saving}
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-800 disabled:invisible"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={next}
            disabled={saving}
            className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving
              ? "Setting up…"
              : step < totalSteps - 1
                ? "Continue"
                : "Start reading"}
          </button>
        </div>
      </div>
    </main>
  );
}
